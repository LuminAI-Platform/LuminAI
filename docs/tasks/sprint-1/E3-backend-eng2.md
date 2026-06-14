# 🧑‍💻 E3 — Backend Engineer 2 Sprint 1 Task Sheet

## Sprint 1 — Data Connection (Weeks 3–4)

- **Role:** Backend Developer
- **Primary Focus:** Outstanding Sprint 0 items, load-balancing backend tasks from E2 (Schema Detection & Ingestion Preview APIs), and integration testing.
- **Working Directory:** `core-backend/`
- **Language:** Java 21 + Spring Boot 3.5

---

## ⚠️ Carry-Over Warning
* **S0-06 (Security Headers)** must be completed on **Day 1** of Sprint 1. It is a minor 2 SP task but blocks proper secure local testing. See the Sprint 0 task sheet for details on S0-06.

---

## 🚫 Dev Rules & Restrictions
* **DO NOT** modify frontend, data-engine, or other backend domains unless reassigned.
* **DO NOT** commit raw credentials, environment files, or keys.
* **DO NOT** push directly to `main`. Always push to feature branch and open a PR.

---

## 📋 Assigned Tasks

---

### TASK S1-03: SchemaDetector (5 pts) — *Reassigned from E2*
* **Goal:** Analyze the headers and content rows of an ingestion source (CSV, JSON, SQL queries) to infer column types.
* **Target Files:**
  * `src/main/java/com/luminai/connection/service/SchemaDetector.java`

#### Requirements
1. **Data Type Inference:**
   * Read the first 100 rows of the source.
   * Auto-detect columns types: Integer, Double, Boolean, Timestamp, and String. Enforce strict checks (e.g., valid ISO 8601 strings default to Timestamp).

#### Acceptance Criteria
- [ ] Inputting an unmapped CSV correctly reports header columns and matched type formats.

---

### TASK S1-04: Data Preview Endpoint (3 pts) — *Reassigned from E2*
* **Goal:** Return a subset of records as JSON to allow UI rendering of source data.
* **Target Files:**
  * `src/main/java/com/luminai/connection/ConnectionController.java` (update)

#### Requirements
1. **Data preview mapping:**
   * Extract and parse the first 100 rows of an uploaded file or database table.
   * Return array of maps containing key-value data preview arrays.

#### Acceptance Criteria
- [ ] Preview API returns exact columns and data rows from files/tables.
