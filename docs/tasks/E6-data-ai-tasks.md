# 🧑‍💻 E6 — Data / AI Engineer Task Sheet

## Sprint 0 — Foundation (Weeks 1–2)

- **Role:** Data / AI Engineer
- **Primary Focus:** Python services layout scaffolding, ingestion routing definitions, and Dagster workspace coordination.
- **Working Directory:** `data-engine/`
- **Language:** Python 3.12 + FastAPI + Dagster + Polars + DuckDB

---

## 📖 Reference Documentation

Please review the following project specifications in the `docs/` folder before commencing:
* `docs/02-architecture.md` (specifically §5 on Data & AI Engine architecture and api endpoints, §7 on Kafka stubs)
* `docs/03-data-model.md` (specifically §6 entity resolution blocking & comparison strategies)
* `docs/06-technology-stack.md` (specifically §4.2 python dependency architecture)

---

## 🚫 Dev Rules & Restrictions
* **DO NOT** modify frontend or Java backend workspaces under any circumstances.
* **DO NOT** commit local DB or model dump files to Git.
* **DO NOT** hardcode configuration parameters. Utilize Pydantic BaseSettings loading configs from env values.

---

## 📋 Assigned Tasks

---

### TASK S0-15: FastAPI Application Scaffold (3 pts)
* **Goal:** Establish a modular FastAPI service configuration hosting mock execution and health verification routing.
* **Working Directory:** `data-engine/`
* **Target Files:**
  * `app/main.py`
  * `app/config.py`
  * `app/api/health.py`
  * `app/api/processing.py`
  * `app/api/analytics.py`
  * `app/kafka/consumers.py`
  * `app/kafka/producers.py`

#### Requirements
1. **Application Entry Point:**
   * Compose `main.py` configuring CORS authorization rules for the core java backend.
2. **Environment Variable Configuration:**
   * Implement a Pydantic `BaseSettings` object parsing configurations (Kafka URLs, PostgreSQL credentials, and MinIO keys) from local environment values.
3. **Route Modules:**
   * Implement routers mapping `/health` status and trigger endpoints `/process/trigger` returning stubs for pipeline tracking.
4. **Kafka Consumers & Producers Stubs:**
   * Create stubs for Kafka raw data listeners (targeting topic `ingest.raw`) and validation publishers (`ingest.valid`).

#### Acceptance Criteria
* The application runs successfully locally using `uv run uvicorn app.main:app`.
* Requesting `GET /health` returns JSON validation stating system status.
* Visiting `GET /docs` presents FastAPI Swagger documentation describing all endpoints.

---

### TASK S0-16: Dagster Workspace & No-Op Pipeline (3 pts)
* **Goal:** Setup Dagster orchestrator configuration displaying a test pipeline layout.
* **Working Directory:** `data-engine/`
* **Target Files:**
  * `dagster_workspace.yaml`
  * `app/processing/pipelines/__init__.py`
  * `app/processing/pipelines/ingest_pipeline.py`

#### Requirements
1. **Workspace Definition:**
   * Declare a `dagster_workspace.yaml` locating Dagster assets under the processing pipeline module.
2. **Pipeline Asset Scaffolding:**
   * Compose a test pipeline layout (`ingest_pipeline.py`) implementing a mock asset loading step (`raw_data_placeholder`) feeding an output step (`cleaned_data_placeholder`).
   * Verify Polars libraries can compile and build basic dataframes inside the pipeline log statements.
3. **Workspace Orchestrator Test:**
   * Configure Dagster Definitions mapping the assets into a cohesive graph UI.

#### Acceptance Criteria
* Launching `uv run dagster dev -p 3001` runs successfully.
* Accessing `http://localhost:3001` showcases both assets in the Dagster web portal.
* Materializing the pipeline completes execution steps without processing errors.
