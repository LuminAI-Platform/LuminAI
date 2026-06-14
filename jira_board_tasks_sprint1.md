# 📋 LuminAI — Jira Board Tasks (Sprint 1)

> **Sprint:** S1 — Data Connection & Preview (Weeks 3–4)
> **Team Size:** 6 Engineers
> **Total Story Points:** 100 (including 12 SP carry-over, load balanced and pulled forward tasks)
> **Repo:** `LuminAI` (GitHub)

---

## 🔑 Legend

| Field | Description |
|---|---|
| **Type** | Story / Task |
| **Priority** | 🔴 Critical · 🟠 High · 🟡 Medium |
| **SP** | Story Points |
| **Branch** | Git branch to create |
| **Repo Path** | Where to find/create files in the GitHub repo |

---

## 👤 E1 — Tech Lead / Senior Backend Engineer

> **Working Directory:** `core-backend/`
> **Stack:** Java 21 + Spring Boot 3.5
> **Current Load:** 10 SP (Balanced)

### Task 1 · S1-07: SchemaMapper CRUD

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🟠 High |
| **SP** | 5 |
| **Depends On** | S0-05 (Project restructure) |
| **Branch** | `feature/S1-07-schemamapper-crud` |

**Description:**
Create REST APIs and entity mapping models to allow users to save mapping configurations that translate raw source dataset column headers to target ontology property definitions.

**Repo Files:**
- `core-backend/src/main/java/com/luminai/connection/model/SchemaMapping.java` *(create)*
- `core-backend/src/main/java/com/luminai/connection/dto/SchemaMappingDto.java` *(create)*
- `core-backend/src/main/java/com/luminai/connection/SchemaMappingController.java` *(create)*
- `core-backend/src/main/java/com/luminai/connection/SchemaMappingService.java` *(create)*

