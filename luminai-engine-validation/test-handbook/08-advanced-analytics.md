# Manual Test Handbook — 08: Machine Learning, Entity Resolution & Graph Intelligence (`ADV-01` to `ADV-08`)

---

### Test 20: ML Classification — Missing Targets, No Data Leakage & Imbalanced Split (`ADV-01`)

**1. What is this feature?**  
Trains sklearn classifiers (`Random Forest`, `Gradient Boosting`, `Logistic Regression`) while dropping missing/corrupt targets, keeping imputation/top-k encoding/scaling inside the training fold, stratifying splits, and persisting reloadable artifacts.

**2. Why does LuminAI need it?**  
Dataset-wide preprocessing before `train_test_split` leaks validation distribution into training, while turning missing targets (`None`/`"N/A"`) into `"None"` classes silently corrupts predictions.

**3. How does it work internally?**  
`app/processing/ml/ml_engine.py::MachineLearningEngine.train_and_evaluate` & `predict_from_artifact`, backed by `ml_registry.py::ModelRegistryService`.

**4. What dataset should I use?**  
- `datasets/<tier>/domain_g_ml_classification.csv` (`5%` missing targets, `60` `merchant_code_high_card` categories, `annual_income_usd` vs collinear `annual_income_k_collinear`, and `leakage_post_churn_refund`)

**5. What should I do?**
```powershell
cd data-engine
.\.venv\Scripts\python.exe -c "
import polars as pl
from app.processing.ml.ml_engine import MachineLearningEngine

df = pl.read_csv('../luminai-engine-validation/datasets/small/domain_g_ml_classification.csv').head(2000)
records = df.to_dicts()
feat_cols_honest = ['age', 'tenure_months', 'annual_income_usd', 'annual_income_k_collinear', 'support_tickets', 'merchant_code_high_card']

res = MachineLearningEngine.train_and_evaluate(
    records=records,
    target_column='churn',
    feature_columns=feat_cols_honest,
    algorithm='Logistic Regression',
    task_type='CLASSIFICATION',
    include_artifact=True,
)
print('Trained counts:', res['train_size'], res['test_size'], 'sum:', res['train_size'] + res['test_size'])
print('Metrics:', res['metrics'])
preds = MachineLearningEngine.predict_from_artifact(res['artifact'], records[:5])
print('Sample preds:', preds)
"
```

**6. What output should I expect?**  
- `train_size + test_size == 1900` (`5%` missing/sentinel targets dropped out of `2000`, so `100` missing target rows excluded!). Compare against `expected_domain_g.json["classification"]["expected_trained_valid_rows"]` at full scale.  
- High-cardinality `merchant_code_high_card` runs without leaking test-only labels and predicts cleanly via `predict_from_artifact`.

**7. Comparison Experiment:**  
Re-run including `'leakage_post_churn_refund'` in `feature_columns` and compare ROC-AUC jump (`~0.98+` vs honest baseline) to confirm sensitivity to target leakage.

---

### Test 21: ML Regression Scale Stability, Target-Optional Clustering & `/analytics/ml/predict` (`ADV-01`, `ADV-02`)

**1. What is this feature?**  
Verifies `StandardScaler` stabilizes wildly scaled features in `Ridge` regression & `K-Means` clustering without `target_column`, plus end-to-end `/analytics/ml/train` → `/analytics/ml/predict` API inference.

**2. What dataset should I use?**  
- `datasets/<tier>/domain_g_ml_regression.csv`
- `datasets/<tier>/domain_g_ml_clustering.parquet`

**3. What should I do?**
```powershell
cd data-engine
.\.venv\Scripts\python.exe -c "
import polars as pl
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
reg_rows = pl.read_csv('../luminai-engine-validation/datasets/small/domain_g_ml_regression.csv').head(1000).to_dicts()
r_reg = client.post('/analytics/ml/train', json={
    'tenant_id': 'val-ml',
    'model_name': 'Price Ridge',
    'target_column': 'target_price_usd',
    'feature_columns': ['square_feet', 'micro_risk_index', 'bedrooms', 'city_tier'],
    'algorithm': 'Ridge',
    'task_type': 'REGRESSION',
    'records': reg_rows,
})
print('Regression API:', r_reg.status_code, r_reg.json()['metrics'], 'valid_rows:', r_reg.json()['train_size'] + r_reg.json()['test_size'])

run_id = r_reg.json()['run_id']
r_pred = client.post('/analytics/ml/predict', json={'run_id': run_id, 'records': reg_rows[:3]})
print('Predict API:', r_pred.status_code, r_pred.json())

clu_rows = pl.read_parquet('../luminai-engine-validation/datasets/small/domain_g_ml_clustering.parquet').head(600).select(['feature_scale_100k', 'feature_scale_unit', 'feature_scale_neg']).to_dicts()
r_clu = client.post('/analytics/ml/train', json={
    'tenant_id': 'val-ml',
    'model_name': '3-Cluster Segments',
    'algorithm': 'K-Means',
    'task_type': 'CLUSTERING',
    'hyperparameters': {'n_clusters': 3},
    'records': clu_rows,
})
print('Clustering without target_column:', r_clu.status_code, r_clu.json()['metrics'])
"
```

