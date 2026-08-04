## Sprint 2 — Pipeline + Entity Resolution

- **Role:** Data / AI Engineer
- **Primary Focus:** Entity Resolution (ER) Engine in Python (phonetic blocking, pairwise comparison with Jaro-Winkler/Levenshtein algorithms, candidate classification, connected components clustering, golden record merge, and provenance tracking).
- **Working Directory:** `data-engine/`
- **Language:** Python 3.12 + Polars + DuckDB + FastAPI + Dagster
- **Total Load:** 38 SP (6 core engine tasks)

---

## 🚫 Dev Rules & Restrictions
* **DO NOT** modify `core-backend/` or `frontend/` directly.
* Use Polars lazy frames (`pl.LazyFrame`) for all heavy data operations to prevent OOM errors.
* Write unit tests under `tests/` for all string matching and clustering algorithms.

---

## 📋 Assigned Tasks

---

### TASK S2-07: ER Blocking Engine — Phonetic & Categorical Indexing (5 pts)
* **Goal:** Implement candidate pair blocking to reduce pairwise comparison complexity from $O(N^2)$ to $O(N)$. Group records into candidate blocks using Soundex/Metaphone phonetic encoding on names combined with country and entity type.
* **Branch:** `feature/S2-07-er-blocking`
* **Target Files:**
  * `app/processing/er/blocking.py` 
  * `tests/test_er_blocking.py`

#### Requirements
1. Generate blocking keys: `BLOCK_KEY = Metaphone(Name) + "_" + Country + "_" + EntityType`.
2. Return candidate pairs $(Record_A, Record_B)$ that share at least one blocking key.

#### Acceptance Criteria
- [ ] Blocking drops pair comparison space by > 90% on benchmark dataset.
- [ ] Unit tests verify blocking key generation for edge cases (null names, special characters).

---

### TASK S2-08: ER Pairwise Comparison Engine (8 pts)
* **Goal:** Calculate string similarity metrics for candidate pairs using Jaro-Winkler (for names/strings) and Levenshtein distance (for codes/IDs), weighted by attribute importance.
* **Branch:** `feature/S2-08-er-pairwise-comparison`
* **Target Files:**
  * `app/processing/er/comparison.py` 
  * `tests/test_er_comparison.py`

#### Requirements
1. Implement vectorized Polars comparison functions:
   * `jaro_winkler_similarity(str_a, str_b)`
   * `levenshtein_distance(str_a, str_b)`
2. Calculate overall weighted confidence score $S \in [0.0, 1.0]$:
   $$S = w_{name} \cdot S_{name} + w_{dob} \cdot S_{dob} + w_{email} \cdot S_{email}$$

#### Acceptance Criteria
- [ ] Returns similarity scores between 0.0000 and 1.0000 for each candidate pair.
- [ ] Pytest suite validates comparison metrics across 20+ edge case string pairs.

---

### TASK S2-09: ER Classification Engine (5 pts)
* **Goal:** Classify evaluated candidate pairs into decision buckets based on configurable confidence thresholds:
  * **Match ($S \ge 0.90$):** Automatic merge into Golden Record.
  * **Review ($0.70 \le S < 0.90$):** Sent to `er_candidates` table for human analyst review.
  * **Non-Match ($S < 0.70$):** Discarded.
* **Branch:** `feature/S2-09-er-classification`
* **Target Files:**
  * `app/processing/er/classification.py` 
  * `tests/test_er_classification.py`

#### Acceptance Criteria
- [ ] Pairs above upper threshold auto-merge; pairs in review range save to database for manual review.

---

### TASK S2-10: ER Clustering & Golden Record Merge Engine (5 pts)
* **Goal:** Execute connected components graph clustering on matched pairs to group duplicate records, and merge properties into a unified **Golden Record**.
* **Branch:** `feature/S2-10-er-clustering-golden-record`
* **Target Files:**
  * `app/processing/er/clustering.py` 
  * `app/processing/er/golden_record.py` 
  * `tests/test_er_clustering.py`

#### Requirements
1. Group transitively matched records (if A=B and B=C, cluster is {A, B, C}).
2. Merge rule: Select non-null property with highest completeness score or latest timestamp as canonical attribute.

#### Acceptance Criteria
- [ ] Transitive matches correctly resolve into a single Golden Record.
- [ ] Merged properties persist to `golden_records` table in PostgreSQL.

---

### TASK S2-11: ER Provenance Tracking (3 pts)
* **Goal:** Record field-level provenance metadata tracking which raw source dataset and connector contributed each property on the Golden Record.
* **Branch:** `feature/S2-11-er-provenance`
* **Target Files:**
  * `app/processing/er/provenance.py` 

#### Acceptance Criteria
- [ ] Writes provenance rows into `provenance` table for every Golden Record attribute.

---

### TASK S2-12: Kafka Event Publisher `entity.resolved` (2 pts)
* **Goal:** Publish resolved golden records onto Kafka topic `entity.resolved` for downstream Graph database (Neo4j) and OpenSearch indexers.
* **Branch:** `feature/S2-12-kafka-entity-resolved`
* **Target Files:**
  * `app/kafka/producers.py`

#### Acceptance Criteria
- [ ] Successfully publishes resolved entity JSON payload onto `entity.resolved` topic over SASL_SSL.
