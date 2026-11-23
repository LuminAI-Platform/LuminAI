# LuminAI Comprehensive Manual End-to-End Testing Guide

## 1. Introduction & Tester Instructions

This guide provides an exhaustive, step-by-step manual test procedure for verifying the complete **LuminAI** enterprise data platform.

### Testing Principles
1. **Human Execution Only**: All steps below are designed for manual interactive execution via the LuminAI web browser interface.
2. **Ground-Truth Baseline**: Compare all UI metrics, row counts, null percentages, and cleaning results against `luminai-testing/ground-truth/manifest.json`.
3. **Evidence Recording**: Log screenshots, network inspection payloads (DevTools Network tab), and test outcomes in `luminai-testing/manual-testing-tracker.md`.
4. **Result Taxonomy**:
   - `PASS`: Functionality behaves exactly as documented.
   - `FAIL`: Feature executed, but returned incorrect data, crashed, or exhibited UI/UX regression.
   - `BLOCKED`: Dependency failure prevents completing the step.
   - `NOT IMPLEMENTED`: Feature UI button or endpoint is missing or mock/unwired.

---

## Stage 1: Environment Verification & Initial State Check

### TC-ENV-01: System Status & Health Indicators
- **Feature / Capability**: Platform Health & Connectivity Telemetry
- **Objective**: Verify that the Core Backend, Python Data Engine, and database connectivity are operational.
- **Why This Test Matters**: Ingestion, profiling, and ML pipelines fail immediately if services or workers are disconnected.
- **Prerequisites**: LuminAI services running locally or on Lightsail.
- **Dataset / File**: None
- **Navigation**: Open browser to `http://localhost:5173` (or deployed URL `https://luminai.luminex-logistics.com`). Inspect bottom status bar.
- **Step-by-Step Instructions**:
  1. Observe the footer status bar at the bottom of the screen.
  2. Verify the "Network" indicator pill.
  3. Verify the "Engine" indicator pill.
- **Expected Behavior**: The application establishes heartbeat communication with the backend.
- **Expected Output**:
  - `Network: Connected` (green or checked pill).
  - `Engine: Online` (green indicator).
- **How to Verify**: Status indicators remain green. Open browser DevTools Console: no persistent 502/504 errors.
- **Failure Indicators**: Red `Engine: Offline`, infinite polling retries, banner stating backend unreachable.
- **Related Features**: CAP-22 (Telemetry), Engine Status Bar
- **Evidence to Capture**: Screenshot of bottom footer.
- **Result**: [PASS / FAIL / BLOCKED / NOT IMPLEMENTED]

---

## Stage 2: Data Source Connection & Ingestion (Small Scale)

### TC-INGEST-01: CSV File Upload & Parsing
- **Feature / Capability**: CAP-03 (Connections & File Ingestion)
- **Objective**: Verify that a multi-column dirty CSV file can be uploaded, stored, and parsed with schema detection.
- **Why This Test Matters**: Ingestion is the entry gate for all enterprise data foundations.
- **Prerequisites**: Logged in as Admin/Engineer.
- **Dataset / File**: `luminai-testing/datasets/small/customers_small.csv` (2,010 rows).
- **Navigation**: Click **Data Connections** in the sidebar (or navigate to `/connections`).
- **Step-by-Step Instructions**:
  1. On the Data Connections page, click the `+ New connection` (or `Upload file`) button.
  2. Drag and drop or browse to select `luminai-testing/datasets/small/customers_small.csv`.
  3. In the upload wizard Step 1, verify file metadata (file size, extension `csv`).
  4. Proceed to Step 2 ("Schema Preview"). Inspect the parsed columns.
  5. Click **Confirm & Ingest**.
- **Expected Behavior**: File is uploaded to storage, parsed with Polars, registered in the connection catalog.
- **Expected Output**:
  - Upload wizard reports successful ingestion of 2,010 records.
  - On `/connections`, under tab `Flat files & datasets`, `customers_small.csv` appears with status `Connected`.
  - Row count shows 2,010.
- **How to Verify**: Click the connection row to inspect raw schema preview. Verify 11 detected columns (`customer_id`, `full_name`, `email`, `phone`, `national_id`, etc.).
- **Failure Indicators**: Upload fails with 500 error, skeleton loader hangs indefinitely, or column names are offset.
- **Related Features**: CAP-03, CAP-04, CAP-06
- **Evidence to Capture**: Screenshot of completed ingestion modal and the updated connections table.
- **Result**: [PASS / FAIL / BLOCKED / NOT IMPLEMENTED]

