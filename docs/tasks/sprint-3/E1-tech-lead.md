## Sprint 3 — Ontology + Graph + Explorer

- **Role:** Tech Lead 
- **Primary Focus:** Dynamic Ontology Management (Entity Types, Relationship Types, Schema Versioning & Publishing, and Flyway V6 Migration).
- **Working Directory:** `core-backend/`
- **Language:** Java 21 + Spring Boot 3.5
- **Total Load:** 20 SP (4 tasks)

---

## 🚫 Dev Rules & Restrictions
* **DO NOT** modify `data-engine/` or `frontend/` code directly.
* **DO NOT** push directly to `main`. Always push to a feature branch and open a PR.
* All new REST endpoints must have OpenAPI annotations (`@Operation`, `@ApiResponse`, `@Tag`).
* All JPA entities must enforce schema-level tenant isolation.

---

## 📋 Assigned Tasks

---

### TASK S3-01: EntityTypeService & OntologyController (8 pts)
* **Goal:** Build CRUD REST APIs for defining and updating dynamic Ontology Entity Types. Each entity type includes custom property schemas (JSONB validation rules, required flags, default values).
* **Branch:** `feature/S3-01-entity-type-service`
* **Target Files:**
  * `src/main/java/com/luminai/ontology/model/EntityType.java`
  * `src/main/java/com/luminai/ontology/dto/EntityTypeDto.java`
  * `src/main/java/com/luminai/ontology/controller/EntityTypeController.java`
  * `src/main/java/com/luminai/ontology/service/EntityTypeService.java`
  * `src/main/java/com/luminai/ontology/repository/EntityTypeRepository.java`

#### REST Endpoints
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/ontology/entity-types` | List all registered entity types for the active tenant |
| `POST` | `/api/v1/ontology/entity-types` | Create a new entity type definition |
| `GET` | `/api/v1/ontology/entity-types/{id}` | Get entity type schema by ID |
| `PUT` | `/api/v1/ontology/entity-types/{id}` | Update an existing entity type schema |
| `DELETE` | `/api/v1/ontology/entity-types/{id}` | Delete or deprecate an entity type |

#### Acceptance Criteria
- [ ] CRUD endpoints respond with proper HTTP status codes.
- [ ] Tenant context strictly isolates entity types per tenant schema.
- [ ] `./gradlew spotlessCheck build -x test` passes cleanly.

---

### TASK S3-02: RelationshipTypeService (5 pts)
* **Goal:** Build CRUD REST APIs for directional Ontology Relationship Types linking two entity types (e.g. `Person` -[`EMPLOYED_BY`]-> `Company`).
* **Branch:** `feature/S3-02-relationship-type-service`
* **Target Files:**
  * `src/main/java/com/luminai/ontology/model/RelationshipType.java`
  * `src/main/java/com/luminai/ontology/dto/RelationshipTypeDto.java`
  * `src/main/java/com/luminai/ontology/controller/RelationshipTypeController.java`
  * `src/main/java/com/luminai/ontology/service/RelationshipTypeService.java`
  * `src/main/java/com/luminai/ontology/repository/RelationshipTypeRepository.java`

#### Acceptance Criteria
- [ ] Supports directional relationship definitions and cardinality validation (`ONE_TO_ONE`, `ONE_TO_MANY`, `MANY_TO_MANY`).
- [ ] Enforces source and target entity type existence check.

---

### TASK S3-03: OntologyVersionService & Schema Publishing (5 pts)
* **Goal:** Create an ontology versioning service that publishes immutable release snapshots (e.g., `v1.0.0`, `v1.1.0`), computes diffs between versions, and prevents breaking schema changes on published versions.
* **Branch:** `feature/S3-03-ontology-version-service`
* **Target Files:**
  * `src/main/java/com/luminai/ontology/model/OntologyVersion.java`
  * `src/main/java/com/luminai/ontology/service/OntologyVersionService.java`
  * `src/main/java/com/luminai/ontology/controller/OntologyVersionController.java`

#### Acceptance Criteria
- [ ] Publishing an ontology version generates a immutable JSON snapshot.
- [ ] Diff endpoint returns added, modified, and removed entity/relationship types.

---

### TASK S3-04: Flyway Migration V6 — Ontology Tables (2 pts)
* **Goal:** Create `V6__ontology_tables.sql` defining `entity_types`, `relationship_types`, and `ontology_versions` tables inside `tenant_template`.
* **Branch:** `feature/S3-04-flyway-v6-ontology`
* **Target Files:**
  * `src/main/resources/db/migration/V6__ontology_tables.sql`

#### Acceptance Criteria
- [ ] `./gradlew bootRun` applies V6 migration successfully.
- [ ] Tables and indexes are created inside `tenant_template` schema and cloned to tenant schemas.
