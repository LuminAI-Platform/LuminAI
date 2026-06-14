# 🧑‍💻 E1 — Tech Lead Sprint 1 Task Sheet

## Sprint 1 — Data Connection (Weeks 3–4)

- **Role:** Tech Lead / Senior Backend Engineer
- **Primary Focus:** Schema mapping configuration APIs, secure credentials vault service, and V3 Flyway migration script setup.
- **Working Directory:** `core-backend/`
- **Language:** Java 21 + Spring Boot 3.5

---

## 🚫 Dev Rules & Restrictions
* **DO NOT** modify frontend or other backend domains unless reassigned.
* **DO NOT** commit raw credentials, environment files, or keys.
* **DO NOT** push directly to `main`. Always push to feature branch and open a PR.

---

## 📋 Assigned Tasks

---

### TASK S1-07: SchemaMapper CRUD (5 pts)
* **Goal:** Create REST APIs for establishing mapping configurations translating raw source dataset columns to ontology property definitions.
* **Target Files:**
  * `src/main/java/com/luminai/connection/model/SchemaMapping.java`
  * `src/main/java/com/luminai/connection/dto/SchemaMappingDto.java`
  * `src/main/java/com/luminai/connection/SchemaMappingController.java`
  * `src/main/java/com/luminai/connection/SchemaMappingService.java`

#### Requirements
1. **Model & Relationship:**
   * Create schema mapping entity capturing source column headers mapped to defined properties.
2. **REST Endpoints:**
   * Implement standard endpoints to create, retrieve, update, and delete mappings for a connection.
3. **Multi-Tenancy Isolation:**
   * Ensure active TenantContext rules strictly partition schema mapping configurations.

#### Acceptance Criteria
- [ ] CRUD API handles mapping configurations.
- [ ] Tenant boundaries are validated (tenant A cannot access tenant B mappings).

---

### TASK S1-08: Connector Credentials via Vault / AWS Secrets Manager (3 pts)
* **Goal:** Secure database passwords and connection string parameters by routing credentials into a secret management vault.
* **Target Files:**
  * `src/main/java/com/luminai/connection/service/CredentialsVaultService.java`

#### Requirements
1. **Credential Isolation:**
   * Ensure database connection passwords are not saved as plain text. Integrate an encryption vault proxy helper class using standard JVM encryption utilities, or direct connectors to AWS Secrets Manager/HashiCorp Vault local engines.

#### Acceptance Criteria
- [ ] Retrievable credentials are encrypted at rest and decrypted on the fly during sync runs.
- [ ] Vault service handles access credential encryption/decryption safely.

---

### TASK S1-09: Flyway Migration (2 pts)
* **Goal:** Apply tables for database connections, synchronization tasks, and property mappings schema definitions.
* **Target Files:**
  * `src/main/resources/db/migration/V3__connectors_and_mappings.sql`

#### Requirements
1. **Migration scripts:**
   * Add SQL code setting up:
     * `connectors` (DB source configs, hosts, username, encrypted password references, status)
     * `sync_jobs` (execution times, row count processed, status logs)
     * `schema_mappings` (source to target map bindings)

#### Acceptance Criteria
- [ ] Start backend runs migration V3 successfully.