### TC-INGEST-02: TSV & JSON Multi-Format Ingestion
- **Feature / Capability**: CAP-03 (Alternative Delimiters & Structured Formats)
- **Objective**: Verify ingestion of Tab-Separated Values (`.tsv`) and JSON array (`.json`).
- **Why This Test Matters**: Enterprise data originates from diverse systems (REST APIs, legacy TSV exports).
- **Prerequisites**: TC-INGEST-01 passed.
- **Dataset / File**:
  - `luminai-testing/datasets/small/orders_small.tsv` (3,000 rows)
  - `luminai-testing/datasets/small/products_small.json` (15 objects)
- **Navigation**: `/connections` -> Click `+ New connection`.
- **Step-by-Step Instructions**:
  1. Upload `orders_small.tsv`. Verify that tab delimiters are auto-detected without column merging.
  2. Complete wizard.
  3. Upload `products_small.json`. Verify that JSON array keys are detected as columns.
  4. Complete wizard.
- **Expected Behavior**: Both formats parse cleanly into tabular representations.
- **Expected Output**:
  - `orders_small.tsv` listed with 3,000 rows.
  - `products_small.json` listed with 15 rows.
- **How to Verify**: Click "Preview" action on each source row and verify column alignment.
- **Failure Indicators**: TSV parses as single column with embedded tabs; JSON shows "[object Object]".
- **Related Features**: CAP-03, Format Matrix
- **Evidence to Capture**: Screenshot of the Connections table displaying all 3 sources.
- **Result**: [PASS / FAIL / BLOCKED / NOT IMPLEMENTED]

---

## Stage 3: Data Profiling & Exploration

### TC-PROF-01: Statistical Profiling Verification
- **Feature / Capability**: CAP-04 (Polars Statistical Profiling)
- **Objective**: Verify that statistical metrics calculated by LuminAI match independent ground-truth.
- **Why This Test Matters**: Inaccurate profiling leads to erroneous data cleaning recipes and flawed analytical conclusions.
- **Prerequisites**: `customers_small.csv` ingested (TC-INGEST-01).
- **Dataset / File**: `luminai-testing/datasets/small/customers_small.csv`
- **Navigation**: Navigate to **Dataset Catalog** (`/datasets`) -> Click on `customers_small.csv` to open Dataset Detail view.
- **Step-by-Step Instructions**:
  1. Open the "Data Profile" / "Overview" tab.
  2. Inspect the total row count and column count.
  3. Inspect column `credit_limit`: look at Min, Max, Mean, and Quantiles.
  4. Compare with `luminai-testing/ground-truth/profiling/customers_small.csv.json`.
- **Expected Behavior**: Polars profiler renders exact statistical distribution.
- **Expected Output**:
  - Total Rows: `2,010`
  - Total Columns: `11`
  - Column `credit_limit` Min: `-1000.0` (deliberate negative anomaly)
  - Column `credit_limit` Max: `9999999.0` (deliberate extreme anomaly)
- **How to Verify**: Numbers on screen match ground-truth JSON within rounding precision.
- **Failure Indicators**: Null values shown as zero; min/max NaN; profiler spinner runs indefinitely.
- **Related Features**: CAP-04, Data Quality Framework
- **Evidence to Capture**: Screenshot of `credit_limit` distribution card.
- **Result**: [PASS / FAIL / BLOCKED / NOT IMPLEMENTED]

---

## Stage 4: Data Quality Assessment & Validation

### TC-QUAL-01: Null & Anomaly Flagging
- **Feature / Capability**: CAP-04, CAP-05 (Data Quality Rules)
- **Objective**: Verify that LuminAI detects missing values in `email` and `phone` columns.
- **Why This Test Matters**: Downstream CRM and communication workflows fail if missing contact details are not surfaced.
- **Prerequisites**: TC-INGEST-01 passed.
- **Dataset / File**: `customers_small.csv`
- **Navigation**: `/datasets/$datasetId` -> Click "Quality & Validation" tab.
- **Step-by-Step Instructions**:
  1. Inspect the Completeness dimension score.
  2. Locate the column breakdown for `email` and `phone`.
  3. Verify the flagged missing/null counts.
- **Expected Behavior**: LuminAI highlights completeness deficiencies (~6% missing emails, ~4% missing phones).
- **Expected Output**:
  - `email`: ~120 missing/empty records flagged.
  - `phone`: ~80 missing records flagged.
- **How to Verify**: Missing count aligns with ground-truth manifest.
- **Failure Indicators**: 100% completeness score reported despite empty email fields.
- **Related Features**: CAP-04, CAP-05
- **Evidence to Capture**: Screenshot of Quality Dimension radar or score table.
- **Result**: [PASS / FAIL / BLOCKED / NOT IMPLEMENTED]

