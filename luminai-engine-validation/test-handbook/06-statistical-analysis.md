# Manual Test Handbook — 06: DuckDB OLAP & SQL Studio (`STA-02`, `STA-03`)

---

### Test 16: DuckDB OLAP Aggregation, Time-Series, & Export Consistency (`STA-02`)

**1. What is this feature?**  
Runs analytical aggregations (`count`, `avg`, `sum`, `min`, `max`, `distinct`), date-truncated time-series rollups, and JSONB/UUID normalization via `DuckDBAnalyticsEngine`.

**2. Why does LuminAI need it?**  
Powers dashboard KPI widgets, cohort aggregations, and time-series charts over normalized multi-tenant schemas.

**3. How does it work internally?**  
`app/processing/analytics_engine/engine.py::DuckDBAnalyticsEngine`, `data_loader.py` (supports Flyway `tenant_{slug}` UUID/JSONB adaptation), and `query_builder.py` (`IDENTIFIER_RE` field whitelist).

**4. What dataset should I use?**  
- `datasets/<tier>/domain_d_timeseries.parquet` (`recorded_at`, `sensor_id`, `temperature_c`, `power_kw`)
- `datasets/<tier>/domain_c_orders_denormalized.parquet`

**5. What should I do?**
```powershell
cd data-engine
.\.venv\Scripts\python.exe -c "
import json, polars as pl
from app.processing.analytics_engine.engine import DuckDBAnalyticsEngine

df = pl.read_parquet('../luminai-engine-validation/datasets/small/domain_d_timeseries.parquet')
wrapped = pl.DataFrame({
    'tenant_id': ['val-tenant'] * df.height,
    'entity_type': ['SensorReading'] * df.height,
    'attributes': [json.dumps(r) for r in df.to_dicts()],
})
eng = DuckDBAnalyticsEngine(override_df=wrapped)
res, total = eng.execute_query(
    tenant_id='val-tenant',
    entity_type='SensorReading',
    aggregations=['count', 'avg:power_kw', 'max:temperature_c'],
    table_name='golden_records',
)
print('OLAP Agg:', res, 'total_rows:', total)
"
```

**6. Expected Verification & Precision:**  
Compare per-sensor `avg(power_kw)` and overall row counts against independent DuckDB / Python reference sums, AND test field names containing `'; DROP TABLE ...` expecting `400` / `ValueError` via `IDENTIFIER_RE`.

---

### Test 17: SQL Studio Read-Only Execution, Filtering, & Adversarial SQLi Probes (`STA-03`)

**1. What is this feature?**  
Executes `SELECT` / `WITH` / `EXPLAIN` / `DESCRIBE` / `SHOW` SQL queries over inline tables or `dataset_id` in sandboxed `:memory:` DuckDB (`enable_external_access = false`).

**2. How does it work internally?**  
`app/api/sql_studio_api.py::execute_sql_query` strips SQL comments and string literals before applying `DISALLOWED_PATTERNS`, blocks multi-statement `;`, strips single trailing `;`, skips subquery count wrapping on `EXPLAIN`/`DESCRIBE`/`SHOW`, and raises `404` when `dataset_id` cannot be resolved without inline tables.

**3. What dataset should I use?**  
- First `100` rows of `datasets/<tier>/domain_c_orders_denormalized.csv` + `domain_s_adversarial.csv`

**4. What should I do?**
```powershell
cd data-engine
.\.venv\Scripts\python.exe -c "
import polars as pl
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
rows = pl.read_parquet('../luminai-engine-validation/datasets/small/domain_c_orders_denormalized.parquet').head(50).to_dicts()

# 1. Valid aggregation with trailing semicolon
r1 = client.post('/analytics/sql/execute', json={'tenant_id': 't1', 'query': 'SELECT product_category, SUM(order_total) AS rev FROM orders GROUP BY 1;', 'tables': {'orders': rows}})
print('trailing semi:', r1.status_code, len(r1.json().get('rows', [])), r1.json().get('total_rows'))

# 2. Benign SQL keyword inside string literal (must SUCCEED!)
r2 = client.post('/analytics/sql/execute', json={'tenant_id': 't1', 'query': \"SELECT 'DROP TABLE users' AS safe_label FROM orders LIMIT 1\", 'tables': {'orders': rows}})
print('literal keyword:', r2.status_code, r2.json().get('rows'))

# 3. EXPLAIN query (must SUCCEED!)
r3 = client.post('/analytics/sql/execute', json={'tenant_id': 't1', 'query': 'EXPLAIN SELECT * FROM orders', 'tables': {'orders': rows}})
print('EXPLAIN:', r3.status_code)

# 4. Forbidden probes (ALL must return 400/403!)
for bad in [
    'SELECT 1; DROP TABLE orders',
    'SELECT * FROM read_csv_auto(\"/etc/passwd\")',
    'CALL duckdb_tables()',
    'DROP TABLE orders',
]:
    rb = client.post('/analytics/sql/execute', json={'tenant_id': 't1', 'query': bad, 'tables': {'orders': rows}})
    print('blocked:', bad[:35], '->', rb.status_code)

# 5. Missing dataset_id with no inline tables (must return 404!)
r4 = client.post('/analytics/sql/execute', json={'tenant_id': 't1', 'dataset_id': 'does-not-exist', 'query': 'SELECT 1'})
print('missing dataset_id:', r4.status_code)
"
```

**5. What does a successful result look like?**  
- Trailing semicolon, literal `'DROP TABLE'`, and `EXPLAIN` all return `200` with accurate rows.  
- Multi-statement `;`, `read_csv_auto`, `CALL`, and `DROP` are ALL rejected (`400`/`403`).  
- Missing `dataset_id` returns `404` (not empty dummy table).
