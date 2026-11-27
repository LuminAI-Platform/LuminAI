# LuminAI Python Data Engine — Architecture Overview (Post-Remediation)

This document maps the verified runtime architecture of `data-engine/` after completion of the 20 pre-validation fixes.

---

## 1. Entrypoints & Request Lifecycle

1. **FastAPI REST Application**: `data-engine/app/main.py` (`create_app()` → `uvicorn app.main:app --port 8000`)
   - Middleware stack: `CORSMiddleware` → `StructuredLoggingMiddleware` → `RateLimitMiddleware` (`X-Forwarded-For` trusted only when `settings.trust_proxy_headers=True`; `X-Tenant-ID` trusted only when paired with valid API key or non-production unauthenticated mode).
   - Authentication dependency (`app/security.py::get_current_identity`): public `/health`, `/`, `/metrics`; protected routers accept `X-API-Key` (validated via `secrets.compare_digest` when non-empty), Keycloak RS256/ES256 JWKS JWT, or explicit dev-only mock/sandbox tokens (`mock-*`, `sandbox-*` outside JWT structure `count(".") == 2` and blocked in production).
   - 10 protected route modules covering `/process/*`, `/analytics/*`, `/analytics/dashboard/*`, `/analytics/sql/*`, `/analytics/ml/*`, `/analytics/datasets/*`, `/analytics/cleaning/*`, `/analytics/pipelines/*`, `/analytics/eda/*`, `/analytics/graph/*`.

2. **Dagster Asset Orchestration**: `data-engine/app/processing/pipelines/` (`dagster_workspace.yaml` → `app.processing.pipelines.ingest_pipeline:defs`)
   - **Cleaning Pipeline (`cleaning_pipeline/`)**: `raw_ingestion_data` → `deduplicated_ingestion_data` → `cleaned_ingestion_data` → `validated_ingestion_data` → `staged_ingestion_data`.
   - **Entity Resolution Pipeline (`er_pipeline/`)**: `staged_records_for_er` → `er_blocked_pairs` → `er_scored_pairs` → `er_classified_pairs` → `er_golden_records`.
   - **Asset Checks (`checks/quality_checks.py`)**: 4 `@asset_check` gates verifying minimum rows, null thresholds, value ranges, and referential integrity.
   - **Schedules (`processing/schedules.py`)**: `hourly_cleaning_schedule` (selects `raw_ingestion_data`) and `daily_er_schedule`.

3. **Kafka Event Loop**: `app/kafka/consumers.py` (`IngestRawConsumer`) + `app/kafka/producers/`
   - Listens on `ingest.raw`, buffers micro-batches, invokes `DagsterTrigger`, routes failed records to `QuarantineManager` (`storage/sqlite/quarantine.db`) and `dead.letter`. Runs in dry-run/no-op mode when `KAFKA_ENABLED=false`.

---

## 2. Internal Processing Engines & Parallel Code Paths

Understanding these overlapping paths is critical so validation never tests only one implementation while assuming all three agree:

| Capability | Path 1 (Sync API / Polars) | Path 2 (Row-Wise Cleaner) | Path 3 (Dagster Async Assets) |
|---|---|---|---|
| **Cleaning** | `CleaningEngine` (`/analytics/cleaning/*`) | `DatasetCleaner` (`/process/dataset/clean`) | `cleaning_pipeline` (`/process/trigger`) |
| **Profiling / Quality** | `DataProfiler` & `DataQualityFramework` | `ai_insights.DatasetProfiler` | `dashboard_service.quality_calculator` |
| **Entity Resolution** | `MultiStageEntityResolver` (`deduplicator.py`) | `deduplication.py` (blocked windowing) | `er/*` + `er_pipeline/*` |
| **Analytics & SQL** | `EdaEngine` (`/analytics/eda/report`) | `DuckDBAnalyticsEngine` (`/analytics/*`) | `sql_studio_api` (`/analytics/sql/execute`) |

---

## 3. Storage & Dual-Schema Persistence Adaptation

`data-engine/app/db/tenant.py` provides safe tenant identifier helpers (`tenant_{slug}` schema resolution and deterministic UUIDv5 coercion) used across PostgreSQL persistence and read paths:
- **PostgreSQL Primary + Flyway Compatibility**: Supports both Core Backend Flyway `tenant_{slug}` schemas (`id`, `canonical_name`, `properties` JSONB, `source_count`) and legacy Alembic `public` schemas (`golden_id`, `attributes`, `cluster_size`).
- **Local Resilience Fallbacks** (automatically engaged when Docker infrastructure is offline):
  - `storage/sqlite/staging.db` (cleaned staging records)
  - `storage/sqlite/er_staging.db` (golden records, history, provenance, review candidates, relational edges)
  - `storage/sqlite/quarantine.db` (failed validation / DLQ records)
  - `storage/sqlite/run_storage.db` (Dagster/API run state & retry history)
  - `storage/raw/`, `storage/minio/`, `storage/checkpoints/`, `storage/ml_registry/` (JSON metadata + `.joblib` model artifacts)