**4. Expected Verification:**  
- `Ridge` `r2_score >= 0.90` with `5%` missing/corrupt targets dropped (`950` valid out of `1000`).  
- `/analytics/ml/predict` returns `200` with 3 numeric predictions close to `reg_rows[:3]['target_price_usd']`.  
- `K-Means` succeeds WITHOUT `target_column` and yields `silhouette_score > 0.70` even across `100,000` vs `1.0` scales!

---

### Test 22: Cross-Source Entity Resolution & Identifier Contradiction Guard (`ADV-03`, `ADV-04`, `ADV-06`)

**1. What is this feature?**  
Verifies phonetic/fuzzy ER matching (`MultiStageEntityResolver`, `er/blocking.py`, `er/comparison.py::compare_candidate_pairs`) links nicknames/formatted duplicates while **strictly blocking merges** when verified identifiers (`national_id`, `mrn`, `ssn`, `tax_id`, `id_number`) conflict!

**2. What dataset should I use?**  
- `datasets/<tier>/domain_a_customers.csv` + `datasets/<tier>/domain_a_customers_crm_b.json` (contains planted identical-name + same-city + DIFFERENT `national_id` contradiction pairs!)

**3. What should I do?**
```powershell
cd data-engine
.\.venv\Scripts\python.exe -c "
import json, polars as pl
from app.processing.engine.deduplicator import MultiStageEntityResolver
from app.processing.er.comparison import calculate_pair_similarity_score, compare_candidate_pairs

df_a = pl.read_csv('../luminai-engine-validation/datasets/small/domain_a_customers.csv').head(50)
crm_b = json.loads(open('../luminai-engine-validation/datasets/small/domain_a_customers_crm_b.json').read())

# Find a contradiction pair (index 9: i % 10 == 9 -> same name/city, different national_id!)
rec_a = df_a.row(9, named=True)
rec_b = crm_b[9]
print('A nat_id:', rec_a['national_id'], 'B nat_id:', rec_b['national_id'], 'Same name:', rec_a['full_name'], '==', rec_b['name'])

dec, score = MultiStageEntityResolver.evaluate_pair(rec_a, {'full_name': rec_b['name'], 'national_id': rec_b['national_id'], 'city': rec_b['city'], 'email': rec_b['email']})
print('MultiStageEntityResolver decision:', dec, 'score:', score)

# Check er/comparison scalar AND vectorized chunk path with Domain ID contradiction guard:
s_pair = compare_candidate_pairs(pl.DataFrame({
    'id_a': [rec_a['customer_id']],
    'id_b': [rec_b['record_id']],
    'name_a': [rec_a['full_name']],
    'name_b': [rec_b['name']],
    'national_id_a': [rec_a['national_id']],
    'national_id_b': [rec_b['national_id']],
    'city_a': [rec_a['city']],
    'city_b': [rec_b['city']],
}))
print('compare_candidate_pairs similarity_score on contradiction:', s_pair['similarity_score'].to_list())
"
```

**4. What does a successful result look like?**  
BOTH `MultiStageEntityResolver` and `er/comparison.py::compare_candidate_pairs` return `0.0` (`DISTINCT_ENTITY`) whenever `national_id` disagrees, even if `full_name` and `city` are 100% identical! Compare full-scale contradiction counts against `expected_domain_a.json["crm_b_expected_contradiction_splits"]`.

---

### Test 23: Golden Record Survivorship, Persistence, History & Rollback (`ADV-05`)

**1. What is this feature?**  
Tests deterministic attribute survivorship (`merge_clusters_to_golden_records`), persistence to SQLite/PostgreSQL, audit history (`get_golden_record_history`), and version rollback (`rollback_golden_record`).

**2. Verification check:**  
Cluster the first 10 true-match pairs (`domain_a_customers` + `domain_a_customers_crm_b`), persist to SQLite `storage/sqlite/er_staging.db` (or inspect in temp DB), update a golden attribute manually to trigger v2 history, then invoke `rollback_golden_record(gid, target_version=1)` and verify action `'ROLLBACK'` increments cleanly.

---

### Test 24: `RelationalDecomposer` & Foreign-Key Edges (`ADV-07`, `ADV-08`)

**1. What is this feature?**  
Auto-decomposes denormalized order records (`domain_c_orders_denormalized.csv`) into normalized entity nodes (`Customer`, `Product`, `Store`, `Vendor`) + FK edges.

**2. What should I do?**
```powershell
cd data-engine
.\.venv\Scripts\python.exe -c "
import polars as pl
from app.processing.er.relational_decomposer import RelationalDecomposer
from app.processing.er.relational_edges import generate_relational_edges

df = pl.read_parquet('../luminai-engine-validation/datasets/small/domain_c_orders_denormalized.parquet').head(300)
recs = df.to_dicts()
dec = RelationalDecomposer()
rules = dec.auto_detect_rules(list(recs[0].keys()))
print('Auto-detected rules:', [(r.entity_type, r.source_columns) for r in rules])
res = dec.decompose(recs, rules=rules)
print('Decomposed entities:', {k: len(v) for k, v in res.entity_tables.items()}, 'edges:', len(res.relationships))

edges = generate_relational_edges(recs, tenant_id='val-test', source_entity_type='Order')
print('FK edges detected:', len(edges), 'sample:', edges[:2])
"
```

**3. What to check against ground truth:**  
Inspect whether greedy pattern ordering in `auto_detect_rules` drops/merges expected columns vs `expected_domain_c.json` (`distinct_stores`, `distinct_vendors`, `product_catalog_rows`) — document any rule-detection omissions accurately!
