# LuminAI Python Data Engine — Complete Feature Inventory (Post-Remediation)

Classification key:
- **A**: Implemented and independently testable
- **B**: Partially implemented or has known design limitations
- **C**: Implemented, depends on external infrastructure or another pipeline/module (has offline fallback or override mode)
- **D**: Present in docs or `pyproject.toml` only, not implemented in `data-engine/app/`
- **E**: Not implemented

---

## A. Data Ingestion & Storage

| ID | Feature | Class | Module & Entrypoint | Key Post-Fix Behavior / Known Boundaries |
|---|---|---|---|---|
| **ING-01** | CSV / TSV / TXT Byte & File Ingestion | **A** | `processing/minio_client/parsers.py` (`parse_raw_data_to_dataframe`), `processing/schema_detector/detector.py` (`validate_file_bytes`), `processing/engine/dataset_cleaner.py` (`clean_file`), `processing/engine/dataframe_utils.py` (`parse_csv_bytes_with_fallback`) | Strips UTF-8 BOM, attempts strict UTF-8 then `cp1252` with warning, falls back to lenient `ignore_errors`/`truncate_ragged_lines` with warning. Delimiters checked are `,` and `\t` (`.tsv`), not `;` or `|`. |
| **ING-02** | Parquet Byte & File Ingestion | **A** | `parsers.py`, `detector.py`, `dataset_cleaner.py` | Eager `pl.read_parquet` into RAM; `records_to_polars_df` handles mixed Python dict records cleanly. |
| **ING-03** | JSON & NDJSON / JSONL Ingestion | **A** | `parsers.py`, `detector.py`, `dataset_cleaner.py` | Supports JSON array-of-objects and NDJSON/JSONL. Wrapped single-object payloads (`{"data": [...]}`) are not unwrapped automatically. |
| **ING-04** | Excel (`.xlsx`, `.xls`) Ingestion | **A** *(upgraded from B)* | `parsers.py`, `detector.py` (`pl.read_excel`) | `fastexcel==0.21.0` now installed in `.venv`! Note `DatasetCleaner.clean_file` still targets CSV/JSON/Parquet rather than `.xlsx`. |
| **ING-05** | MinIO/S3 Object Storage & Local Fallback | **C** | `processing/minio_client/client.py` (`MinioRawStorageClient`), `auth.py` | `_safe_bucket` + `os.path.commonpath` traversal protection; fails loudly if both remote and local writes fail (or remote fails in production); >=100 MB chunks from RAM buffer. |
| **ING-06** | Pre-Flight Schema Upload & Path Endpoint | **A** | `api/processing/schemas.py` (`POST /process/validate-schema`, `/upload`) | Supports inline `content`, safe `file_path` (temp/`storage`/`data`), `object_key`, or multipart file upload. |
| **ING-07** | Kafka `ingest.raw` Consumer & Producers | **C** | `kafka/consumers.py`, `kafka/producers/` | Live broker tests require Kafka; unit/dry-run mode testable with `KAFKA_ENABLED=false`. |
| **ING-08** | XML Ingestion (`.xml`) | **D** | Docs only | Absent in `data-engine/app/`. |

---

## B. Data Profiling & Quality Scoring