---

## Stage 5: Data Cleaning & Preparation

### TC-CLEAN-01: 5-Operation Cleaning Recipe Execution
- **Feature / Capability**: CAP-05 (Cleaning Engine: Deduplicate, Trim, Case, Fill Missing, Outliers)
- **Objective**: Execute a multi-step cleaning recipe on `customers_small.csv` and verify preview diffs and output dataset.
- **Why This Test Matters**: Raw data must be cleansed before publication to curated foundations.
- **Prerequisites**: TC-INGEST-01 passed.
- **Dataset / File**: `customers_small.csv`
- **Navigation**: `/connections` -> Find `customers_small.csv` -> Click **Clean** action button (opens Clean Data Modal).
- **Step-by-Step Instructions**:
  1. **Step 1 - Deduplicate**: Select operation `Deduplicate`, subset: `All columns`, keep: `First`.
  2. **Step 2 - Standardize Text**: Select column `full_name`, operation `Trim whitespace`, case: `Title Case`.
  3. **Step 3 - Fill Missing**: Select column `email`, strategy `Constant`, value: `unspecified@afrilink.com.gh`.
  4. **Step 4 - Handle Outliers**: Select column `credit_limit`, method `IQR (1.5x)`, action: `Cap values (Clip)`.
  5. Click **Preview Cleaning Results**.
  6. Inspect the before/after preview diff and telemetry strip.
  7. Click **Apply & Save Cleaned Dataset**.
- **Expected Behavior**:
  - Preview displays exactly 10 duplicate rows removed (row count reduces from 2,010 to 2,000).
  - Padded spaces removed from `full_name` ("  Kwesi Mensah " becomes "Kwesi Mensah").
  - Empty emails populated with constant.
  - Negative and extreme credit limits clipped to IQR thresholds.
- **Expected Output**: Cleaned dataset generated with 2,000 rows and 0 exact duplicates.
- **How to Verify**: View the newly created cleaned dataset in `/datasets`. Verify row count is 2,000.
- **Failure Indicators**: Deduplication removes 0 rows; whitespace persists; credit limits unchanged.
- **Related Features**: CAP-05, CAP-06
- **Evidence to Capture**: Screenshot of the Clean Data Telemetry Strip and before/after diff table.
- **Result**: [PASS / FAIL / BLOCKED / NOT IMPLEMENTED]

---

## Stage 6: Dataset Versioning & Immutability

### TC-VERS-01: Immutable Version Creation & Rollback
- **Feature / Capability**: CAP-06 (Dataset Catalog Versioning)
- **Objective**: Verify that cleaning recipes produce a new immutable dataset version (e.g. `v2`) while preserving `v1` intact.
- **Why This Test Matters**: Palantir Foundry benchmark requirement: every processing stage must be auditable and reproducible without mutating raw inputs.
- **Prerequisites**: TC-CLEAN-01 completed.
- **Dataset / File**: `customers_small.csv`
- **Navigation**: Navigate to `/datasets` -> Select the customer dataset -> Click "Versions / History" tab.
- **Step-by-Step Instructions**:
  1. Verify the list of versions: `v1 (Raw Ingested)` and `v2 (Cleaned)`.
  2. Inspect row counts: `v1` must show 2,010 rows; `v2` must show 2,000 rows.
  3. Click "Download" or "Preview" on `v1`: verify raw duplicates and whitespace are still present in `v1`.
- **Expected Behavior**: The raw file was not overwritten; versioning maintains separate Parquet/data files in MinIO.
- **Expected Output**: Both versions accessible with distinct version hashes and creation timestamps.
- **How to Verify**: Switching between `v1` and `v2` updates the preview table with the respective state.
- **Failure Indicators**: `v1` row count shows 2,000 (meaning in-place destructive mutation occurred).
- **Related Features**: CAP-06, CAP-16 (Lineage)
- **Evidence to Capture**: Screenshot of Dataset Version History list.
- **Result**: [PASS / FAIL / BLOCKED / NOT IMPLEMENTED]

---

## Stage 7: Entity Resolution & Deduplication (Merge Review)

### TC-ER-01: Fuzzy Duplicate Candidate Scanning & Resolution
- **Feature / Capability**: CAP-11, CAP-12 (Entity Resolution & Merge Review)
- **Objective**: Upload `fuzzy_duplicates_er.csv` and verify that LuminAI identifies matching pairs and supports manual merge approval.
- **Why This Test Matters**: Multi-source enterprise environments frequently contain slight phonetic or typographical discrepancies for the same individual.
- **Prerequisites**: TC-INGEST-01 passed.
- **Dataset / File**: `luminai-testing/datasets/edge-cases/fuzzy_duplicates_er.csv` (10 rows).
- **Navigation**:
  1. Ingest `fuzzy_duplicates_er.csv` via `/connections`.
  2. Navigate to **Merge Review** (`/connections/merge-review`).
