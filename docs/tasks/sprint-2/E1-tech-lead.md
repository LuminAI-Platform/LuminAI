## Sprint 2 — Pipeline + Entity Resolution

- **Role:** Tech Lead
- **Primary Focus:** Configurable cleaning rules CRUD API, Flyway migration for pipeline & ER tables, and coordination with E5 on Kafka topic contracts.
- **Working Directory:** `core-backend/`
- **Language:** Java 21 + Spring Boot 3.5
- **Total Load:** 10 SP (2 tasks)

---

## 🚫 Dev Rules & Restrictions
* **DO NOT** modify `data-engine/` or `frontend/` code.
* **DO NOT** push directly to `main`. Always push to a feature branch and open a PR.
* All new REST endpoints must have OpenAPI annotations (`@Operation`, `@ApiResponse`).
* All new JPA entities must be tenant-aware (inherit from `BaseEntity` or use `TenantContext`).

---

## 📋 Assigned Tasks

---

### TASK S2-13: Configurable Cleaning Rules API (5 pts)
* **Goal:** Build a CRUD REST API that allows users to define per-connector cleaning & transformation rules. These rules are consumed by the Data Engine cleaning pipeline (E5) to dynamically control how data is cleaned during ingestion.
* **Branch:** `feature/S2-13-cleaning-rules-api`
* **Target Files:**
  * `src/main/java/com/luminai/connection/model/CleaningRule.java`
  * `src/main/java/com/luminai/connection/dto/CleaningRuleDto.java`
  * `src/main/java/com/luminai/connection/CleaningRuleController.java`
  * `src/main/java/com/luminai/connection/CleaningRuleService.java`
  * `src/main/java/com/luminai/connection/CleaningRuleRepository.java`

#### Requirements

1. **JPA Entity — `CleaningRule`:**
   * Fields: `id` (UUID), `connectionId` (FK to `Connector`), `columnName` (String), `ruleType` (Enum: `TRIM`, `UPPERCASE`, `LOWERCASE`, `DATE_NORMALIZE`, `NULL_FILL`, `REGEX_REPLACE`, `REMOVE_DUPLICATES`), `ruleConfig` (JSON string — e.g. `{"pattern": "\\s+", "replacement": " "}`), `priority` (int — execution order), `enabled` (boolean), `createdAt`, `updatedAt`.
   * Must belong to `tenant_*` schema (tenant-isolated).

2. **REST Endpoints:**
   | Method | Path | Description |
   |---|---|---|
   | `GET` | `/api/v1/connections/{connectionId}/cleaning-rules` | List all cleaning rules for a connector |
   | `POST` | `/api/v1/connections/{connectionId}/cleaning-rules` | Create a new cleaning rule |
   | `PUT` | `/api/v1/connections/{connectionId}/cleaning-rules/{ruleId}` | Update an existing rule |
   | `DELETE` | `/api/v1/connections/{connectionId}/cleaning-rules/{ruleId}` | Delete a rule |

3. **Validation:**
   * `columnName` must not be blank.
   * `ruleType` must be a valid enum value.
   * `priority` must be >= 0.
   * Connection must belong to the authenticated tenant.

4. **Kafka Integration:**
   * When rules are created/updated/deleted, publish an event to Kafka topic `entity.updated` with payload `{ "type": "CLEANING_RULES_CHANGED", "connectionId": "...", "tenantId": "..." }` so the Data Engine can reload rules on the next pipeline run.

#### Acceptance Criteria
- [ ] All 4 CRUD endpoints respond correctly with proper HTTP status codes (200, 201, 204, 404).
- [ ] Tenant isolation: User from `tenant_acme` cannot access rules belonging to `tenant_default`.
- [ ] Swagger UI shows the new endpoints with example payloads.
- [ ] Kafka event fires on rule mutation.
- [ ] `./gradlew spotlessCheck build -x test` passes.

---

### TASK S2-V5: Flyway Migration V5 — Pipeline & ER Tables (5 pts)
* **Goal:** Create Flyway migration `V5__pipeline_and_er_tables.sql` defining tables for cleaning rules, pipeline runs, entity resolution candidates, golden records, and provenance tracking. These tables live inside `tenant_template` and are automatically cloned to new tenant schemas.
* **Branch:** `feature/S2-V5-pipeline-er-migration`
* **Target Files:**
  * `src/main/resources/db/migration/V5__pipeline_and_er_tables.sql`

#### Requirements

1. **Tables to create (inside `tenant_template` schema):**

   ```sql
   -- Cleaning rules per connector
   cleaning_rules (id UUID PK, connection_id UUID FK, column_name VARCHAR, rule_type VARCHAR, rule_config JSONB, priority INT, enabled BOOLEAN, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)

   -- Pipeline execution runs
   pipeline_runs (id UUID PK, connection_id UUID FK, pipeline_type VARCHAR, status VARCHAR, started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, records_input INT, records_output INT, records_failed INT, error_message TEXT, metadata JSONB)

   -- ER candidate pairs
   er_candidates (id UUID PK, pipeline_run_id UUID FK, record_a_id UUID, record_b_id UUID, similarity_score DECIMAL(5,4), match_method VARCHAR, status VARCHAR DEFAULT 'PENDING', reviewed_by UUID, reviewed_at TIMESTAMPTZ)

   -- Golden records (merged entities)
   golden_records (id UUID PK, entity_type VARCHAR, canonical_name VARCHAR, properties JSONB, confidence_score DECIMAL(5,4), created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)

   -- Provenance tracking (which source contributed which property)
   provenance (id UUID PK, golden_record_id UUID FK, property_name VARCHAR, source_connection_id UUID FK, source_record_id UUID, contributed_value TEXT, contributed_at TIMESTAMPTZ)
   ```

2. **Indexes:**
   * `er_candidates(pipeline_run_id)`, `er_candidates(status)`
   * `golden_records(entity_type)`, `golden_records(canonical_name)`
   * `provenance(golden_record_id)`
   * `cleaning_rules(connection_id)`

3. **Idempotency:**
   * Use `CREATE TABLE IF NOT EXISTS` for all tables.

#### Acceptance Criteria
- [ ] `./gradlew bootRun` applies V5 migration successfully.
- [ ] All tables and indexes are created inside `tenant_template` schema.
- [ ] Cloning `tenant_template` to a new tenant schema includes all V5 tables.
- [ ] `./gradlew spotlessCheck build -x test` passes.

---

## 📅 Suggested Timeline (3-week sprint)

| Week | Focus |
|---|---|
| **Week 5 (Days 1–3)** | V5 Flyway migration design and implementation |
| **Week 5 (Days 4–5)** | `CleaningRule` entity, DTO, repository |
| **Week 6 (Days 1–3)** | `CleaningRuleController` + `CleaningRuleService` + Kafka event publishing |
| **Week 6 (Days 4–5)** | Testing, Swagger annotation, PR review |
| **Week 7** | Code review for E2 & E5 PRs, integration testing, bug fixes |
