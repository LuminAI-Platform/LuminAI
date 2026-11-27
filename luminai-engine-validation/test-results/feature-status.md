# Master Feature Validation Status Matrix

Update each row strictly from manual verification results (do not mark `PASS` solely from pre-validation unit tests).

| Feature ID | Feature Name | Class | Manual Validation Status | Tier(s) Tested | Bug Report(s) | Notes |
|---|---|---|---|---|---|---|
| ING-01 | CSV / TSV / TXT Ingestion & Encoding Fallback | A | PENDING | | | |
| ING-02 | Parquet Ingestion | A | PENDING | | | |
| ING-03 | JSON / NDJSON Ingestion | A | PENDING | | | |
| ING-04 | Excel (`.xlsx`) Ingestion | A | PENDING | | | |
| ING-05 | MinIO Client & Safe Local Fallback | C | PENDING | | | |
| ING-06 | Pre-Flight Schema Upload API | A | PENDING | | | |
| ING-07 | Kafka Consumer & Producers | C | PENDING | | | Needs live Kafka broker for E2E; dry-run offline |
| ING-08 | XML Ingestion | D | NOT IMPLEMENTED | — | — | Documented only |
| PRF-01 | Deep Dataset Profiler (`DataProfiler`) | A | PENDING | | | |
| PRF-02 | `TypeInferenceEngine` & Leading-Zero Guard | A | PENDING | | | |
| PRF-03 | `SchemaDetector` Binary/Num & Ontology Map | A | PENDING | | | |
| PRF-04 | `DataQualityFramework` | B | PENDING | | | `referential_integrity` hardcoded 100.0 |
| PRF-05 | Dashboard Service & Quality Calculator | C | PENDING | | | PG Flyway live test requires DB creds |
| PRF-06 | AI Insights `DatasetProfiler` | A | PENDING | | | |
| VAL-01 | Pre-Flight >50% Sentinel Rejection Gate | A | PENDING | | | |
| VAL-02 | Dagster Quality Asset Checks | A | PENDING | | | |
| VAL-03 | Pipeline Quarantine & `EMAIL_REGEX` | A/C | PENDING | | | |
| VAL-04 | `IdentifierCleaner` | A | PENDING | | | |
| VAL-05 | Custom DSL / Coordinate Bounds | E | NOT IMPLEMENTED | — | — | |
| CLN-01 | `CleaningEngine` (5 Ops + Preview Index Alignment) | A | PENDING | | | |
| CLN-02 | `TextCleaner` (Mojibake / HTML / Formula) | A | PENDING | | | |
| CLN-03 | `DateCleaner` | A | PENDING | | | |
| CLN-04 | `NameStandardizer` | A | PENDING | | | |
| CLN-05 | `CategoricalStandardizer` | A | PENDING | | | |
| CLN-06 | `DatasetCleaner` (Blocks ≥200 Windowing) | A | PENDING | | | |
| CLN-07 | Dagster `cleaning_pipeline` | C | PENDING | | | |
| TRN-01 | `PipelineBuilderEngine` | A | PENDING | | | |
| STA-01 | `EdaEngine` Statistical Summaries & Correlation | A | PENDING | | | |
| STA-02 | `DuckDBAnalyticsEngine` | A/C | PENDING | | | |
| STA-03 | SQL Studio Read-Only Engine | A | PENDING | | | |
| STA-04 | `AIInsightsService` (Heuristic / LLM) | A/C | PENDING | | | |
| ADV-01 | `MachineLearningEngine` & `/predict` | A | PENDING | | | |
| ADV-02 | `ModelRegistryService` | A | PENDING | | | |
| ADV-03 | `MultiStageEntityResolver` | A | PENDING | | | |
| ADV-04 | `er/*` Blocking, Comparison & Contradiction Guard | A | PENDING | | | |
| ADV-05 | Golden Records & Rollback Audit | A/C | PENDING | | | |
| ADV-06 | Dagster `er_pipeline` | C | PENDING | | | |
| ADV-07 | `RelationalDecomposer` | A | PENDING | | | |
| ADV-08 | `relational_edges` | A/C | PENDING | | | |
| OUT-01 | Streaming Export + Header Sanitization | A/C | PENDING | | | |
| OUT-02 | Field Provenance (`0`/`False` preservation) | A/C | PENDING | | | |
| OUT-03 | `LineageTracker` & `GlobalLineageGraph` | B | PENDING | | | DB audit tables unwired |
| OUT-04 | `CrossStoreReconciler` | B/C | PENDING | | | `neo4j` package absent locally |
| OUT-05 | Pipeline Trigger, Run Tracker & Retry | A/C | PENDING | | | |
| OUT-06 | Dagster Recurring Cron Schedules | A | PENDING | | | |
| OUT-07 | Quarantine Replay / Discard API | A/C | PENDING | | | |
| INF-01 | DB Pool & Multi-Tenant `search_path` | A/C | PENDING | | | |
| INF-02 | Security Auth / JWT Safeguards | A/C | PENDING | | | |
| INF-03 | Rate Limit Proxy & Tenant Hardening | A/B | PENDING | | | Redis distributed mode absent |
| INF-04 | Structured Logging & OTel/Prometheus | A | PENDING | | | |
| INF-05 | Adversarial & Structural Robustness | A | PENDING | | | |