- **Step-by-Step Instructions**:
  1. On `/connections/merge-review`, click **Run Candidate Scan**.
  2. Select dataset `fuzzy_duplicates_er.csv`. Set similarity threshold to `0.80`.
  3. Wait for the scan to finish.
  4. Inspect the detected candidate pairs in the Candidates Sidebar.
  5. Select Pair 1 ("Kwesi Mensah" vs "Kwesi Mensah", transposed phone).
  6. In Candidate Inspector, review field-by-field similarity scores.
  7. Click **Merge Entities** (or **Approve Merge**).
- **Expected Behavior**:
  - The scanning algorithm identifies the 4 injected matching pairs.
  - Non-matching controls (Yaw Dzogbe, Peter Anang) are not paired.
  - Approving merge creates a consolidated Golden Record.
- **Expected Output**: Candidate list displays pairs with Jaro-Winkler confidence $\ge 0.85$. Golden Record successfully resolved.
- **How to Verify**: Navigate to `/explorer` and search for "Kwesi Mensah". Verify single golden record exists with merged attributes.
- **Failure Indicators**: Scanner finds 0 candidates; crashes on string comparison; merge fails to update golden records.
- **Related Features**: CAP-11, CAP-12, CAP-21 (Explorer)
- **Evidence to Capture**: Screenshot of Candidate Inspector with similarity scores.
- **Result**: [PASS / FAIL / BLOCKED / NOT IMPLEMENTED]

---

## Stage 8: Visual Schema Studio & Relational Decomposition

### TC-SCHEMA-01: Relational Decomposition into Entities & Edges
- **Feature / Capability**: CAP-09, CAP-10 (Schema Studio & Relational Decomposer)
- **Objective**: Map a flat transactional dataset (`orders_small.tsv`) into ontology entities (`Customer`, `Order`, `Product`) and generate graph edges.
- **Why This Test Matters**: Solves the core enterprise problem where relational tables are collapsed into single flat properties.
- **Prerequisites**: TC-INGEST-02 passed.
- **Dataset / File**: `orders_small.tsv` (3,000 rows).
- **Navigation**: Navigate to **Schema Studio** (`/connections/schema-map`).
- **Step-by-Step Instructions**:
  1. Select Source: `orders_small.tsv`.
  2. Map column `customer_id` -> Target Entity Type: `Customer`.
  3. Map column `order_id` -> Target Entity Type: `Order`.
  4. Map column `product_id` -> Target Entity Type: `Product`.
  5. Define Relationship 1: `(Customer)-[:PLACED]->(Order)`.
  6. Define Relationship 2: `(Order)-[:CONTAINS]->(Product)`.
  7. Click **Decompose & Sync to Graph**.
- **Expected Behavior**: The `RelationalDecomposer` extracts distinct nodes for Customers, Orders, and Products and populates Neo4j edges.
- **Expected Output**:
  - Toast message / modal confirms successful decomposition.
  - Golden records inserted into PostgreSQL for each entity type.
  - Edges created connecting placed orders to customer IDs.
- **How to Verify**: Navigate to `/graph` or `/explorer`. Filter by Entity Type `Order`. Verify orders exist as first-class entities.
- **Failure Indicators**: All records flatten into entity type "Person"; decomposition times out; Neo4j sync error.
- **Related Features**: CAP-09, CAP-10, CAP-19 (Graph)
- **Evidence to Capture**: Screenshot of Schema Studio mapping ribbon and successful decomposition summary.
- **Result**: [PASS / FAIL / BLOCKED / NOT IMPLEMENTED]

---

## Stage 9: Ontology Creation & Graph Modeling

### TC-ONT-01: Custom Entity Type & Relationship Definition
- **Feature / Capability**: CAP-07, CAP-08 (Ontology Management)
- **Objective**: Create a new ontology entity type `Warehouse` and establish relationship `(Warehouse)-[:STOCKS]->(Product)`.
- **Why This Test Matters**: Empowers business analysts to extend the enterprise ontology without database schema migrations.
- **Prerequisites**: TC-SCHEMA-01 passed.
- **Dataset / File**: None
- **Navigation**: Click **Ontology** in the sidebar (navigate to `/ontology`).
- **Step-by-Step Instructions**:
  1. On the Ontology page, click **+ Add Entity Type**.
  2. Enter Name: `Warehouse`.
  3. Add Properties: `warehouse_id` (Identifier, String), `location` (String), `capacity_sqm` (Number).
  4. Select an icon and color. Click **Save Entity Type**.
  5. Switch to "Relationships" tab. Click **+ Add Relationship**.
  6. Select Source: `Warehouse`, Target: `Product`, Relation: `STOCKS`, Cardinality: `1:N`.
  7. Click **Save Relationship**.
