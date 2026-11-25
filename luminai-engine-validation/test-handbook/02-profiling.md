# Manual Test Handbook — 02: Data Profiling & Quality Scoring (`PRF-01` to `PRF-06`)

---

### Test 5: Deep Column & Dataset Profiler Math (`PRF-01`)

**1. What is this feature?**  
Profiles row/column counts, missingness (sentinels + `NaN` + whitespace), duplicate rows, outlier counts, memory footprint, and numeric quartiles/std dev.

**2. Why does LuminAI need it?**  
Users rely on profile metrics before choosing cleaning rules; inaccurate standard deviation, missing sentinel blindness, or wrong `invalid_record_count` causes silent bad decisions.

**3. How does it work internally?**  
`app/processing/engine/profiler.py::DataProfiler` uses `stats_utils.compute_numeric_summary` (`ddof=1` sample std dev, linear percentile interpolation, `NaN` exclusion) and tracks `invalid_row_indices` set for distinct invalid row counts.

**4. What dataset should I use?**  
- `datasets/<tier>/domain_a_customers.parquet` (`annual_income_usd`, `date_of_birth`, `age`, `email`)
- `datasets/<tier>/domain_b_ledger.parquet` (`net_revenue`, `net_profit`, `tax_rate_pct`)

**5. What should I do?**
```powershell
cd data-engine
.\.venv\Scripts\python.exe -c "
import json, polars as pl
from app.processing.engine.profiler import DataProfiler

df = pl.read_parquet('../luminai-engine-validation/datasets/small/domain_a_customers.parquet')
prof = DataProfiler().profile_dataset(df)
print('rows:', prof.total_rows, 'dups:', prof.duplicate_row_count, 'invalid_recs:', prof.invalid_record_count)
for cp in prof.columns:
    if cp.column_name in ('annual_income_usd', 'email', 'age', 'date_of_birth'):
        print(cp.column_name, cp.inferred_type, 'nulls:', cp.null_count, 'mean:', cp.mean, 'std:', cp.std_dev, 'q1/med/q3:', cp.q1, cp.median, cp.q3, 'outliers:', cp.outlier_count)
"
```

**6. What should happen internally?**  
Each column counts both Polars nulls and 18 string `NULL_SENTINELS` plus float `NaN`; numeric summary filters `NaN` before calculating sample variance (`ddof=1`) and linear quantiles.

**7. What output should I expect?**  
Compare directly against `reference-data/reference-calculations/<tier>/stats_domain_a.json["messy_customers"]`! Specifically: `mean`, `sample_std_ddof1`, `percentiles_linear.p25_q1`, `p50_median`, `p75_q3`, and `missing_breakdown.total_missing`.

**8. How do I verify correctness?**  
Check relative tolerance `< 1e-4` (allowing rounding) between `DataProfiler` (`mean`, `std_dev`, `q1`, `median`, `q3`) and `stats_domain_a.json`. Check `duplicate_row_count >= expected["exact_duplicate_rows_added"]`.

**9. What can go wrong?**  
- Sample vs population variance mismatch (`ddof=1` vs `ddof=0`).  
- `NaN` leaking into quantile/min/max calculations.  
- `invalid_record_count` double-counting a single row with 2 bad columns (`min(total_rows, cell_invalids)` bug would inflate count!).

**10. What does a successful result look like?**  
`mean`, `std_dev`, `q1`, `median`, `q3`, `null_count`, `duplicate_row_count`, and `invalid_record_count` match the independent `reference_calculator.py` numbers.

**11. What should I record?**  
Log numeric delta table (Actual vs Reference Mean/Std/Median/Q1/Q3/Nulls) in `test-results/execution-log.md`.

---

### Test 6: Type Inference & Leading-Zero Identifier Preservation (`PRF-02`)

**1. What is this feature?**  
Detects column semantic types (`integer`, `float`, `identifier`, `date`, `email`, `phone`, `boolean`, etc.) while keeping leading-zero IDs (`"00101"`) as string identifiers instead of integers (`101`).

**2. Why does LuminAI need it?**  
Casting ZIP codes, bank account codes, or SKUs to `int64` corrupts keys silently across ER and joins.

**3. How does it work internally?**  
`app/processing/engine/type_inference.py::TypeInferenceEngine`.

**4. What dataset should I use?**  
- `datasets/<tier>/domain_a_customers.csv` (`account_code` `"0000101"`, `customer_id`, `national_id`)
- `datasets/<tier>/domain_c_products.csv` (`sku_code` `"000001001"`)

**5. What should I do?**
```powershell
cd data-engine
.\.venv\Scripts\python.exe -c "
import polars as pl
from app.processing.engine.type_inference import TypeInferenceEngine

df = pl.read_csv('../luminai-engine-validation/datasets/small/domain_a_customers.csv', infer_schema_length=0)
eng = TypeInferenceEngine()
for col in ['account_code', 'customer_id', 'age', 'is_verified', 'email', 'phone']:
    res = eng.profile_column(col, df[col].head(500).to_list())
    print(col, '->', res.inferred_type, 'sample:', res.sample_values[:3] if hasattr(res, 'sample_values') else '')
"
```

**6. What should happen internally?**  
Column name cue (`code`) + leading `"0"` detection overrides integer parsing to classify `account_code` as `identifier`.

**7. What output should I expect?**  
`account_code -> InferredType.IDENTIFIER`; `email -> EMAIL`; `phone -> PHONE`; `is_verified -> BOOLEAN`.

