# Manual Test Handbook — 09: Output, Provenance, Reconciliation & Orchestration (`OUT-01` to `OUT-07`)

---

### Test 25: Streaming Export Header Sanitization & Provenance Preservation (`OUT-01`, `OUT-02`)

**1. What is this feature?**  
Streams exports (`CSV`, `Parquet`, `JSON`) safely through `DuckDBAnalyticsEngine.export_data` with sanitized `Content-Disposition` headers and verifies field-level provenance preserves falsy values (`0`, `False`).

**2. How does it work internally?**  
`app/api/analytics.py::export_analytics_data` applies regex `[^a-zA-Z0-9._-]` to `Content-Disposition` filenames; `analytics_engine/engine.py::export_data` invokes `_normalize_dataframe` explicitly; `app/processing/er/provenance.py::persist_provenance_records` preserves `0` and `False` field values while excluding internal golden metadata keys.

**3. What should I do?**
```powershell
cd data-engine
.\.venv\Scripts\python.exe -c "
import polars as pl
from fastapi.testclient import TestClient
from app.main import app
from app.processing.er.provenance import track_field_provenance, persist_provenance_records

client = TestClient(app)
r = client.post('/analytics/export', json={
    'tenant_id': 't1',
    'entity_type': 'Customer\r\nX-Injected: evil',
    'format': 'csv',
    'table_name': 'golden_records'
})
print('Export status:', r.status_code, 'Content-Disposition:', r.headers.get('content-disposition'))

prov = track_field_provenance(
    golden_record={'golden_id': 'G-001', 'attributes': {'name': 'Kwame', 'retries': 0, 'is_verified': False, '_quality_score': 99.0}},
    cluster_records=[{'id': 'S1', 'source_system': 'CRM_A', 'retries': 0, 'is_verified': False, 'name': 'Kwame'}],
)
print('Provenance entries:', [(p.get('field_name'), p.get('winning_value')) for p in prov])
"
```

**4. Expected Verification:**  
- `Content-Disposition` contains NO `\r`, `\n`, spaces, or injected header text!  
- `track_field_provenance` / `persist_provenance_records` captures `'retries'` (`0`) and `'is_verified'` (`False`) without omitting them as falsy, while skipping `_quality_score`.

---

### Test 26: Pipeline Status, Dagster Schedule Selection, Cross-Store Reconciler & Quarantine (`OUT-04` to `OUT-07`)

**1. What is this feature?**  
Verifies:
- `GET /process/status/{run_id}` no longer fabricates default quality scores (`{}` when absent).
- `hourly_cleaning_schedule` targets `"raw_ingestion_data"`.
- `CrossStoreReconciler` offline comparison across PostgreSQL/Neo4j/OpenSearch record overrides (`tenant_id`, entity hash consistency).
- `QuarantineManager` list / replay / discard flow.

**2. What should I do?**
```powershell
cd data-engine
.\.venv\Scripts\python.exe -c "
from app.processing.schedules import cleaning_pipeline_job
from app.processing.reconciliation.reconciler import CrossStoreReconciler

print('Schedule asset selection:', cleaning_pipeline_job.selection)

rec = CrossStoreReconciler(tenant_id='val-tenant', entity_type='Customer')
pg_rows = [{'id': 'E1', 'canonical_name': 'Kwame Mensah', 'properties': {'city': 'Accra'}}]
neo_rows = [{'id': 'E1', 'canonical_name': 'Kwame Mensah', 'properties': {'city': 'Accra'}}]
os_rows = [{'id': 'E2', 'canonical_name': 'Ghost', 'properties': {'city': 'Kumasi'}}]
rep = rec.reconcile(pg_override=pg_rows, neo4j_override=neo_rows, opensearch_override=os_rows)
print('Reconciliation healthy?:', rep.is_healthy, 'report:', rep.to_dict())
"
```

**3. Expected Verification & Known Blockers:**  
- `cleaning_pipeline_job.selection` selects `raw_ingestion_data` (NOT `cleaning_raw`).  
- `CrossStoreReconciler` flags the PG/Neo4j vs OpenSearch drift cleanly (`is_healthy == False`).  
- Live Neo4j & OpenSearch reconciliation remain `BLOCKED` until `neo4j` package and Docker services are started (mark explicitly in `test-results/feature-status.md`).