- **Expected Behavior**: Entity type and relationship are persisted in backend database and registered in Neo4j meta-model.
- **Expected Output**: `Warehouse` appears in the Ontology entity types list with active schema status.
- **How to Verify**: In `/ontology`, search for `Warehouse`. Verify properties and outgoing `STOCKS` relationship are rendered.
- **Failure Indicators**: Form submission throws validation error; entity disappears after page refresh.
- **Related Features**: CAP-07, CAP-08, CAP-19
- **Evidence to Capture**: Screenshot of the newly created `Warehouse` entity card in Ontology.
- **Result**: [PASS / FAIL / BLOCKED / NOT IMPLEMENTED]

---

## Stage 10: Data Transformation Pipelines (Visual Pipeline Builder)

### TC-PIPE-01: Multi-Step Transformation DAG Execution
- **Feature / Capability**: CAP-13, CAP-14 (Pipeline Builder & Lazy Execution Engine)
- **Objective**: Build and execute a data transformation pipeline: Filter -> Derive Column -> Join -> Group By.
- **Why This Test Matters**: Core analytics engineering lifecycle: transforming raw transactional feeds into dimensional metrics.
- **Prerequisites**: TC-INGEST-01, TC-INGEST-02 completed.
- **Dataset / File**: `transactions_small.csv` and `customers_small.csv`.
- **Navigation**: Navigate to **Pipeline Builder** (`/connections/pipeline`).
- **Step-by-Step Instructions**:
  1. Click **Create New Pipeline**. Enter Name: `Customer Revenue Aggregation`.
  2. Add Source Node 1: `transactions_small.csv`.
  3. Add Transform Node: **Filter** -> `amount > 0` AND `status == 'COMPLETED'`.
  4. Add Transform Node: **Derive** -> `net_amount = amount - fee`.
  5. Add Source Node 2: `customers_small.csv`.
  6. Add Transform Node: **Join** -> Inner Join on `customer_id`.
  7. Add Transform Node: **Group By** -> Group by `region`, Aggregate: `sum(net_amount) AS total_revenue`, `count(transaction_id) AS total_txns`.
  8. Click **Compile & Run Pipeline**.
- **Expected Behavior**: Backend validates DAG, compiles execution plan, executes lazy Polars transformations, registers output dataset.
- **Expected Output**:
  - Run status transitions from `PENDING` -> `RUNNING` -> `COMPLETED`.
  - Result preview displays aggregated table with 10 Ghanaian regions and their respective revenue totals.
- **How to Verify**: Check the output table preview. Total transaction count across regions matches completed count in ground truth.
- **Failure Indicators**: Cyclic dependency error; join on string mismatch; pipeline fails without backtrace.
- **Related Features**: CAP-13, CAP-14, CAP-23 (Pipeline Monitor)
- **Evidence to Capture**: Screenshot of the completed Pipeline DAG canvas and execution summary.
- **Result**: [PASS / FAIL / BLOCKED / NOT IMPLEMENTED]

---

## Stage 11: SQL Studio & Analytical Querying

### TC-SQL-01: DuckDB Analytics Query & Security Isolation
- **Feature / Capability**: CAP-15 (SQL Studio & AST Security Check)
- **Objective**: Execute multi-table ANSI SQL analytical queries; verify that write operations (DROP, INSERT, UPDATE) are blocked.
- **Why This Test Matters**: Business analysts require zero-copy SQL access without risk of accidental data mutation or SQL injection.
- **Prerequisites**: Datasets ingested in Stage 2.
- **Dataset / File**: `orders_small` and `products_small`.
- **Navigation**: Navigate to **SQL Studio** (`/analytics/sql`).
- **Step-by-Step Instructions**:
  1. In the query editor, enter the analytical query:
     ```sql
     SELECT 
       category,
       COUNT(*) AS order_count,
       ROUND(SUM(total_amount), 2) AS total_sales,
       ROUND(AVG(discount_rate), 4) AS avg_discount
     FROM orders_small
     GROUP BY category
     ORDER BY total_sales DESC;
     ```
  2. Click **Execute (Ctrl+Enter)**.
  3. Verify the returned table, execution time (< 150ms), and row count.
  4. Now test security AST validation by entering:
     ```sql
     DROP TABLE orders_small;
     ```
  5. Click **Execute**.
