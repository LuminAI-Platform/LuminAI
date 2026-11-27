# LuminAI Python Data Engine — Dependencies & Execution Environment

## 1. Python Runtime & Package Inventory (`data-engine/.venv`)

Verified via `uv pip list` in `data-engine/`:

- **Runtime**: Python `3.12.2` (`requires-python = ">=3.12"`, managed with `uv`)
- **Web & API**: `fastapi 0.136.1`, `uvicorn 0.46.0`, `starlette 1.0.0`, `pydantic 2.13.4`, `pydantic-settings 2.14.1`, `python-multipart 0.0.32`, `httpx 0.28.1`
- **DataFrames, IO & OLAP**: `polars 1.40.1`, `duckdb 1.5.2`, `pyarrow 24.0.0`, `pandas 2.3.3`, `numpy 2.4.4`, `fastexcel 0.21.0` *(newly added & installed; `openpyxl`/`xlsxwriter` are NOT installed)*
- **Orchestration & Messaging**: `dagster 1.13.8`, `dagster-webserver 1.13.8`, `confluent-kafka 2.14.0`, `alembic 1.18.4`, `sqlalchemy 2.0.49`, `pg8000 1.31.5`
- **Entity Resolution & ML**: `scikit-learn 1.8.0`, `scipy 1.17.1` (transitive), `joblib 1.5.3`, `jellyfish 1.2.1`, `dedupe 3.0.3` *(unused in `app/`)*, `recordlinkage 0.16` *(unused in `app/`)*
- **Security & Observability**: `pyjwt 2.14.0`, `cryptography 50.0.1`, `structlog 25.5.0`, `prometheus-client 0.26.0`, `opentelemetry-api 1.44.0`, `opentelemetry-sdk 1.44.0`
- **Dev/QA Tools**: `pytest 9.0.3`, `ruff 0.15.12`, `locust 2.46.6`

### Missing Optional / Documented External Packages
- `neo4j`: Not in `pyproject.toml` or `.venv` (live Neo4j reconciliation returns `[]` cleanly; offline dict override testing works).
- `redis`: Not installed (`RateLimitMiddleware` runs strictly in-memory).
- `xgboost`, `torch`, `mlflow`, `langchain`, `great-expectations`: Referenced in platform architecture docs only; not part of `data-engine/`.

---

## 2. Local Infrastructure Status & Testing Impact

| Service | Default Port | Local Status | Offline Fallback Behavior |
|---|---:|---|---|
| **PostgreSQL** | `5432` | Listening (local password auth mismatch for `luminai` user during tests) | Automatically falls back to local SQLite (`staging.db`, `er_staging.db`) |
| **MinIO / S3** | `9000` | Offline | `MinioRawStorageClient` falls back to `storage/raw/<bucket>/<key>` when non-production |
| **Kafka** | `9092` | Offline | Set `KAFKA_ENABLED=false` (default); producers dry-run returning `True` |
| **Neo4j** | `7687` | Offline | Testable via `pg_records`/`neo4j_records`/`opensearch_records` payload overrides in `CrossStoreReconciler` |
| **OpenSearch** | `9200` | Offline | Testable via payload overrides in `CrossStoreReconciler` |
| **Keycloak** | `8180` | Offline | Testable using local RS256 test keys (`PyJWT`) or mock tokens when `AUTH_ENABLED=true` and non-prod |

---

## 3. Baseline Test Suite Verification (After All 20 Fixes)

- `ruff check app tests/test_remediation_fixes.py tests/test_api_ml_studio.py tests/test_pipeline_retry.py tests/test_cleaning_pipeline.py`: **All checks passed**
- All **47** test files in `data-engine/tests/` (**493 tests total**): **493 passed, 0 failed, 0 skipped** across verified batch runs.
