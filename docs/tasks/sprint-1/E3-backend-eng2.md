# 🧑‍💻 E3 — Backend Engineer 2 Sprint 1 Task Sheet

## Sprint 1 — Data Connection (Weeks 3–4)

- **Role:** Backend Developer
- **Primary Focus:** Sprint 0 carry-over security headers (Day 1), then load-balancing backend tasks from E2 (Schema Detection & Ingestion Preview APIs).
- **Working Directory:** `core-backend/`
- **Language:** Java 21 + Spring Boot 3.5
- **Total Load:** 10 SP (2 SP carry-over + 8 SP new)

---

## 🟠 Carry-Over Warning
* **S0-06 (Security Headers)** was never created in Sprint 0. `SecurityHeadersFilter.java` does not exist. Must be completed on **Day 1** of Sprint 1 — it blocks proper secure local testing.

---

## 🚫 Dev Rules & Restrictions
* **DO NOT** modify frontend, data-engine, or other backend domains unless reassigned.
* **DO NOT** commit raw credentials, environment files, or keys.
* **DO NOT** push directly to `main`. Always push to feature branch and open a PR.

---

## 📋 Assigned Tasks

---

### 🟠 TASK S0-06: Security Headers & CORS Filters (2 pts) — CARRY-OVER / DAY 1
* **Goal:** Implement a servlet filter injecting standard browser security headers and CORS enforcement.
* **Branch:** `feature/S0-06-security-headers`
* **Target Files:**
  * `src/main/java/com/luminai/common/security/SecurityHeadersFilter.java` *(create)*

#### Requirements
1. **Security Headers:**
   * `X-Content-Type-Options: nosniff`
   * `Strict-Transport-Security: max-age=31536000; includeSubDomains`
   * `Referrer-Policy: strict-origin-when-cross-origin`
   * `Permissions-Policy: camera=(), microphone=(), geolocation=()`
2. **CORS Enforcement:**
   * Restrict cross-origin requests to `http://localhost:5173`.

#### Acceptance Criteria
- [ ] All API responses include required security headers.
- [ ] `curl -I http://localhost:8080/actuator/health` shows correct headers.
- [ ] Cross-origin requests from non-allowed sites are blocked.

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