- **Expected Behavior**:
  - Analytical `SELECT` query runs against DuckDB and renders results in milliseconds.
  - `DROP TABLE` query is immediately intercepted and blocked by the SQL validator.
- **Expected Output**:
  - Valid query returns 7 product categories with calculated totals.
  - Destructive query produces error: `"Write and DDL operations are forbidden in read-only SQL Studio"`.
- **How to Verify**: Output table renders; subsequent `SELECT * FROM orders_small` confirms table still exists.
- **Failure Indicators**: `DROP TABLE` executes; or valid `SELECT` throws syntax error.
- **Related Features**: CAP-15, CAP-25 (Security)
- **Evidence to Capture**: Screenshot of query result table and the blocked DDL alert banner.
- **Result**: [PASS / FAIL / BLOCKED / NOT IMPLEMENTED]

---

## Stage 12: Curated Dataset Publication

### TC-CURAT-01: Publishing Transformed Data to Curated Foundation
- **Feature / Capability**: CAP-06, CAP-16 (Curated Catalog & Lineage Tracking)
- **Objective**: Publish the output of TC-PIPE-01 as a gold-standard curated enterprise dataset `curated_regional_revenue`.
- **Why This Test Matters**: Downstream BI tools, dashboards, and machine learning models must consume verified curated assets.
- **Prerequisites**: TC-PIPE-01 passed.
- **Dataset / File**: TC-PIPE-01 Pipeline Output.
- **Navigation**: `/connections/pipeline` -> Pipeline Details -> Click **Publish to Catalog**.
- **Step-by-Step Instructions**:
  1. Click **Publish as Curated Dataset**.
  2. Enter Name: `curated_regional_revenue`.
  3. Description: `Cleansed, reconciled regional sales revenue across West African hubs`.
  4. Tag: `Gold Foundation`, Retention: `Permanent`.
  5. Click **Publish**.
- **Expected Behavior**: Dataset is written as Snappy Parquet in MinIO `storage/curated/`, indexed in PostgreSQL catalog.
- **Expected Output**: `curated_regional_revenue` appears in `/datasets` with `CURATED` badge and lineage badge.
- **How to Verify**: Click on dataset. Verify lineage graph displays source nodes (`transactions_small`, `customers_small`) connected via the pipeline.
- **Failure Indicators**: Lineage disconnected; dataset missing from catalog; file write error.
- **Related Features**: CAP-06, CAP-16
- **Evidence to Capture**: Screenshot of Curated Dataset in Catalog with Lineage tab open.
- **Result**: [PASS / FAIL / BLOCKED / NOT IMPLEMENTED]

---

## Stage 13: Machine Learning — Model Training & Evaluation

### TC-ML-01: Supervised Model Training (Customer Churn / Tier Classification)
- **Feature / Capability**: CAP-17 (ML Engine, Scikit-Learn Training)
- **Objective**: Train a Random Forest and Logistic Regression classifier to predict customer tier/activity.
- **Why This Test Matters**: Operational applications rely on predictive scoring connected to the governed data foundation.
- **Prerequisites**: TC-INGEST-01 passed.
- **Dataset / File**: `customers_small.csv` (or `customers_medium.csv`).
- **Navigation**: Navigate to **Model Workbench** (`/datascience/models`).
- **Step-by-Step Instructions**:
  1. Click **+ New Model Experiment**.
  2. Select Training Dataset: `customers_small.csv`.
  3. Select Model Type: **Classification (Random Forest)**.
  4. Select Target Feature: `tier`.
  5. Select Input Features: `credit_limit`, `region`, `is_active`.
  6. Set Train/Test Split: `80 / 20`.
  7. Click **Start Training Job**.
  8. Repeat with Model Type: **Logistic Regression**.
- **Expected Behavior**: Data Engine spawns asynchronous scikit-learn training pipeline; calculates metrics (Accuracy, F1-Score, ROC-AUC, Confusion Matrix).
- **Expected Output**: Both experiment runs appear on the Experiment Leaderboard with valid metric scores (e.g. Accuracy ~0.82).
- **How to Verify**: Click on the completed Random Forest run to view Confusion Matrix and Feature Importance chart.
- **Failure Indicators**: Training worker fails; NaN metrics; UI stuck on "Training...".
- **Related Features**: CAP-17, CAP-18
- **Evidence to Capture**: Screenshot of the Experiment Leaderboard and feature importance graph.
- **Result**: [PASS / FAIL / BLOCKED / NOT IMPLEMENTED]

