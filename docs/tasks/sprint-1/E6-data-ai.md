# 🧑‍💻 E6 — Data / AI Engineer Sprint 1 Task Sheet

## Sprint 1 — Data Connection (Weeks 3–4)

- **Role:** Data / AI Engineer
- **Primary Focus:** Kafka message consumption, triggering orchestrator pipelines, and developing raw-zone cleaning algorithms using Polars.
- **Working Directory:** `data-engine/`
- **Language:** Python 3.12 + FastAPI + Dagster + Polars + DuckDB

---

## ⚠️ Carry-Over / Blockers Warning
* E6's tasks heavily depend on **S0-04 (E2 Kafka Config)**. If E2 has not auto-created the raw ingestion topics, Task S1-14 cannot listen to messages. Monitor E2's progress.

---

## 🚫 Dev Rules & Restrictions
* **DO NOT** modify frontend or Java backend workspaces under any circumstances.
* **DO NOT** commit local DB or model dump files to Git.
* **DO NOT** hardcode configuration parameters. Use Pydantic Settings.
* **DO NOT** push directly to `main`. Always push to feature branch and open a PR.

---

## 📋 Assigned Tasks

---

### TASK S1-14: Kafka Consumer Scaffold (3 pts)
* **Goal:** Create the consumer listener service in Python to process raw data rows arriving from Kafka.
* **Target Files:**
  * `app/kafka/consumers.py` (update)

#### Requirements
1. **Raw Consumer Subscription:**
   * Build a Kafka consumer thread or async task subscribing to the `ingest.raw` topic.
   * Parse the message wrapper structure (verify tenant context, connection credentials keys, and the nested data payload row).
   * Log incoming payloads to console output for debugging.

#### Acceptance Criteria
- [ ] Running consumer successfully connects to the Kafka broker.
- [ ] Publishing mock messages onto the `ingest.raw` queue outputs the data correctly in the service log streams.

---

### TASK S2-01: Pipeline Trigger Integration (5 pts) — *Pulled Forward*
* **Goal:** Orchestrate the transition from event consumption to batch cleaning pipelines by invoking Dagster assets dynamically.
* **Target Files:**
  * `app/kafka/consumers.py` (update)
  * `app/processing/trigger.py`

#### Requirements
1. **Dagster Trigger logic:**
   * Implement batching rules (trigger when ingestion batch end signal is received, or after a timeout period e.g. 5 seconds of inactivity).
   * Trigger the Dagster run programmatically using Dagster's Python API (`get_dagster_context` or GraphQL client).

#### Acceptance Criteria
- [ ] Finishing a batch publishes stats and automatically spins up a Dagster pipeline run in the background.

---

### TASK S2-02: Polars Ingestion Cleaning Pipeline (5 pts) — *Pulled Forward*
* **Goal:** Build the data cleaning and normalisation rules inside a Dagster pipeline using Polars lazy frames.
* **Target Files:**
  * `app/processing/pipelines/cleaning_pipeline.py`

#### Requirements
1. **Polars Ingest Transformation:**
   * Load raw source data from MinIO raw zone.
   * Implement transformations:
     * **Null value handling:** Replace nulls with defaults or drop rows based on column schema rules.
     * **Type coercion:** Enforce that values match schemas (e.g. numbers, booleans, dates).
     * **String sanitation:** Trim leading/trailing whitespace, normalize casing.

#### Acceptance Criteria
- [ ] Materializing the cleaning asset processes raw datasets and writes clean output tables without crashing.