| ID | Feature | Class | Module & Entrypoint | Key Post-Fix Behavior / Known Boundaries |
|---|---|---|---|---|
| **PRF-01** | Deep Column & Dataset Profiler | **A** | `processing/engine/profiler.py` (`DataProfiler`), `api/datasets_api.py` (`/analytics/datasets/profile`, `/preview`) | Uses `stats_utils.compute_numeric_summary` (`ddof=1` sample std/var, linear percentile, `NaN` filtering), 18 `NULL_SENTINELS`, mojibake check, and tracks distinct `invalid_row_indices`. |
| **PRF-02** | Type Inference & Leading-Zero Protection | **A** | `processing/engine/type_inference.py` (`TypeInferenceEngine`) | Infers 13 types, preserves leading-zero identifiers (`"001234"`), detects identifier column context (`id`, `code`, `mrn`, `ssn`, `sku`, etc.). |
| **PRF-03** | Schema Detector & Ontology Mapper | **A** | `processing/schema_detector/detector.py`, `type_parsers.py`, `ontology.py` | Shared `NULL_SENTINELS` across full DataFrame, excludes `bool`/non-finite numbers from numeric parsing, disambiguates `["0","1","2"]` as `NUMBER` vs `["true","false","1","0"]` as `BOOLEAN`, maps fuzzy properties to `Person`/`Organization`/`Product`/`Transaction`. |
| **PRF-04** | DAMA / ISO-25012 Quality Framework | **B** | `processing/engine/quality_framework.py` (`DataQualityFramework`) | Computes completeness, validity, consistency, uniqueness, accuracy (`VERIFIED`/`NEEDS_REVIEW`/`REJECTED`); `referential_integrity` remains hardcoded `100.0`; default mandatory fields `{name, id, email}`. |
| **PRF-05** | Dashboard Stats & Quality Calculator | **C** | `processing/dashboard_service/service.py`, `data_loader.py`, `quality_calculator.py`, `api/dashboard.py` | Adapts dynamically between Flyway `tenant_{slug}` UUID/`properties`/`entity_type` schemas and Alembic/SQLite schemas. Weighted quality: 25/30/20/15/10 (completeness/validity/uniqueness/consistency/timeliness). |
| **PRF-06** | AI Insights Profiler (`DatasetProfiler`) | **A** | `processing/ai_insights/analyzer.py` | Polars completeness, min/max/mean/stddev (`ddof=1`), IQR outlier bounds (`mean ± 2*stddev` fallback when `IQR == 0`), top-5 categories (≤100 unique). |

---

## C. Data Validation & Quality Gates

| ID | Feature | Class | Module & Entrypoint | Key Post-Fix Behavior / Known Boundaries |
|---|---|---|---|---|
| **VAL-01** | Pre-Flight >50% Null & Empty Gate | **A** | `schema_detector/detector.py` (`validate_dataframe`) | Counts sentinels/`NaN`/empty strings across the entire DataFrame (not just sample). Rejects with `422` when `reject_on_violation=True`. |
| **VAL-02** | Dagster Asset Quality Checks | **A** | `processing/checks/quality_checks.py` | Evaluates min rows, mandatory IDs (`0%` null max) & general `50%` null cap, value ranges (`age [0,150]`, non-future dates, `salary_amount >= 0`, `score >= 0`), and ER referential integrity. |
| **VAL-03** | Cleaning Pipeline Validator & Quarantine | **A/C** | `pipelines/cleaning_pipeline/cleaning_ops.py`, `kafka/quarantine.py` | Validates mandatory `id`/`name`, injection chars, `EMAIL_REGEX`, and `DateCleaner` validity; writes invalid rows to SQLite `quarantine.db` and `dead.letter`. |
| **VAL-04** | Identifier Validator | **A** | `processing/engine/identifier_cleaner.py` (`IdentifierCleaner`) | Validates SKU/SSN/MRN/ZIP/ID formats while guarding leading zeros. |
| **VAL-05** | Custom Rule DSL / Coord / Pct Bounds | **E** | — | Not implemented generically in validation engines. |

---

## D. Data Cleaning & Standardization

