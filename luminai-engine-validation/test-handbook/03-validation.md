# Manual Test Handbook — 03: Data Validation & Quality Gates (`VAL-01` to `VAL-04`)

---

### Test 9: Pre-Flight >50% Sentinel/Null Rejection (`VAL-01`)

**1. What is this feature?**  
Rejects datasets with `>50%` missing values across any column — including empty strings, whitespace, `"N/A"`, `"null"`, and `NaN` — before expensive ingestion begins.

**2. Why does LuminAI need it?**  
Broken upstream extracts often populate empty columns with `"N/A"` or `"null"` strings instead of SQL NULLs; missing those lets garbage through the pre-flight gate.

**3. How does it work internally?**  
`detector.py::SchemaDetector.validate_dataframe` converts all columns cleanly, counts `NULL_SENTINELS` + whitespace + `NaN` across the full DataFrame, and sets `passed=False` (`422` via API) when any column exceeds `max_null_pct`.

**4. What dataset should I use?**  
- `datasets/<tier>/domain_f_high_null_reject.csv` (`500` rows; `sparse_sentinel_col` has `75.0%` mixed sentinels)
- `datasets/<tier>/domain_f_survey.csv` (`income_mnar` column)

**5. What should I do?**
```powershell
cd data-engine
.\.venv\Scripts\python.exe -c "
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
p = Path('../luminai-engine-validation/datasets/small/domain_f_high_null_reject.csv')
r = client.post('/process/validate-schema', json={'content': p.read_text(encoding='utf-8'), 'format': 'csv', 'reject_on_violation': True})
print('status:', r.status_code, 'detail:', r.json())
"
```

**6. What output should I expect?**  
HTTP `422` with `sparse_sentinel_col` reporting `null_pct == 75.0` (matching `expected_domain_f.json["high_null_reject_file_expected_null_pct"]`), `passed == False`.

**7. Verification & Edge Notes:**  
Also re-test with `reject_on_violation=False` and confirm `200 OK` returns the full report with `passed: False` and violations list populated.

---

### Test 10: Dagster Value-Range, Null-Pct, & Referential Integrity Checks (`VAL-02`)

**1. What is this feature?**  
Standalone & `@asset_check` functions enforcing min rows, mandatory IDs (`0%` null max), value ranges (`age [0,150]`, non-future dates, `salary_amount >= 0`, `score >= 0`), and golden-to-staging referential integrity.

**2. How does it work internally?**  
`app/processing/checks/quality_checks.py::evaluate_min_row_count`, `evaluate_null_percentages`, `evaluate_value_range_constraints`, `evaluate_referential_integrity`.

**3. What dataset should I use?**  
- `datasets/<tier>/domain_a_customers.parquet` (`age` contains `-5` and `210`; `created_at` vs future dates)
- `datasets/<tier>/domain_a_transactions.parquet` (`customer_id` has planted `CUST-ORPHAN-*`)

**4. What should I do?**
```powershell
cd data-engine
.\.venv\Scripts\python.exe -c "
import polars as pl
from app.processing.checks.quality_checks import evaluate_value_range_constraints, evaluate_null_percentages, evaluate_referential_integrity

df_a = pl.read_parquet('../luminai-engine-validation/datasets/small/domain_a_customers.parquet')
# Cast age numerically where possible to test value range gate
df_num_age = df_a.with_columns(pl.col('age').cast(pl.Int64, strict=False))
print('null_check:', evaluate_null_percentages(df_a).passed, evaluate_null_percentages(df_a).description)
print('range_check:', evaluate_value_range_constraints(df_num_age).passed, evaluate_value_range_constraints(df_num_age).description)

# Referential integrity trap using orphan IDs
tx = pl.read_parquet('../luminai-engine-validation/datasets/small/domain_a_transactions.parquet')
fake_golden = pl.DataFrame({'golden_id': ['G-1'], 'source_record_ids': [tx.filter(pl.col('customer_id').str.starts_with('CUST-ORPHAN'))['customer_id'].head(2).to_list()]})
print('ref_check:', evaluate_referential_integrity(fake_golden, df_a.rename({'customer_id': 'id'})).passed)
"
```

**5. What output should I expect?**  
- `evaluate_value_range_constraints`: `passed == False` catching `-5` and `210` ages!  
- `evaluate_referential_integrity`: `passed == False` catching the orphaned `CUST-ORPHAN-*` references!

---

### Test 11: Pipeline Quarantine & Email/Date/Injection Validation (`VAL-03`, `VAL-04`)

**1. What is this feature?**  
Routes invalid records (missing `id`/`name`, bad emails per `EMAIL_REGEX`, unparseable calendar dates, injection characters in `id`) to SQLite `QuarantineManager` while allowing clean records downstream.

**2. How does it work internally?**  
`app/processing/pipelines/cleaning_pipeline/cleaning_ops.py::validate_and_quarantine_records` + `app/processing/engine/identifier_cleaner.py::IdentifierCleaner`.

**3. What dataset should I use?**  
- `datasets/<tier>/domain_a_customers.csv` (planted invalid emails `alice@nodot`, `no-at-sign.com`, `@missinguser.com`)
- `datasets/<tier>/domain_s_adversarial.csv`

**4. What should I do?**
```powershell
cd data-engine
.\.venv\Scripts\python.exe -c "
import tempfile, polars as pl
from app.kafka.quarantine import QuarantineManager
from app.processing.pipelines.cleaning_pipeline.cleaning_ops import validate_and_quarantine_records

raw = pl.read_csv('../luminai-engine-validation/datasets/small/domain_a_customers.csv', infer_schema_length=0).head(500)
# Align column expectations (id, name, email, dob)
df = raw.select([
    pl.col('customer_id').alias('id'),
    pl.col('full_name').alias('name'),
    pl.col('email'),
    pl.col('date_of_birth').alias('dob'),
])
with tempfile.NamedTemporaryFile(suffix='.db') as f:
    qm = QuarantineManager(db_path=f.name)
    valid_df, quarantined_cnt = validate_and_quarantine_records(df, tenant_id='val-test', qm=qm)
    print('input:', df.height, 'valid:', valid_df.height, 'quarantined:', quarantined_cnt)
"
```

**5. Verification & Expected Output:**  
Check that `"alice@nodot"` (contains `@`, lacks domain `.`) IS quarantined (`Invalid email format`) alongside empty emails and invalid calendar dates (`2024-02-30`), proving `EMAIL_REGEX` replaced the weak `"@" not in email` bug. Compare quarantined ID count against expected invalid rows in the first 500 rows of `manifest_domain_a.json`.
