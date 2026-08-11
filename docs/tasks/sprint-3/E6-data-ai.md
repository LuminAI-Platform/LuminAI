## Sprint 3 — Ontology + Graph + Explorer

- **Role:** Data / AI Engineer
- **Primary Focus:** Cross-Store Data Reconciliation Engine (PostgreSQL vs Neo4j vs OpenSearch checksum and record count sync verification).
- **Working Directory:** `data-engine/`
- **Language:** Python 3.12 + Polars + DuckDB + Neo4j Client + OpenSearch Client
- **Total Load:** 3 SP (1 task)

---

## 📋 Assigned Tasks

---

### TASK S3-14: Cross-Store Data Reconciliation Engine (3 pts)
* **Goal:** Implement background Python reconciliation job comparing primary entity record counts and checksum hashes across PostgreSQL, Neo4j, and OpenSearch to detect data sync drifts.
* **Branch:** `feature/S3-14-data-reconciliation`
* **Target Files:**
  * `app/processing/reconciliation.py`
  * `tests/test_reconciliation.py`

#### Acceptance Criteria
- [ ] Returns structured reconciliation report `{ status: "HEALTHY" | "DRIFT_DETECTED", pgCount, neo4jCount, openSearchCount, missingEntityIds }`.
- [ ] Unit tests verify drift detection logic.