**8. How do I verify correctness?**  
Check no leading zero is stripped when passing through `DatasetCleaner` or `TypeInferenceEngine.convert_value`.

**9. What can go wrong?**  
- Numeric coercion stripping leading `"00"` from `account_code` / `sku_code`.

**10. What does a successful result look like?**  
`account_code` and `sku_code` classified as `identifier`, retaining `"00..."`.

**11. What should I record?**  
Record inferred types for all 6 columns tested.

---

### Test 7: SchemaDetector Binary vs Numeric Disambiguation & Fuzzy Ontology Mapping (`PRF-03`)

**1. What is this feature?**  
Distinguishes true booleans (`["true", "false", "1", "0"]`) from multi-value numeric digits (`["0", "1", "2", "3"]`), handles sentinels/`NaN`, and suggests ontology property mappings.

**2. Why does LuminAI need it?**  
Multi-value ordinal codes (`0, 1, 2, 3`) must never be misclassified as `BOOLEAN` simply because rows start with `"0"`/`"1"`.

**3. How does it work internally?**  
`app/processing/schema_detector/detector.py::SchemaDetector.detect_column_type` scans column non-null values before allowing binary digit `"0"`/`"1"` boolean classification when non-binary numbers or pure integer sequences appear.

**4. What dataset should I use?**  
- `datasets/<tier>/domain_f_survey.csv` (`binary_mixed_str`, `numeric_digit_str`, `pure_binary_int`, `income_mnar`)

**5. What should I do?**
```powershell
cd data-engine
.\.venv\Scripts\python.exe -c "
import polars as pl
from app.processing.schema_detector.detector import SchemaDetector

df = pl.read_csv('../luminai-engine-validation/datasets/small/domain_f_survey.csv', infer_schema_length=0)
det = SchemaDetector()
for c in ['binary_mixed_str', 'numeric_digit_str', 'pure_binary_int', 'income_mnar']:
    print(c, '->', det.detect_column_type(df[c].head(500).to_list(), column_name=c))
rep = det.validate_dataframe(df, dataset_name='domain_f_survey', reject_on_violation=False)
print('income_mnar null_pct:', next(x.null_pct for x in rep.columns if x.name == 'income_mnar'))
"
```

**6. What should happen internally?**  
`binary_mixed_str` (`true`/`false`/`1`/`0`) has textual booleans and binary digits → `BOOLEAN`. `numeric_digit_str` (`0`,`1`,`2`,`3`) contains `"2"`, `"3"` → `allow_binary_digits=False` → `NUMBER`.

**7. What output should I expect?**  
Matches `expected_domain_f.json["schema_detector_types"]`: `binary_mixed_str -> boolean`, `numeric_digit_str -> number`, `income_mnar -> number`.

**8. How do I verify correctness?**  
Compare `income_mnar.null_pct` against `(missing_or_sentinel_count / total_rows) * 100` in `stats_domain_f.json["survey"]["numeric_summaries"]["income_mnar"]`.

**9. What can go wrong?**  
- `["0","1","2","3"]` wrongly classified as `BOOLEAN`.  
- Sentinels `"N/A"` missed by `validate_dataframe` (confirm fix works across full `df`).

**10. What does a successful result look like?**  
Exact type classification and full-DataFrame sentinel null percentage match.

**11. What should I record?**  
Record `PRF-03` types and sentinel null percentage accuracy. Also record `PRF-04`, `PRF-05`, `PRF-06` verification runs (detailed below or in log).

---

### Test 8: Quality Framework (`PRF-04`), Dashboard Quality (`PRF-05`), & AI Insights Profiler (`PRF-06`)

**1. What is this feature?**  
Tests `DataQualityFramework`, `DashboardAnalyticsService` (with mocked/SQLite or PG Flyway checks), and `ai_insights.DatasetProfiler` consistency.

**2. How does it work / Dataset?**  
Run on `domain_a_customers.parquet` + SQLite `er_staging.db` (or empty tenant) to verify score bounds `[0, 100]`, known `referential_integrity=100.0` hardcoded limitation in `DataQualityFramework`, and IQR fallback to `mean ± 2*stddev` on constant/zero-IQR columns (`domain_b_ledger.parquet::is_manual_override`).

**3. Command & Verification:**
```powershell
cd data-engine
.\.venv\Scripts\python.exe -c "
import polars as pl
from app.processing.engine.quality_framework import DataQualityFramework
from app.processing.ai_insights.analyzer import DatasetProfiler

df_a = pl.read_parquet('../luminai-engine-validation/datasets/small/domain_a_customers.parquet')
q_rep = DataQualityFramework.evaluate_dataset(df_a.to_dicts())
print('DQF scores:', q_rep.dimension_scores, 'overall:', q_rep.overall_score, 'verified:', q_rep.verified_count, 'review:', q_rep.needs_review_count)

df_b = pl.read_parquet('../luminai-engine-validation/datasets/small/domain_b_ledger.parquet')
ai_prof = DatasetProfiler().profile_dataframe(df_b, entity_type='Ledger')
print('AI override stats:', ai_prof['columns'].get('is_manual_override'))
"
```
Confirm `referential_integrity == 100.0` (documented Class B limitation), valid bounds `[0, 100]`, and `ai_insights` detects zero-variance `audit_version` safely (`std == 0` without crash).