| ID | Feature | Class | Module & Entrypoint | Key Post-Fix Behavior / Known Boundaries |
|---|---|---|---|---|
| **CLN-01** | Interactive 5-Op Cleaning Engine | **A** | `processing/engine/cleaning_engine.py`, `cleaning_operations.py`, `api/cleaning_api.py` (`/analytics/cleaning/preview`, `/execute`) | Uniform `NaN`/empty/whitespace/`NULL_SENTINELS` mask across `remove_missing` & `fill_missing`; casts integer columns to `Float64` for fractional outlier caps; tracks original row indices in `preview_step` across deletions; emits `_is_missing_*`/`_is_outlier_*` flag columns. |
| **CLN-02** | Text, Mojibake, HTML & Formula Cleaner | **A** | `processing/engine/text_cleaner.py` (`TextCleaner`) | Fixes mojibake (`cp1252` fallback + map), `NFKC`, strips HTML tags (`<[^>]+>`), removes control/zero-width chars, neutralizes leading `=`/`@`/command `+-` formulas. |
| **CLN-03** | Calendar Date Parser & Validator | **A** | `processing/engine/date_cleaner.py` (`DateCleaner`) | Leap-year/month-day checks, epoch s/ms, partial `"c. YYYY"`/`"YYYY-MM"`, written English months, ISO timestamps, column `DMY`/`MDY` vote inference, future-date blocking. |
| **CLN-04** | Personal / Entity Name Standardizer | **A** | `processing/engine/name_standardizer.py` (`NameStandardizer`) | Smart casing (`McDonald`, `O'Connor`, `van der Beek`), `"Last, First"` reversal, placeholder & suspicious transposition detection; preserved cleanly by `cleaning_ops.py`. |
| **CLN-05** | Categorical Standardizer | **A** | `processing/engine/categorical_standardizer.py` | Normalizes Gender (rejects numeric `0,1,2,3`), Country (`gh`/`gha`/`ghana` → `Ghana`), City (incl. Ghanaian cities + `difflib` misspelling detection), Status. |
| **CLN-06** | Master Synchronous Dataset Cleaner | **A** | `processing/engine/dataset_cleaner.py` (`/process/dataset/clean`) | Full row-wise normalization + profiling before/after + `MultiStageEntityResolver` (now uses sorted-neighborhood sliding window `window=20` for blocks >= 200 rows) + `GoldenRecordEngine` + `DataQualityFramework`. |
| **CLN-07** | Dagster Async Cleaning Pipeline | **C** | `pipelines/cleaning_pipeline/` (`assets.py`, `cleaning_ops.py`, `deduplication.py`, `helpers.py`, `staging_ops.py`) | Fixed `_parse_currency_string` (returns `None`/`None` on invalid rather than `0.0 USD`, handles negatives & ISO prefixes), inverted blocking index dedup with dynamic `tenant_id`/`entity_type`, checkpoints & staging DB/Parquet output. |
| **CLN-08** | FX Conversion, Units, EU Decimal Comma | **E** | — | Not implemented (currency symbol extraction only). |

---

## E. Data Transformation & Pipeline Builder

| ID | Feature | Class | Module & Entrypoint | Key Post-Fix Behavior / Known Boundaries |
|---|---|---|---|---|
| **TRN-01** | DAG Transformation Pipeline Builder | **A** | `processing/engine/pipeline_builder.py`, `api/pipelines_builder_api.py` (`/analytics/pipelines/execute`) | Supports `FILTER`, `SELECT`, `DROP`, `RENAME`, `DERIVE` (now handles negative & scientific literals), `JOIN` (maps `outer`/`full_outer` → `full`), `GROUP_BY` (single agg col/fn), `SORT`, `DEDUPLICATE`. |
| **TRN-02** | Pivot/Melt, Pipeline Scaling/Encoding | **E** | — | Not implemented in `PipelineBuilderEngine`. |

---

## F & G. Statistical Analysis, OLAP, SQL Studio & EDA