**Acceptance Criteria:**
- [ ] CRUD API handles mapping configurations correctly.
- [ ] TenantContext rules strictly isolate schema maps (Tenant A cannot see Tenant B's schema map configurations).

---

### Task 2 · S1-08: Connector Credentials via Vault / AWS Secrets Manager

| Field | Value |
|---|---|
| **Type** | Task |
| **Priority** | 🟡 Medium |
| **SP** | 3 |
| **Depends On** | S0-05 |
| **Branch** | `feature/S1-08-credentials-vault` |

**Description:**
Secure database connection passwords and keys by routing them into a credentials manager rather than saving them in plain text database fields.

**Repo Files:**
- `core-backend/src/main/java/com/luminai/connection/service/CredentialsVaultService.java` *(create)*

**Acceptance Criteria:**
- [ ] Retrievable credentials are encrypted at rest and decrypted on the fly during synchronization jobs.
- [ ] Vault client helper classes initialize correctly with environment configurations.

---

### Task 3 · S1-09: Flyway Migration — Connectors and Mappings

| Field | Value |
|---|---|
| **Type** | Task |
| **Priority** | 🟡 Medium |
| **SP** | 2 |
| **Depends On** | S0-08 |
| **Branch** | `feature/S1-09-migration-v3` |

**Description:**
Provide the V3 Flyway migration script establishing database schemas for database connections, synchronization tasks, and mapped column properties.

**Repo Files:**
- `core-backend/src/main/resources/db/migration/V3__connectors_and_mappings.sql` *(create)*

**Acceptance Criteria:**
- [ ] Starting the core-backend app runs migration V3 successfully.
- [ ] Tables `connectors`, `sync_jobs`, and `schema_mappings` are created in the database.

---

## 👤 E2 — Backend Lead / Senior Developer

> **Working Directory:** `core-backend/`
> **Stack:** Java 21 + Spring Boot 3.5
> **Current Load:** 22 SP (includes 3 SP carry-over, with 8 SP reassigned to E3)

### Task 4 · S0-04: Spring Kafka Configuration & Topics (CARRY-OVER)

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🔴 Critical — Hard blocker for E6 and S1-06 |
| **SP** | 3 |
| **Depends On** | S0-05, Docker Compose for Kafka |
| **Branch** | `feature/S0-04-kafka-config` |

**Description:**
Configure Spring Kafka connection factories, templates, retry listeners, error handling, and auto-provision the 7 raw/valid/dead-letter Kafka topics on startup.

**Repo Files:**
- `core-backend/src/main/java/com/luminai/config/KafkaConfig.java` *(create)*
- `core-backend/src/main/resources/application-dev.yml` *(update)*

**Acceptance Criteria:**
- [ ] Spring Boot boots up successfully and registers connection factories.
- [ ] All 7 topics are auto-created in the local broker.
- [ ] Failed messages trigger dead-letter queue routing to `ingest.dead_letter`.

---

### Task 5 · S1-01: ConnectionController & ConnectionService

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🟠 High |
| **SP** | 3 |
| **Depends On** | S1-09 (Migrations) |
| **Branch** | `feature/S1-01-connection-crud` |

**Description:**
Create endpoints and backing service rules to configure, fetch, update, and remove file and database connector registry metadata.

**Repo Files:**
- `core-backend/src/main/java/com/luminai/connection/ConnectionController.java` *(create)*
- `core-backend/src/main/java/com/luminai/connection/ConnectionService.java` *(create)*
- `core-backend/src/main/java/com/luminai/connection/model/Connection.java` *(create)*

**Acceptance Criteria:**
- [ ] Endpoints support full CRUD for database/file sources.
- [ ] Tenant boundaries are validated (tenant A cannot query tenant B connections).

---

### Task 6 · S1-02: FileConnector

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🟠 High |
| **SP** | 5 |
| **Depends On** | S1-01, MinIO container |
| **Branch** | `feature/S1-02-file-connector` |

**Description:**
Implement the file ingestion client saving uploaded CSV, JSON, or Excel files onto MinIO's raw storage bucket under a secure tenant-isolated partition path.

**Repo Files:**
- `core-backend/src/main/java/com/luminai/connection/service/FileConnectorService.java` *(create)*
- `core-backend/src/main/java/com/luminai/connection/service/MinioStorageService.java` *(create)*

**Acceptance Criteria:**
- [ ] Uploading test files saves raw binaries to MinIO buckets.
- [ ] Files larger than 500 MB are rejected. Files larger than 50 MB use chunked multipart uploads.

---

### Task 7 · S1-05: JdbcConnector: PostgreSQL

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🟠 High |
| **SP** | 8 |
| **Depends On** | S1-01, S1-08 (Vault credentials) |
| **Branch** | `feature/S1-05-jdbc-connector-postgres` |

**Description:**
Create external database connector querying schemas, discovering tables, and executing chunked cursor rows extraction from PostgreSQL sources.

**Repo Files:**
- `core-backend/src/main/java/com/luminai/connection/service/PostgresConnectorService.java` *(create)*

**Acceptance Criteria:**
- [ ] Discovery endpoint returns available schema and tables from external PostgreSQL database.
- [ ] Extraction job loops using db cursor query sets to avoid memory overload.

---

### Task 8 · S1-06: ConnectionProducer

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🟠 High |
| **SP** | 3 |
| **Depends On** | S0-04 (Kafka config), S1-02, S1-05 |
| **Branch** | `feature/S1-06-connection-producer` |

**Description:**
Publish parsed rows of raw datasets onto Kafka topic `ingest.raw` inside standardized event wrappers containing ingestion metadata, tenant keys, and column payloads.

**Repo Files:**
- `core-backend/src/main/java/com/luminai/connection/producer/ConnectionProducer.java` *(create)*

**Acceptance Criteria:**
- [ ] Sync job triggers publishing onto the Kafka topic `ingest.raw`.
- [ ] Payloads are formatted as valid JSON wrapper envelopes.

---

## 👤 E3 — Backend Engineer 2

> **Working Directory:** `core-backend/`
> **Stack:** Java 21 + Spring Boot 3.5
> **Current Load:** 10 SP (includes 2 SP carry-over, with 8 SP reassigned from E2 to balance load)

### Task 9 · S0-06: Security Headers & CORS Filters (CARRY-OVER)

| Field | Value |
|---|---|
| **Type** | Task |
| **Priority** | 🟠 High |
| **SP** | 2 |
| **Depends On** | S0-05 |
| **Branch** | `feature/S0-06-security-headers` |

**Description:**
Implement a servlet filter injecting standard browser security headers ( nosniff, HSTS, Referrer Policy, Permissions Policy) and restrict CORS requests to `http://localhost:5173`.

**Repo Files:**
- `core-backend/src/main/java/com/luminai/common/security/SecurityHeadersFilter.java` *(create)*

**Acceptance Criteria:**
- [ ] Responses contain all standard HTTP security headers.
- [ ] Cross-origin requests from non-allowed sites are blocked.

---

### Task 10 · S1-03: SchemaDetector (*Reassigned from E2*)

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🟠 High |
| **SP** | 5 |
| **Depends On** | S0-05 |
| **Branch** | `feature/S1-03-schema-detector` |

**Description:**
Build data columns metadata scanning engine reading first 100 rows of incoming files/datasets to infer column types (Integer, Double, Boolean, Timestamp, String).

**Repo Files:**
- `core-backend/src/main/java/com/luminai/connection/service/SchemaDetector.java` *(create)*

**Acceptance Criteria:**
- [ ] Passing raw columns correctly parses and returns inferred data type tags.
- [ ] Correctly identifies timestamp values mapping them to Timestamp type.

---

### Task 11 · S1-04: Data Preview Endpoint (*Reassigned from E2*)

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🟡 Medium |
| **SP** | 3 |
| **Depends On** | S1-01, S1-03 |
| **Branch** | `feature/S1-04-data-preview` |

**Description:**
Implement GET endpoints returning first 100 rows of an uploaded file or database table as standard JSON map arrays.

**Repo Files:**
- `core-backend/src/main/java/com/luminai/connection/ConnectionController.java` *(update)*

**Acceptance Criteria:**
- [ ] Requesting preview returns row key-value configurations matching source structures.

---

## 👤 E4 — Frontend Developer

> **Working Directory:** `frontend/`
> **Stack:** TypeScript 5 + React 19 + Vite + Tailwind CSS v4
> **Current Load:** 31 SP (includes 7 SP carry-over. High priority on carry-over blockers)

### Task 12 · S0-08: App Shell & Design tokens (CARRY-OVER)

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🔴 Critical |
| **SP** | 1 |
| **Depends On** | None |
| **Branch** | `feature/S0-08-frontend-tokens` |

**Description:**
Add the missing CSS custom properties design tokens (`tokens.css`) to the styling system and verify that layouts load custom font structures cleanly.

**Repo Files:**
- `frontend/src/styles/tokens.css` *(create)*
- `frontend/src/index.css` *(update)*

**Acceptance Criteria:**
- [ ] Tailwind compiles successfully using custom tokens config.

---

### Task 13 · S0-09: Keycloak OIDC Integration & Login Flow (CARRY-OVER)

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🔴 Critical — Blocker for all Sprint 1 views |
| **SP** | 3 |
| **Depends On** | S0-08, S0-11 (Docker Keycloak) |
| **Branch** | `feature/S0-09-oidc-login` |

**Description:**
Configure `oidc-client-ts` authorization code flow with Keycloak OIDC, setup a Zustand state store tracking token lifetimes, and implement a protected route wrapper redirecting anonymous requests.

**Repo Files:**
- `frontend/src/lib/auth.ts` *(create)*
- `frontend/src/stores/authStore.ts` *(create)*
- `frontend/src/features/auth/LoginPage.tsx` *(create)*
- `frontend/src/components/layout/ProtectedRoute.tsx` *(create)*

**Acceptance Criteria:**
- [ ] Unauthenticated clients are routed to Keycloak login splash gates.
- [ ] Success callbacks save active JWTs and details in user context layout shells.

---

### Task 14 · S0-10: OpenAPI Client Codegen Pipeline (CARRY-OVER)

| Field | Value |
|---|---|
| **Type** | Task |
| **Priority** | 🔴 Critical |
| **SP** | 3 |
| **Depends On** | S0-08 |
| **Branch** | `feature/S0-10-openapi-codegen` |

**Description:**
Setup openapi-generator-cli scripts compiling backend openapi schemas into TypeScript client interfaces. Add JWT token interceptor to the API fetch wrapper.

**Repo Files:**
- `frontend/package.json` *(update)*
- `frontend/src/lib/api.ts` *(create)*

**Acceptance Criteria:**
- [ ] `npm run generate:api` compiles API clients successfully under `src/lib/api-client/`.
- [ ] API client intercepts requests adding authentication JWT token header.

---

### Task 15 · S1-10: Connection UI — File Ingestion Wizard

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🟠 High |
| **SP** | 8 |
| **Depends On** | S0-09 (OIDC Flow), S1-04 (Preview API) |
| **Branch** | `feature/S1-10-file-upload-wizard` |

**Description:**
Build multi-step drag-and-drop file ingestion wizard, rendering columns layout types, previews tables, and upload confirmations.

**Repo Files:**
- `frontend/src/features/connections/components/FileUploadWizard.tsx` *(create)*
- `frontend/src/features/connections/components/DataPreviewTable.tsx` *(create)*
- `frontend/src/pages/connections/ConnectionsPage.tsx` *(update)*

**Acceptance Criteria:**
- [ ] Drag-and-drop handles uploads, renders column names/types, and pulls rows from preview APIs.

---

### Task 16 · S1-11: Connection UI — Database Connection Form

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🟠 High |
| **SP** | 5 |
| **Depends On** | S0-09 (OIDC Flow) |
| **Branch** | `feature/S1-11-db-connection-form` |

**Description:**
Develop database registry form fields (host, database type, port, credentials) and checklists displaying schemas/tables returned by connector discovery APIs.

**Repo Files:**
- `frontend/src/features/connections/components/DatabaseConnectorForm.tsx` *(create)*
- `frontend/src/features/connections/components/TableSelector.tsx` *(create)*

**Acceptance Criteria:**
- [ ] Connect button runs check list updating selectors based on credentials.

---

### Task 17 · S1-12: Schema Mapper UI

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🟠 High |
| **SP** | 8 |
| **Depends On** | S0-09 (OIDC Flow), S1-10 |
| **Branch** | `feature/S1-12-schema-mapper-ui` |

**Description:**
Build premium schema mapping dashboard displaying raw columns on the left and ontology properties on the right, supporting visual connection associations.

**Repo Files:**
- `frontend/src/features/connections/components/VisualSchemaMapper.tsx` *(create)*
- `frontend/src/pages/connections/SchemaMapPage.tsx` *(create)*

**Acceptance Criteria:**
- [ ] Maps screen links source values to destination tags correctly creating API payload configs.

---

### Task 18 · S1-13: Sync Job Status Monitor

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🟡 Medium |
| **SP** | 3 |
| **Depends On** | S0-09 (OIDC Flow) |
| **Branch** | `feature/S1-13-sync-status-monitor` |

**Description:**
Create sync monitor widgets detailing active dataset synchronization counters, average processing speeds, logs, and error blocks.

**Repo Files:**
- `frontend/src/features/connections/components/SyncJobDetails.tsx` *(create)*
- `frontend/src/features/connections/components/ExecutionLogs.tsx` *(create)*

**Acceptance Criteria:**
- [ ] Job status screen shows speed and logs updating dynamically.

---

## 👤 E5 — DevOps Engineer

> **Working Directories:** `infra/`, `.github/workflows/`
> **Stack:** Vercel (Frontend), Render (Core + Data + Keycloak), Neon (Postgres), Upstash (Redis)
> **Current Load:** 14 SP (Balanced sandbox setup pulled forward)

### Task 19 · S1-D1: Vercel Frontend Deployment

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🔴 Critical — Day 1 |
| **SP** | 2 |
| **Depends On** | GitHub repo access |
| **Branch** | `infra/S1-D1-vercel-frontend` |

**Description:**
Configure automated client builds and previews deploying the React/Vite web application onto Vercel's free hosting tier.

**Acceptance Criteria:**
- [ ] Pushes to `main` auto-deploy.
- [ ] PR reviews generate preview links for UI checks.

---

### Task 20 · S1-D2: Neon PostgreSQL Setup

| Field | Value |
|---|---|
| **Type** | Task |
| **Priority** | 🔴 Critical — Day 1 |
| **SP** | 1 |
| **Depends On** | Neon account setup |
| **Branch** | `infra/S1-D2-neon-postgres` |

**Description:**
Configure serverless database on Neon, setting up direct connection paths for migrations and pooled ports for standard core-backend JPA queries.

**Acceptance Criteria:**
- [ ] Neon database created. Connections are accessible.

---

### Task 21 · S1-D3: Upstash Redis Setup

| Field | Value |
|---|---|
| **Type** | Task |
| **Priority** | 🔴 Critical — Day 1 |
| **SP** | 1 |
| **Depends On** | Upstash account setup |
| **Branch** | `infra/S1-D3-upstash-redis` |

**Description:**
Configure serverless caching database on Upstash, enabling TLS connection strings for spring configuration.

**Acceptance Criteria:**
- [ ] Redis instance handles client connections.

---

### Task 22 · S1-D4: Render Backend Services Deployment

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🔴 Critical — Day 1–2 |
| **SP** | 5 |
| **Depends On** | S1-D2 (Neon), S1-D3 (Upstash) |
| **Branch** | `infra/S1-D4-render-deploy` |

**Description:**
Deploy Spring Boot, FastAPI, and Keycloak docker instances to Render's free tier. Import local Keycloak configurations.

**Acceptance Criteria:**
- [ ] Keycloak auth logs, backend health endpoint, and FastAPI swagger are live.

---

### Task 23 · S1-D5: Wire Services Together

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🟠 High — Day 2–3 |
| **SP** | 2 |
| **Depends On** | S1-D1, S1-D4 |
| **Branch** | `infra/S1-D5-wire-services` |

**Description:**
Configure CORS rules, callback domains, and redirect parameters enabling frontend UI connections to the live backend API and authentication services.

**Acceptance Criteria:**
- [ ] Frontend successfully redirects to Keycloak, returns tokens, and calls backend API without CORS errors.

---

### Task 24 · S1-15: Basic Helm Chart Templates

| Field | Value |
|---|---|
| **Type** | Task |
| **Priority** | 🟡 Medium |
| **SP** | 3 |
| **Depends On** | None |
| **Branch** | `infra/S1-15-helm-charts` |

**Description:**
Create base Helm charts for core-backend, data-engine, and frontend to templates valid manifests.

**Acceptance Criteria:**
- [ ] Running `helm template` outputs valid yaml manifests.

---

## 👤 E6 — Data / AI Engineer

> **Working Directory:** `data-engine/`
> **Stack:** Python 3.12 + FastAPI + Dagster + Polars + DuckDB
> **Current Load:** 13 SP (includes 10 SP cleaning pipeline pulled forward from S2)

### Task 25 · S1-14: Kafka Consumer Scaffold

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🟠 High |
| **SP** | 3 |
| **Depends On** | S0-04 (E2 Kafka Config) |
| **Branch** | `feature/S1-14-kafka-consumer` |

**Description:**
Build the consumer client loop in FastAPI/Python listening to `ingest.raw` Kafka topic and parsing incoming wrapper payloads.

**Repo Files:**
- `data-engine/app/kafka/consumers.py` *(update)*

**Acceptance Criteria:**
- [ ] Consumer connects, listens to broker, and logs incoming raw records.

---

### Task 26 · S2-01: Pipeline Trigger Integration (*Pulled Forward*)

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🟠 High |
| **SP** | 5 |
| **Depends On** | S1-14 |
| **Branch** | `feature/S2-01-dagster-trigger` |

**Description:**
Trigger Dagster cleaning pipelines programmatically when Kafka consumers receive batch end signals.

**Repo Files:**
- `data-engine/app/kafka/consumers.py` *(update)*
- `data-engine/app/processing/trigger.py` *(create)*

**Acceptance Criteria:**
- [ ] Finished batching triggers Dagster orchestrator asset run dynamically.

---

### Task 27 · S2-02: Polars Ingestion Cleaning Pipeline (*Pulled Forward*)

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🟠 High |
| **SP** | 5 |
| **Depends On** | S0-16 |
| **Branch** | `feature/S2-02-polars-cleaning` |

**Description:**
Write the cleaning rules (null substitution, type coercion, string trimming) in a Dagster asset pipeline using Polars lazy frames.

**Repo Files:**
- `data-engine/app/processing/pipelines/cleaning_pipeline.py` *(create)*

**Acceptance Criteria:**
- [ ] materializing clean asset reads raw zone outputs sanitized target tables without crashes.

---

## 📊 Sprint 1 Capacity Summary

| Engineer | Carry-Over | New | Total SP | Workload | Priority Day 1 |
|---|---|---|---|---|---|
| **E1** (Tech Lead) | 0 | 10 | **10** | 🟢 Manageable | Task 1: SchemaMapper CRUD |
| **E2** (Backend Lead) | 3 | 19 | **22** | 🟢 Balanced | Task 4: Kafka Config (Blocker!) |
| **E3** (Backend Eng 2) | 2 | 8 | **10** | 🟢 Balanced | Task 9: Security Headers |
| **E4** (Frontend Dev) | 7 | 24 | **31** | 🔴 Overloaded | Task 12 & 13: OIDC Login (Blocker!) |
| **E5** (DevOps) | 0 | 14 | **14** | 🟢 Balanced | Task 19 & 20: Vercel & Neon Setup |
| **E6** (Data/AI Eng) | 0 | 13 | **13** | 🟢 Balanced | Task 25: Kafka Consumer |

> [!IMPORTANT]
> **Critical Path Blockers:** 
> 1. **E2 must merge S0-04 (Kafka Config)** on Day 1. If Kafka is not configured in Java, S1-06 cannot publish and E6's Kafka consumer cannot start.
> 2. **E4 must complete S0-09 (Keycloak OIDC login flow)** on Day 1–2. All Sprint 1 screens assume authenticated contexts.
> 3. **E3 should merge S0-06 (Security Headers)** on Day 1.
