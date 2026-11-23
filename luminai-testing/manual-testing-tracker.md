# LuminAI Manual End-to-End Testing Progress Tracker

## 1. Overall Testing Status

| Total Tests Planned | Passed | Failed | Blocked | Not Implemented | Completion % |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **20** | **0** | **0** | **0** | **0** | **0%** |

*Last Updated*: 2026-11-23  
*Lead QA / Tester*: User Interactive Session  

---

## 2. Interactive Test Case Execution Tracker

| Stage | Test ID | Description | Primary Dataset | Status | Tester | Notes / Observations |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- |
| **Stage 1** | `TC-ENV-01` | Environment & Status Indicators | None | `[ ] PENDING` | User | Verify Network & Engine online pills |
| **Stage 2** | `TC-INGEST-01` | CSV File Upload & Parsing | `customers_small.csv` | `[ ] PENDING` | User | Verify 2,010 records ingested |
| **Stage 2** | `TC-INGEST-02` | TSV & JSON Ingestion | `orders_small.tsv`, `products_small.json` | `[ ] PENDING` | User | Verify tab delimiter & JSON parsing |
| **Stage 3** | `TC-PROF-01` | Statistical Profiling Metrics | `customers_small.csv` | `[ ] PENDING` | User | Compare credit_limit min/max with ground-truth |
| **Stage 4** | `TC-QUAL-01` | Data Quality & Null Detection | `customers_small.csv` | `[ ] PENDING` | User | Verify email/phone missing count flags |
| **Stage 5** | `TC-CLEAN-01` | 5-Op Cleaning Recipe Execution | `customers_small.csv` | `[ ] PENDING` | User | Dedupe, trim, case, fill missing, clip outliers |
| **Stage 6** | `TC-VERS-01` | Dataset Versioning & Immutability | `customers_small.csv` (v1 vs v2) | `[ ] PENDING` | User | Verify v1 intact; v2 cleaned |
| **Stage 7** | `TC-ER-01` | Entity Resolution & Merge Review | `fuzzy_duplicates_er.csv` | `[ ] PENDING` | User | Scan candidates and approve merge |
| **Stage 8** | `TC-SCHEMA-01` | Relational Decomposition | `orders_small.tsv` | `[ ] PENDING` | User | Extract Customer, Order, Product nodes & edges |
| **Stage 9** | `TC-ONT-01` | Ontology Entity & Relation Creation | N/A | `[ ] PENDING` | User | Create `Warehouse` and `STOCKS` relation |
| **Stage 10** | `TC-PIPE-01` | Transformation DAG Execution | `transactions_small`, `customers_small` | `[ ] PENDING` | User | Filter, derive net_amt, join, group by region |
| **Stage 11** | `TC-SQL-01` | SQL Studio Query & Security AST | `orders_small.tsv` | `[ ] PENDING` | User | Run SELECT query; verify DROP TABLE blocked |
| **Stage 12** | `TC-CURAT-01` | Curated Dataset Publication | Pipeline Output | `[ ] PENDING` | User | Publish `curated_regional_revenue` with lineage |
| **Stage 13** | `TC-ML-01` | Supervised Model Training | `customers_small.csv` | `[ ] PENDING` | User | Train Random Forest & Logistic Regression |
| **Stage 14** | `TC-ML-02` | Champion Promotion & Registry | ML Models | `[ ] PENDING` | User | Promote champion; verify single-champion constraint |
| **Stage 15** | `TC-GRAPH-01` | Graph Neighborhood & Shortest Path | Neo4j Graph | `[ ] PENDING` | User | Expand 1-hop; calculate shortest path |
| **Stage 16** | `TC-AI-01` | Fact-Based Automated Insights | `curated_regional_revenue` | `[ ] PENDING` | User | Verify insights match SQL numbers |
| **Stage 17** | `TC-SEC-01` | Multi-Tenant Data Isolation | `customers_small.csv` | `[ ] PENDING` | User | Verify Tenant B cannot query Tenant A data |
| **Stage 18** | `TC-STRESS-01` | 100k Parquet Stress & Virtual DOM | `operational_events_stress.parquet`| `[ ] PENDING` | User | Test 100k scroll FPS and memory stability |
| **Security** | `SEC-01..06` | Security & Vulnerability Probes | Edge-case datasets | `[ ] PENDING` | User | Formula injection, XSS, Path traversal checks |

---

## 3. Discovered Defects & Blocker Log

| Defect ID | Associated Test ID | Severity | Description | Status | Resolution Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `DEF-001` | `TC-INGEST-01` | P0 (Critical) | Infinite skeleton loader loop on `/connections` page caused by unmemoized `tabState` triggering repeated re-renders. | **FIXED** | Fixed in commit `b994ad4` (memoized `useConnectionsTab`, separated `adjustTabIfEmpty`, guarded with `initialLoadDoneRef`). Requires rebuild/redeploy on Lightsail. |