| ID | Feature | Class | Module & Entrypoint | Key Post-Fix Behavior / Known Boundaries |
|---|---|---|---|---|
| **STA-01** | Exploratory Data Analysis (`EdaEngine`) | **A** | `processing/engine/eda_engine.py`, `api/eda_api.py` (`/analytics/eda/report`) | Sample variance/std (`ddof=1`), linear percentile interpolation, `NaN` exclusion, valid-denominator percentages + `pct_of_total`, zero-variance Pearson correlations kept as `None`. |
| **STA-02** | DuckDB OLAP & Export Engine | **A/C** | `processing/analytics_engine/engine.py`, `data_loader.py`, `query_builder.py`, `api/analytics.py` (`/query`, `/timeseries`, `/export`) | Flyway `tenant_{slug}` schema + UUID/JSONB compatibility, `normalize_dataframe` explicitly invoked in `export_data()`, sanitized `Content-Disposition` filename. |
| **STA-03** | SQL Studio Read-Only DuckDB Engine | **A** | `api/sql_studio_api.py` (`/analytics/sql/execute`) | `enable_external_access = false`, comment/literal stripping, extended `DISALLOWED_PATTERNS` blocking `CALL`/`SET`/`EXPORT`/`READ_CSV_AUTO`/etc., rejects multi-statement `;`, handles `EXPLAIN`/`DESCRIBE`/`SHOW`, raises `404` on failed `dataset_id` with no inline tables. |
| **STA-04** | AI & Heuristic Statistical Insights | **A/C** | `processing/ai_insights/service.py`, `generator.py` | Offline deterministic heuristic mode; Gemini/OpenAI modes require API key & network. |
| **STA-05** | NL-to-SQL (`/ai/nl-query`) | **D** | Docs only | Not implemented. |
| **STA-06** | Skewness, Kurtosis, Cov, Hypothesis Tests | **E** | — | Not implemented in `EdaEngine` (`scipy` unused). |

---

## H. Machine Learning, Entity Resolution & Graph Intelligence

| ID | Feature | Class | Module & Entrypoint | Key Post-Fix Behavior / Known Boundaries |
|---|---|---|---|---|
| **ADV-01** | ML Studio Train & Predict API | **A** *(upgraded from B)* | `processing/ml/ml_engine.py`, `api/ml_studio_api.py` (`/analytics/ml/train`, `/predict`) | Filters missing/corrupt targets before split; preprocessor & `StandardScaler` fit strictly inside train split; stratified classification split when feasible; optional `target_column` for `CLUSTERING`; persists `.joblib` artifact + supports `/analytics/ml/predict`. |
| **ADV-02** | ML Experiment & Model Registry | **A** *(upgraded from B)* | `processing/ml/ml_registry.py` (`/experiments`, `/models/register`, `/models`) | JSON experiment/registry tracking + `.joblib` artifacts in `storage/ml_registry` with sanitized tenant IDs. |
| **ADV-03** | Multi-Stage Entity Resolver | **A** | `processing/engine/deduplicator.py` | Exact/fuzzy blocking, semantic token weighting, non-null verified ID contradiction guard. |
| **ADV-04** | ER Blocking, Comparison, Classification, Clustering | **A** | `processing/er/{blocking,semantic,comparison,classification,clustering}.py` | Vectorized/chunked scoring fixes active empty-string weights via `_has_value` and enforces `DOMAIN_IDENTIFIER_FIELDS` contradiction guard in both scalar and chunk paths; UnionFind clustering; Flyway/Alembic `review_candidates`. |
| **ADV-05** | Golden Records, Versioning & Rollback | **A/C** | `processing/engine/golden_record_engine.py`, `er/golden_record/{merging,persistence,audit}.py`, `api/processing/golden_records.py` | Survivorship scoring, conflict capture, Flyway (`id`/`canonical_name`/`properties`/`source_count`) and Alembic/SQLite persistence + `golden_record_history` audit & rollback. |
| **ADV-06** | Dagster Entity Resolution Pipeline | **C** | `pipelines/er_pipeline/` (`assets.py`, `golden_ops.py`, `staging_ops.py`) | Pre-indexed `golden_records_df` source lookup ($O(C + G)$ instead of $O(C \times G)$); ER referential integrity check. |
| **ADV-07** | Relational Entity Decomposition | **A** | `processing/er/relational_decomposer.py`, `api/graph_api.py` (`/analytics/graph/decompose`) | Auto-detects 9 entity domains or runs explicit rules into entity tables + edge dicts. |
| **ADV-08** | Foreign-Key Relational Edges | **A/C** | `processing/er/relational_edges.py`, `api/processing/reconciliation.py` (`/process/edges/generate`) | Tenant schema / UUID aware on PostgreSQL; SQLite fallback cleanly targets `storage/sqlite/er_staging.db`. |
| **ADV-09** | `dedupe`/`recordlinkage`/XGBoost/PyTorch/MLflow | **D** | `pyproject.toml` / docs only | Not imported or wired in `app/`. |
| **ADV-10** | Cross-Validation, Feature Selection, PCA, IsolationForest | **E** | — | Not implemented. |

