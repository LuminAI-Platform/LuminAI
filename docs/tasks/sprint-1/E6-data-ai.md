# 🧑‍💻 E6 — Data / AI Engineer Sprint 1 Task Sheet

## Sprint 1 — Data Connection (Weeks 3–4)

- **Role:** Data / AI Engineer
- **Primary Focus:** Kafka message consumption, triggering orchestrator pipelines, and developing raw-zone cleaning algorithms using Polars.
- **Working Directory:** `data-engine/`
- **Language:** Python 3.12 + FastAPI + Dagster + Polars + DuckDB

---

## ✅ Sprint 1 Status: ALL TASKS COMPLETED

> All 3 assigned tasks (13 SP) have been implemented and verified in the codebase.
> E6 is available for Sprint 2 work or to assist other engineers.

---

## 📋 Completed Tasks

---

### ✅ TASK S1-14: Kafka Consumer Scaffold (3 pts) — DONE
* **Goal:** Create the consumer listener service in Python to process raw data rows arriving from Kafka.
* **Delivered Files:**
  * `app/kafka/consumers.py` — `IngestRawConsumer` class with confluent-kafka integration (193 lines)

#### Acceptance Criteria
- [x] Running consumer successfully connects to the Kafka broker.
- [x] Publishing mock messages onto the `ingest.raw` queue outputs the data correctly in the service log streams.

---

### ✅ TASK S2-01: Pipeline Trigger Integration (5 pts) — *Pulled Forward* — DONE
* **Goal:** Orchestrate the transition from event consumption to batch cleaning pipelines by invoking Dagster assets dynamically.
* **Delivered Files:**
  * `app/kafka/consumers.py` (updated with batch-complete signal handling)
  * `app/processing/trigger.py` — Dagster materialization trigger (103 lines)

#### Acceptance Criteria
- [x] Finishing a batch publishes stats and automatically spins up a Dagster pipeline run in the background.

---

### ✅ TASK S2-02: Polars Ingestion Cleaning Pipeline (5 pts) — *Pulled Forward* — DONE
* **Goal:** Build the data cleaning and normalisation rules inside a Dagster pipeline using Polars lazy frames.
* **Delivered Files:**
  * `app/processing/pipelines/cleaning_pipeline.py` — Full cleaning pipeline (607 lines)

#### Acceptance Criteria
- [x] Materializing the cleaning asset processes raw datasets and writes clean output tables without crashing.
