# Manual Test Handbook — 07: Exploratory Data Analysis & AI Insights (`STA-01`, `STA-04`)

---

### Test 18: `EdaEngine` Mathematical Accuracy (`STA-01`)

**1. What is this feature?**  
Computes overview metrics, missingness breakdown, numeric univariate distributions (`ddof=1` sample variance/std, linear percentiles, IQR outlier count), categorical frequencies (`pct` of valid count + `pct_of_total`), and Pearson correlation matrix (preserving `None` for zero-variance pairs).

**2. Why does LuminAI need it?**  
Users explore datasets in EDA Studio to detect skew, outliers, zero-variance features, and collinear pairs before cleaning or ML modeling.

**3. How does it work internally?**  
`app/processing/engine/eda_engine.py::EdaEngine.generate_eda_report` delegates numeric stats to `stats_utils.compute_numeric_summary`, drops `NaN` prior to statistics/outliers, and sets zero-variance correlations to `None`.

**4. What dataset should I use?**  
- `datasets/<tier>/domain_b_ledger.parquet` (`gross_revenue`, `net_revenue`, `net_profit` with `NaN`, zero-variance `audit_version`)
- `datasets/<tier>/domain_g_ml_classification.csv` (`annual_income_usd` vs collinear `annual_income_k_collinear`)

**5. What should I do?**
```powershell
cd data-engine
.\.venv\Scripts\python.exe -c "
import json, polars as pl
from app.processing.engine.eda_engine import EdaEngine

df_b = pl.read_parquet('../luminai-engine-validation/datasets/small/domain_b_ledger.parquet')
rep_b = EdaEngine.generate_eda_report(df_b)
print('Overview:', rep_b['overview'])
print('net_profit stats:', rep_b['numeric_statistics'].get('net_profit'))
print('correlation net_revenue vs is_manual_override:', rep_b['correlation_matrix'].get('net_revenue', {}).get('is_manual_override'))

df_g = pl.read_csv('../luminai-engine-validation/datasets/small/domain_g_ml_classification.csv', null_values=['N/A'])
rep_g = EdaEngine.generate_eda_report(df_g)
print('Collinear pair corr:', rep_g['correlation_matrix']['annual_income_usd']['annual_income_k_collinear'])
"
```

**6. What should happen internally?**  
`NaN` entries in `net_profit` are dropped cleanly; `sample_std_ddof1` and linear percentiles (`p25`, `p50`, `p75`, `p90`, `p95`) match independent `reference_calculator.py` calculations; constant numeric zero-variance columns yield `None` correlation instead of misleading `0.0`.

**7. What output should I expect?**  
Compare every printed field against `reference-data/reference-calculations/<tier>/stats_domain_b.json["messy_ledger"]` and `stats_domain_g.json["classification"]`:
- `mean`, `median`, `sample_std_ddof1`, `sample_variance_ddof1`, `p25`..`p95`, `iqr_outlier_count`
- `correlation(annual_income_usd, annual_income_k_collinear)` > `0.99` matching `pearson_correlation` in `stats_domain_g.json`.

**8. How do I verify correctness?**  
Also check `categorical_statistics["fiscal_period"]["top_categories"]`: verify `percentage` sums cleanly against `valid_count` (`count`) while `pct_of_total` reflects total rows, AND verify `"2025-Q3"` is absent!

**9. What can go wrong?**  
- Population variance mismatch, `NaN` contaminating `min`/`max`/percentiles, or `0.0` replacing undefined correlation.

**10. What does a successful result look like?**  
All univariate and bivariate metrics match independent `reference_calculator.py` figures within floating-point rounding (`<= 1e-2`).

**11. What should I record?**  
Record exact comparison table of `EdaEngine` vs `stats_domain_b.json` / `stats_domain_g.json` in `test-results/execution-log.md`.

---

### Test 19: `AIInsightsService` Offline Heuristic Insights (`STA-04`)

**1. What is this feature?**  
Generates structured trend, outlier, completeness, and concentration insights without external API calls when `provider="heuristic"`.

**2. How does it work internally?**  
`app/processing/ai_insights/service.py::AIInsightsService.generate_insights` uses `ai_insights/analyzer.py` (`1.5 * IQR` / `mean ± 2*std` fallback) and `ai_insights/generator.py::HeuristicInsightGenerator`.

**3. What dataset should I use?**  
- `datasets/<tier>/domain_d_timeseries.parquet` (`temperature_c` with trend, heat spikes, and `-999.0` sensor dropouts)

**4. What should I do?**
```powershell
cd data-engine
.\.venv\Scripts\python.exe -c "
import asyncio, polars as pl
from app.processing.ai_insights.service import AIInsightsService
from app.processing.ai_insights.models import InsightsRequest

df = pl.read_parquet('../luminai-engine-validation/datasets/small/domain_d_timeseries.parquet')
svc = AIInsightsService()
res = asyncio.run(svc.generate_insights(InsightsRequest(tenant_id='t1', entity_type='Sensor', provider='heuristic'), override_df=df))
print('provider:', res.provider, 'insights count:', len(res.insights))
for ins in res.insights[:5]:
    print('-', ins.title, '|', ins.severity, '|', ins.description[:100])
"
```

**5. What should I check / record?**  
Verify anomaly insights trigger on `temperature_c` spikes/`-999.0` without calling Gemini/OpenAI, and note the known wording quirk (`generator.py` text vs `1.5*IQR` threshold in `analyzer.py`).