---

## Stage 14: ML Model Registry, Leaderboard & Champion Promotion

### TC-ML-02: Champion Model Promotion & Artifact Serving
- **Feature / Capability**: CAP-18 (Model Registry & Champion Governance)
- **Objective**: Promote the top-performing model to `Champion` status; verify single-champion constraint and artifact durability.
- **Why This Test Matters**: Governance rule: only one production champion may be active per scope, preventing conflicting predictions.
- **Prerequisites**: TC-ML-01 completed.
- **Dataset / File**: Model runs from TC-ML-01.
- **Navigation**: `/datascience/models` -> Select the Random Forest model run.
- **Step-by-Step Instructions**:
  1. Click **Promote to Champion**.
  2. Enter Justification: `Outperformed Logistic Regression on validation F1-score (0.84 vs 0.71)`.
  3. Confirm promotion.
  4. Verify the `Champion` badge appears on the selected model card.
  5. Now open the Logistic Regression run and click **Promote to Champion**. Confirm promotion.
- **Expected Behavior**:
  - Promoting the second model smoothly demotes the previous champion, or requires explicit confirmation.
  - Exactly one model holds the active Champion flag for the target scope.
- **Expected Output**: Serialized artifact (`.joblib`) persisted in MinIO with champion tag.
- **How to Verify**: Leaderboard shows single model with `CHAMPION` badge.
- **Failure Indicators**: Multiple champions co-exist; champion status resets upon refresh.
- **Related Features**: CAP-18
- **Evidence to Capture**: Screenshot of the Model Registry showing active Champion.
- **Result**: [PASS / FAIL / BLOCKED / NOT IMPLEMENTED]

---

## Stage 15: Knowledge Graph Exploration & Neighborhood Queries

### TC-GRAPH-01: Graph Topology & Shortest Path Discovery
- **Feature / Capability**: CAP-19, CAP-20 (Knowledge Graph Canvas & Path Analysis)
- **Objective**: Explore the entity graph generated in Stage 8; inspect node neighborhoods, expand connections, and find shortest paths.
- **Why This Test Matters**: Knowledge graph intelligence allows investigators and supply chain managers to uncover hidden relationships.
- **Prerequisites**: TC-SCHEMA-01 decomposition completed.
- **Dataset / File**: Ingested entities and edges.
- **Navigation**: Navigate to **Knowledge Graph** (`/graph`).
- **Step-by-Step Instructions**:
  1. On the graph canvas, verify entity nodes are rendered with distinct colors per Entity Type (`Customer`, `Order`, `Product`).
  2. Click on a `Customer` node. Verify that the Inspector drawer displays canonical properties and linked edges.
  3. Click **Expand Neighborhood (1 Hop)**.
  4. Click the **Path Finder** tab. Enter Source: `CUST-000001`, Target: `PRD-001`.
  5. Click **Calculate Shortest Path**.
- **Expected Behavior**: Cytoscape canvas highlights the connecting sequence: `(Customer) -> [:PLACED] -> (Order) -> [:CONTAINS] -> (Product)`.
- **Expected Output**: Visual path highlighted in gold; hop count = 2; edge properties displayed.
- **How to Verify**: Canvas draws the connecting edges cleanly without orphan disconnection.
- **Failure Indicators**: Canvas stays black/blank; Cytoscape script error; shortest path calculation returns 500 error.
- **Related Features**: CAP-19, CAP-20, CAP-21
- **Evidence to Capture**: Screenshot of the highlighted shortest path on the Graph Canvas.
- **Result**: [PASS / FAIL / BLOCKED / NOT IMPLEMENTED]

---

## Stage 16: Automated Insights & Natural Language Discovery

### TC-AI-01: Fact-Based Automated Insights Verification
- **Feature / Capability**: CAP-22 (Automated Insights Engine)
- **Objective**: Generate analytical findings from `curated_regional_revenue` and verify that insights are grounded in real calculations.
- **Why This Test Matters**: Benchmark principle: insights must reflect verified mathematical queries rather than hallucinated text.
- **Prerequisites**: TC-CURAT-01 completed.
- **Dataset / File**: `curated_regional_revenue`.
- **Navigation**: Navigate to **Dashboard** (`/`) or Dataset Insights tab (`/datasets/$datasetId`).
- **Step-by-Step Instructions**:
  1. Click **Generate Insights**.
  2. Review the generated finding cards (e.g. "Top Revenue Region", "Outlier Transactions", "Revenue Concentration").
  3. Cross-reference the cited numbers with the SQL Studio calculations from Stage 11.
