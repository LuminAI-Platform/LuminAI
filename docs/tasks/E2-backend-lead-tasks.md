# 🧑‍💻 E2 — Backend Engineer 1 (Backend Lead) Task Sheet

## Sprint 0 — Foundation (Weeks 1–2)

- **Role:** Backend Lead / Senior Developer
- **Primary Focus:** Multi-Tenancy database isolation, Kafka event pipeline configuration.
- **Working Directory:** `core-backend/`
- **Language:** Java 21 + Spring Boot 3.5

---

## 📖 Reference Documentation

Please review the following project specifications in the `docs/` folder before commencing:
* `docs/02-architecture.md` (specifically §4.2 core backend components and §7 event-driven architecture)
* `docs/03-data-model.md` (specifically §5 on multi-tenancy schema-per-tenant mapping strategy)
* `docs/07-security-architecture.md` (specifically §3.2 multi-tenant data isolation)

---

## 🚫 Dev Rules & Restrictions
* **DO NOT** modify `frontend/`, `data-engine/`, or `infra/` workspaces.
* **DO NOT** modify E1's package setup or Security Config without approval.
* **DO NOT** build Flyway migrations or security header filters (these are assigned to E3).
* **DO NOT** push directly to `main` or `develop`.

---

## 📋 Assigned Tasks

---

### TASK S0-03: Multi-Tenancy Architecture Setup (5 pts)
* **Goal:** Implement database isolation using Hibernate's `multiTenancy = SCHEMA` strategy (schema-per-tenant).
* **Working Directory:** `core-backend/`
* **Target Files:**
  * `src/main/java/com/luminai/common/tenant/TenantContext.java`
  * `src/main/java/com/luminai/common/tenant/TenantFilter.java`
  * `src/main/java/com/luminai/common/tenant/TenantIdentifierResolver.java`
  * `src/main/java/com/luminai/config/MultiTenancyConfig.java`
  * `src/main/resources/application-dev.yml` (update)

#### Requirements
1. **Tenant Context:**
   * Create a thread-local context holder (`TenantContext`) to manage the current active tenant slug throughout the execution thread of a request.
2. **Tenant Extraction Filter:**
   * Implement a servlet filter (`TenantFilter`) that intercept incoming API requests.
   * Extract the tenant identifier from the authentication JWT (claim: `tenant_id`).
   * Set the extracted tenant ID in `TenantContext`, and clear it in a `finally` block to prevent thread leakage.
3. **Hibernate Current Tenant Identifier Resolver:**
   * Implement Hibernate's `CurrentTenantIdentifierResolver` to return the value currently bound in `TenantContext`.
   * Resolve to a default schema (e.g., `public` or `tenant_default`) if no tenant is set.
4. **Database Routing Configuration:**
   * Configure Hibernate's multi-tenancy properties in `MultiTenancyConfig`.
   * Configure Hibernate to run `SET search_path TO tenant_{tenantId}` or equivalent PostgreSQL schema selection query on database connection checkout.

#### Acceptance Criteria
* Requesting with a token containing `tenant_id: "company-a"` resolves Hibernate queries to the `tenant_company-a` schema.
* Concurrent requests to the API with different tenant IDs route queries to their respective schemas correctly without interference.
* ThreadLocal storage is verified clean after every request execution.

---

### TASK S0-04: Spring Kafka Configuration & Topics (3 pts)
* **Goal:** Configure Spring Kafka producers, consumers, and auto-provision needed message topics.
* **Working Directory:** `core-backend/`
* **Target Files:**
  * `src/main/java/com/luminai/config/KafkaConfig.java`
  * `src/main/resources/application-dev.yml` (update)

#### Requirements
1. **Producer & Consumer Connection:**
   * Configure Connection Factories for message producers and consumers using standard serializers/deserializers (String keys, JSON values).
   * Configure `KafkaTemplate` bean for publishing events.
2. **Error Handling & Dead-Letter Queue (DLQ):**
   * Setup a `DeadLetterPublishingRecoverer` to route failed messages to a `.dead_letter` suffixed topic.
   * Configure backoff and retry policies (e.g., 3 retries, 1-second interval) within the container factory.
3. **Topic Auto-Creation (Dev Profile):**
   * Register bean definitions to auto-provision the following topics if they do not exist:
     * `ingest.raw` (partitions: 6)
     * `ingest.valid` (partitions: 6)
     * `entity.resolved` (partitions: 6)
     * `entity.updated` (partitions: 3)
     * `audit.log` (partitions: 6)
     * `alerts.triggered` (partitions: 3)
     * `ingest.dead_letter` (partitions: 3)

#### Acceptance Criteria
* Spring Boot boots up successfully and connects to the local Kafka instance (bootstrap-servers configured from YAML).
* Listed Kafka topics are automatically created in the broker.
* Dead-letter recovery kicks in when a message fails processing, sending the failed record to `ingest.dead_letter`.
