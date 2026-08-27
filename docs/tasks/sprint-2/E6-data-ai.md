# 🧑‍💻 E6 — Data / AI Engineer Sprint 2 Task Sheet

## Sprint 2 — Pipeline + Entity Resolution (Weeks 5–7)

- **Role:** Data / AI Engineer
- **Primary Focus:** Entity Resolution (ER) Engine in Python, Dagster asset pipeline, schedules & daemon configuration.
- **Working Directory:** `data-engine/` & `infra/`
- **Language:** Python 3.12 + Polars + DuckDB + FastAPI + Dagster
- **Total Load:** 41 SP (7 tasks)

---

## ✅ Sprint 2 Status: ALL TASKS COMPLETED

> All 7 assigned tasks (41 SP) have been implemented, hardened against SQL injection / memory leaks, and verified with unit & integration test suites.

---

## 📋 Completed Tasks

---

### ✅ TASK S2-17: Dagster Schedules & Daemon Config (3 pts) — DONE
* **Goal:** Configure recurring Dagster schedules and daemon process monitoring for automated background data cleaning and entity resolution runs.
* **Delivered Files:**
  * `data-engine/app/processing/schedules.py`
  * `data-engine/app/processing/pipelines/ingest_pipeline.py`
  * `data-engine/dagster_workspace.yaml`
  * `docker-compose.yml`

#### Acceptance Criteria
- [x] Dagster webserver UI shows active schedules (`hourly_cleaning_schedule`, `daily_er_schedule`).
- [x] Daemon automatically executes scheduled materializations.

---

### ✅ TASK S2-07: ER Blocking Engine — Phonetic & Categorical Indexing (5 pts) — DONE
* **Goal:** Implement candidate pair blocking to reduce pairwise comparison complexity from $O(N^2)$ to $O(N)$. Group records into candidate blocks using Soundex/Metaphone phonetic encoding on names combined with country and entity type.
* **Delivered Files:**
  * `app/processing/er/blocking.py`
  * `tests/test_er_blocking.py`

#### Acceptance Criteria
- [x] Blocking drops pair comparison space by > 90% on benchmark dataset.
- [x] Unit tests verify blocking key generation for edge cases (null names, special characters).

---

### ✅ TASK S2-08: ER Pairwise Comparison Engine (8 pts) — DONE
* **Goal:** Calculate string similarity metrics for candidate pairs using Jaro-Winkler (for names/strings) and Levenshtein distance (for codes/IDs), weighted by attribute importance.
* **Delivered Files:**
  * `app/processing/er/comparison.py`
  * `tests/test_er_comparison.py`

#### Acceptance Criteria
- [x] Returns similarity scores between 0.0000 and 1.0000 for each candidate pair.
- [x] Pytest suite validates comparison metrics across 20+ edge case string pairs.

---

### ✅ TASK S2-09: ER Classification Engine (5 pts) — DONE
* **Goal:** Classify evaluated candidate pairs into decision buckets based on configurable confidence thresholds:
  * **Match ($S \ge 0.90$):** Automatic merge into Golden Record.
  * **Review ($0.70 \le S < 0.90$):** Sent to `er_candidates` table for human analyst review.
  * **Non-Match ($S < 0.70$):** Discarded.
* **Delivered Files:**
  * `app/processing/er/classification.py`
  * `tests/test_er_classification.py`

#### Acceptance Criteria
- [x] Pairs above upper threshold auto-merge; pairs in review range save to database for manual review with parameterized queries and leak protection.

---

### ✅ TASK S2-10: ER Clustering & Golden Record Merge Engine (5 pts) — DONE
* **Goal:** Execute connected components graph clustering on matched pairs to group duplicate records, and merge properties into a unified **Golden Record**.
* **Delivered Files:**
  * `app/processing/er/clustering.py`
  * `app/processing/er/golden_record.py`
  * `tests/test_er_clustering.py`

#### Acceptance Criteria
- [x] Transitive matches correctly resolve into a single Golden Record using Disjoint-Set / Union-Find with path compression.
- [x] Merged properties persist to `golden_records` table in PostgreSQL / SQLite fallback.

---

### ✅ TASK S2-11: ER Provenance Tracking (3 pts) — DONE
* **Goal:** Record field-level provenance metadata tracking which raw source dataset and connector contributed each property on the Golden Record.
* **Delivered Files:**
  * `app/processing/er/provenance.py`
  * `tests/test_er_provenance.py`

#### Acceptance Criteria
- [x] Writes provenance rows into `provenance` table for every Golden Record attribute.

---

### ✅ TASK S2-12: Kafka Event Publisher `entity.resolved` (2 pts) — DONE
* **Goal:** Publish resolved golden records onto Kafka topic `entity.resolved` for downstream Graph database (Neo4j) and OpenSearch indexers.
* **Delivered Files:**
  * `app/kafka/producers.py`
  * `tests/test_kafka_producers.py`

#### Acceptance Criteria
- [x] Successfully publishes resolved entity JSON payload onto `entity.resolved` topic with fallback dry-run mode.

---

### ✅ End-to-End ER Pipeline Orchestration
* **Delivered Files:**
  * `app/processing/pipelines/er_pipeline.py`
  * `tests/test_er_pipeline.py`
  * `app/api/processing.py` (`POST /process/er/trigger`)