- **Expected Behavior**: The insight generator computes actual descriptive statistics (e.g., Greater Accra accounts for ~35% of total volume) and cites the source query.
- **Expected Output**: Insight card includes exact dollar/cedi totals matching SQL Studio output.
- **How to Verify**: Numbers cited in the text match DuckDB query calculations exactly.
- **Failure Indicators**: Generic boilerplate text with generic placeholders or invented figures.
- **Related Features**: CAP-22, CAP-15
- **Evidence to Capture**: Screenshot of the Automated Insights summary card.
- **Result**: [PASS / FAIL / BLOCKED / NOT IMPLEMENTED]

---

## Stage 17: Multi-Tenant Isolation & Security Verification

### TC-SEC-01: Multi-Tenant Boundary Enforcement
- **Feature / Capability**: CAP-02, CAP-25 (Multi-Tenancy & Search Path Safety)
- **Objective**: Verify that Tenant B cannot view or query datasets, connections, or graph nodes belonging to Tenant A.
- **Why This Test Matters**: Fundamental enterprise requirement: data leakage across tenant boundaries is a critical security violation.
- **Prerequisites**: Access to Tenant A credentials and Tenant B credentials (or switch tenant context in UI).
- **Dataset / File**: `customers_small.csv` uploaded in Tenant A.
- **Navigation**: Switch active tenant in header dropdown or log in as Tenant B user.
- **Step-by-Step Instructions**:
  1. In Tenant A, verify `customers_small.csv` is present in `/connections` and `/datasets`.
  2. Switch active tenant context to Tenant B.
  3. Navigate to `/connections`.
  4. Navigate to `/datasets`.
  5. In SQL Studio (`/analytics/sql`), run `SELECT * FROM customers_small`.
- **Expected Behavior**:
  - Tenant B sees 0 connections and 0 datasets from Tenant A.
  - SQL query fails with `Table "customers_small" does not exist`.
- **Expected Output**: Clean empty state or Tenant B's own assets; zero cross-tenant contamination.
- **How to Verify**: DevTools network request payload confirms `X-Tenant-ID` is sent and scoped.
- **Failure Indicators**: Tenant A's customer records appear in Tenant B's catalog or query results.
- **Related Features**: CAP-02, CAP-25
- **Evidence to Capture**: Screenshot of Tenant B's empty catalog alongside Tenant A's populated catalog.
- **Result**: [PASS / FAIL / BLOCKED / NOT IMPLEMENTED]

---

## Stage 18: System Stress, Concurrency & High-Volume Validation

### TC-STRESS-01: High-Volume Ingestion & UI Virtualization
- **Feature / Capability**: CAP-03, CAP-15 (Large Tier File Ingestion & Virtualization)
- **Objective**: Ingest `operational_events_stress.parquet` (100,000 records); verify memory stability, table scroll responsiveness, and query speed.
- **Why This Test Matters**: Stress testing validates that client browsers do not crash or freeze when rendering high-volume enterprise datasets.
- **Prerequisites**: TC-INGEST-01 passed.
- **Dataset / File**: `luminai-testing/datasets/large/operational_events_stress.parquet` (100,000 rows).
- **Navigation**: `/connections` -> Click `+ New connection` -> Upload `operational_events_stress.parquet`.
- **Step-by-Step Instructions**:
  1. Upload the 100k Parquet file. Observe upload progress bar and backend parsing duration.
  2. Navigate to Dataset Detail view (`/datasets/$datasetId`).
  3. Rapidly scroll through the 100,000-row preview table.
  4. Test sorting on column `sensor_temp_celsius`.
  5. In SQL Studio, execute:
     ```sql
     SELECT source_facility, count(*), round(avg(sensor_temp_celsius), 2)
     FROM operational_events_stress
     GROUP BY source_facility;
     ```
- **Expected Behavior**:
  - File ingests smoothly via zero-copy Arrow readers.
  - UI table uses virtualized DOM rendering (scroll remains at 60 FPS without memory explosion).
  - DuckDB aggregation over 100k records completes in under 200ms.
- **Expected Output**: 100,000 records confirmed; instantaneous scrolling; responsive UI.
- **How to Verify**: Open Chrome Task Manager (`Shift+Esc`). Verify tab memory usage remains under 400 MB during rapid scrolling.
- **Failure Indicators**: Browser tab runs out of memory (Aw, Snap!); table locks up; sorting takes > 10 seconds.
- **Related Features**: CAP-03, CAP-15, Large Tier
- **Evidence to Capture**: Screenshot of the 100k record preview and SQL execution duration metric.
- **Result**: [PASS / FAIL / BLOCKED / NOT IMPLEMENTED]
