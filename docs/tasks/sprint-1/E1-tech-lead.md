# 🧑‍💻 E1 — Tech Lead Sprint 1 Task Sheet

## Sprint 1 — Data Connection (Weeks 3–4)

- **Role:** Tech Lead / Senior Backend Engineer
- **Primary Focus:** Schema mapping configuration APIs, secure credentials vault service, and V3 Flyway migration script setup.
- **Working Directory:** `core-backend/`
- **Language:** Java 21 + Spring Boot 3.5

---

## ✅ Sprint 1 Status: ALL TASKS COMPLETED

> All 3 assigned tasks (10 SP) have been implemented and verified in the codebase.
> E1 is available for Sprint 2 work or to assist other engineers.

---

## 📋 Completed Tasks

---

### ✅ TASK S1-07: SchemaMapper CRUD (5 pts) — DONE
* **Goal:** Create REST APIs for establishing mapping configurations translating raw source dataset columns to ontology property definitions.
* **Delivered Files:**
  * `src/main/java/com/luminai/connection/model/SchemaMapping.java`
  * `src/main/java/com/luminai/connection/dto/SchemaMappingDto.java`
  * `src/main/java/com/luminai/connection/SchemaMappingController.java`
  * `src/main/java/com/luminai/connection/SchemaMappingService.java`
  * `src/main/java/com/luminai/connection/SchemaMappingRepository.java`

#### Acceptance Criteria
- [x] CRUD API handles mapping configurations.
- [x] Tenant boundaries are validated (tenant A cannot access tenant B mappings).

---

### ✅ TASK S1-08: Connector Credentials via Vault / AWS Secrets Manager (3 pts) — DONE
* **Goal:** Secure database passwords and connection string parameters by routing credentials into a secret management vault.
* **Delivered Files:**
  * `src/main/java/com/luminai/connection/service/CredentialsVaultService.java`

#### Acceptance Criteria
- [x] Retrievable credentials are encrypted at rest and decrypted on the fly during sync runs.
- [x] Vault service handles access credential encryption/decryption safely.

---

### ✅ TASK S1-09: Flyway Migration (2 pts) — DONE
* **Goal:** Apply tables for database connections, synchronization tasks, and property mappings schema definitions.
* **Delivered Files:**
  * `src/main/resources/db/migration/V3__connectors_and_mappings.sql`

#### Acceptance Criteria
- [x] Start backend runs migration V3 successfully.