---

## I, J & K. Output, Orchestration, Reliability & Security

| ID | Feature | Class | Module & Entrypoint | Key Post-Fix Behavior / Known Boundaries |
|---|---|---|---|---|
| **OUT-01** | Streaming Analytics Export | **A/C** | `api/analytics.py` (`/analytics/export`), `analytics_engine/engine.py` | CSV/Parquet/JSON export; `normalize_dataframe` applied consistently; sanitized `Content-Disposition` filename. |
| **OUT-02** | Field Provenance Tracking | **A/C** | `processing/er/provenance.py` | Strips internal metadata keys while preserving `0`/`False` field values in `persist_provenance_records`. |
| **OUT-03** | Transformation Lineage Tracker | **B** | `processing/engine/lineage.py` | In-memory audit inside `DatasetCleaner`; DB lineage tables & `GlobalLineageGraph` remain unwired. |
| **OUT-04** | Cross-Store Reconciliation | **B/C** | `processing/reconciliation/reconciler.py`, `hashing.py` | Adapts to Flyway `tenant_{slug}` / `properties` PG columns; testable offline via record overrides; live Neo4j requires missing `neo4j` package. |
| **OUT-05** | Pipeline Trigger, Tracker, Retry & Checkpoints | **A/C** | `api/processing/pipelines.py`, `processing/trigger/`, `run_tracker/`, `checkpoint.py` | Propagates `entity_type` into Dagster tags; omits fabricated `quality_scores` (returns `{}` until populated). |
| **OUT-06** | Dagster Recurring Cron Schedules | **A** *(upgraded from B)* | `processing/schedules.py` | `hourly_cleaning_schedule` now selects `raw_ingestion_data`. |
| **OUT-07** | Quarantine / DLQ API | **A/C** | `api/processing/quarantine.py`, `kafka/quarantine.py` | SQLite/Kafka quarantine list, replay, discard. |
| **INF-01** | DB Pool & Alembic Migrations | **A/C** | `db/session.py`, `db/migrations.py`, `db/tenant.py` | QueuePool + `search_path` adaptation & SQLite fallback. |
| **INF-02** | Auth & RBAC Safeguards | **A/C** | `security.py` | JWT shape exempt from `"sandbox"` substring escalation; constant-time API key checks; production guards. |
| **INF-03** | Rate Limiting Middleware | **A/B** | `rate_limit.py` | Gated proxy/tenant headers + pipeline prefixes covering analytics/ML heavy endpoints (in-memory only). |
| **INF-04** | Logging, Prometheus & OTel Telemetry | **A** | `logging.py`, `telemetry/{metrics,tracing}.py` | Structured JSON logs with correlation `run_id`, `/metrics`, OTel spans. |
| **INF-05** | Security Hardening & Adversarial Defenses | **A** | Across `TextCleaner`, `SQL Studio`, `query_builder`, `MinioRawStorageClient`, `schemas.py` | Prompt/SQL/formula/path-traversal resistance testable across Domains A–S. |
