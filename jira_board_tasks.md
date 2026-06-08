# 📋 LuminAI — Jira Board Tasks (Sprint 0)

> **Sprint:** S0 — Foundation (Weeks 1–2)
> **Team Size:** 6 Engineers
> **Total Story Points:** 62
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
> **Required Reading:** `docs/02-architecture.md`, `docs/03-data-model.md`, `docs/06-technology-stack.md`, `docs/07-security-architecture.md`

### Task 1 · S0-05: Rename & Restructure Spring Boot Project

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🔴 Critical — everything depends on this |
| **SP** | 5 |
| **Depends On** | None — start immediately |
| **Branch** | `feature/S0-05-project-restructure` |

**Description:**
Transform the default Spring Initializr scaffold (`com.example.demo`) into the proper `com.luminai` package structure. Update Gradle configs, create domain package skeleton, and replace `application.properties` with YAML configs.

**Repo Files:**
- `core-backend/settings.gradle`
- `core-backend/build.gradle`
- `core-backend/src/main/java/com/luminai/LuminAiApplication.java` *(create)*
- `core-backend/src/test/java/com/luminai/LuminAiApplicationTests.java` *(create)*
- `core-backend/src/main/resources/application.yml` *(create)*
- `core-backend/src/main/resources/application-dev.yml` *(create)*
- `core-backend/src/main/java/com/luminai/{config,common,auth,ontology,dashboard,audit}/` *(create package skeleton)*

**Acceptance Criteria:**
- [ ] `com.example.demo` package fully removed
- [ ] `com.luminai.LuminAiApplication` exists and compiles
- [ ] `build.gradle` has correct group, name, and all Sprint 0 dependencies
- [ ] `application.yml` + `application-dev.yml` created
- [ ] `./gradlew clean build -x test` passes

---

### Task 2 · S0-06: Spring Security + Keycloak OIDC Resource Server

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🟠 High — Frontend login depends on this |
| **SP** | 8 |
| **Depends On** | S0-05 (E1), S0-11 (E5 Docker Compose) |
| **Branch** | `feature/S0-06-spring-security-keycloak` |

**Description:**
Configure Spring Boot as an OAuth2 Resource Server validating JWTs issued by Keycloak. Implement role extraction from JWT claims and a `/api/v1/auth/me` endpoint.

**Repo Files:**
- `core-backend/src/main/java/com/luminai/config/SecurityConfig.java`
- `core-backend/src/main/java/com/luminai/config/KeycloakRoleConverter.java`
- `core-backend/src/main/java/com/luminai/common/security/JwtClaimsExtractor.java`
- `core-backend/src/main/java/com/luminai/auth/AuthController.java`

**Acceptance Criteria:**
- [ ] Unauthenticated requests to `/api/v1/**` return `401`
- [ ] `/actuator/health` and `/swagger-ui.html` accessible without auth
- [ ] Valid Keycloak JWT grants access to `/api/v1/auth/me`
- [ ] Roles from JWT mapped to Spring `ROLE_*` authorities
- [ ] CORS allows `http://localhost:5173`

---

### Task 3 · S0-07: Multi-Tenancy Setup

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🟡 Medium |
| **SP** | 5 |
| **Depends On** | S0-05 (E1) |
| **Branch** | `feature/S0-07-multi-tenancy` |

**Description:**
Implement schema-per-tenant isolation using Hibernate multi-tenancy. Create ThreadLocal tenant context, JWT extraction filter, and Hibernate tenant resolver.

**Repo Files:**
- `core-backend/src/main/java/com/luminai/common/tenant/TenantContext.java`
- `core-backend/src/main/java/com/luminai/common/tenant/TenantFilter.java`
- `core-backend/src/main/java/com/luminai/common/tenant/TenantIdentifierResolver.java`
- `core-backend/src/main/java/com/luminai/config/MultiTenancyConfig.java`
- `core-backend/src/main/resources/application-dev.yml` *(update)*

**Acceptance Criteria:**
- [ ] JWT `tenant_id: "acme"` routes queries to `tenant_acme` schema
- [ ] `TenantContext` cleared after each request (no leakage)
- [ ] Missing `tenant_id` in JWT returns `403`

---

### Task 4 · S0-08: Flyway Initial Migration

| Field | Value |
|---|---|
| **Type** | Task |
| **Priority** | 🟡 Medium |
| **SP** | 3 |
| **Depends On** | S0-05 (E1) |
| **Branch** | `feature/S0-08-flyway-migrations` |

**Description:**
Create SQL migration scripts for the shared public schema (tenants + users tables) and tenant template schema.

**Repo Files:**
- `core-backend/src/main/resources/db/migration/V1__init_public_schema.sql`
- `core-backend/src/main/resources/db/migration/V2__create_tenant_template_schema.sql`

**Acceptance Criteria:**
- [ ] `./gradlew bootRun` runs Flyway migrations on startup
- [ ] `tenants` and `users` tables exist in `public` schema
- [ ] Tenant template schema ready for cloning

---

### Task 5 · S0-09: Global Exception Handler + Input Validation

| Field | Value |
|---|---|
| **Type** | Task |
| **Priority** | 🟡 Medium |
| **SP** | 2 |
| **Depends On** | S0-05 (E1) |
| **Branch** | `feature/S0-09-exception-handler` |

**Description:**
Implement standardized error response format and global exception handling via `@ControllerAdvice`.

**Repo Files:**
- `core-backend/src/main/java/com/luminai/common/exception/ApiError.java`
- `core-backend/src/main/java/com/luminai/common/exception/ResourceNotFoundException.java`
- `core-backend/src/main/java/com/luminai/common/exception/GlobalExceptionHandler.java`

**Acceptance Criteria:**
- [ ] Invalid request body returns structured `ApiError` JSON with field-level errors
- [ ] All exceptions return consistent JSON (never raw stack traces)

---

## 👤 E2 — Backend Lead / Senior Developer

> **Working Directory:** `core-backend/`
> **Stack:** Java 21 + Spring Boot 3.5
> **Required Reading:** `docs/02-architecture.md` (§4.2, §7), `docs/03-data-model.md` (§5), `docs/07-security-architecture.md` (§3.2)

### Task 6 · S0-03: Multi-Tenancy Architecture Setup

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🟠 High |
| **SP** | 5 |
| **Depends On** | S0-05 (E1 project restructure) |
| **Branch** | `feature/S0-03-multi-tenancy-arch` |

**Description:**
Implement database isolation using Hibernate `multiTenancy = SCHEMA`. Create tenant context holder, extraction filter, Hibernate resolver, and DB routing config.

**Repo Files:**
- `core-backend/src/main/java/com/luminai/common/tenant/TenantContext.java`
- `core-backend/src/main/java/com/luminai/common/tenant/TenantFilter.java`
- `core-backend/src/main/java/com/luminai/common/tenant/TenantIdentifierResolver.java`
- `core-backend/src/main/java/com/luminai/config/MultiTenancyConfig.java`
- `core-backend/src/main/resources/application-dev.yml` *(update)*

**Acceptance Criteria:**
- [ ] Token with `tenant_id: "company-a"` resolves queries to `tenant_company-a` schema
- [ ] Concurrent requests with different tenant IDs route correctly
- [ ] ThreadLocal verified clean after every request

---

### Task 7 · S0-04: Spring Kafka Configuration & Topics

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🟡 Medium |
| **SP** | 3 |
| **Depends On** | S0-05 (E1), S0-11 (E5 Docker Compose for Kafka) |
| **Branch** | `feature/S0-04-kafka-config` |

**Description:**
Configure Spring Kafka producers/consumers, dead-letter queue recovery, and auto-provision 7 Kafka topics for the dev profile.

**Repo Files:**
- `core-backend/src/main/java/com/luminai/config/KafkaConfig.java`
- `core-backend/src/main/resources/application-dev.yml` *(update)*

**Kafka Topics to Create:** `ingest.raw`, `ingest.valid`, `entity.resolved`, `entity.updated`, `audit.log`, `alerts.triggered`, `ingest.dead_letter`

**Acceptance Criteria:**
- [ ] Spring Boot connects to local Kafka on startup
- [ ] All 7 topics auto-created in broker
- [ ] Dead-letter recovery routes failed messages to `ingest.dead_letter`

---

## 👤 E3 — Backend Engineer 2

> **Working Directory:** `core-backend/`
> **Stack:** Java 21 + Spring Boot 3.5
> **Required Reading:** `docs/03-data-model.md` (§8), `docs/07-security-architecture.md` (§4.4)

### Task 8 · S0-05: Flyway Database Migrations Setup

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🟠 High |
| **SP** | 3 |
| **Depends On** | S0-05 (E1 project restructure) |
| **Branch** | `feature/S0-05-flyway-migrations` |

**Description:**
Write SQL migration scripts for shared public schema tables (`tenants`, `users`) and tenant template schema tables (`entity_types`, `entities`, `relationships`, `property_definitions`).

**Repo Files:**
- `core-backend/src/main/resources/db/migration/V1__init_public_schema.sql`
- `core-backend/src/main/resources/db/migration/V2__create_tenant_template_schema.sql`

**Acceptance Criteria:**
- [ ] Migrations run automatically on boot with `dev` profile
- [ ] All global tables exist in `public` schema
- [ ] Re-running with existing tables does not crash

---

### Task 9 · S0-06: Security Headers & CORS Filters

| Field | Value |
|---|---|
| **Type** | Task |
| **Priority** | 🟡 Medium |
| **SP** | 2 |
| **Depends On** | S0-05 (E1 project restructure) |
| **Branch** | `feature/S0-06-security-headers` |

**Description:**
Implement a servlet filter injecting security headers (`X-Content-Type-Options`, `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy`) and enforce CORS for `http://localhost:5173`.

**Repo Files:**
- `core-backend/src/main/java/com/luminai/common/security/SecurityHeadersFilter.java`

**Acceptance Criteria:**
- [ ] All API responses include required security headers
- [ ] `curl -I http://localhost:8080/actuator/health` shows correct headers

---

### Task 10 · S0-07: Global Exception Handling & Validation

| Field | Value |
|---|---|
| **Type** | Task |
| **Priority** | 🟡 Medium |
| **SP** | 2 |
| **Depends On** | S0-05 (E1 project restructure) |
| **Branch** | `feature/S0-07-exception-handler` |

**Description:**
Create standardized API error record, `@ControllerAdvice` handler for `400/403/404/500`, and custom `ResourceNotFoundException`.

**Repo Files:**
- `core-backend/src/main/java/com/luminai/common/exception/ApiError.java`
- `core-backend/src/main/java/com/luminai/common/exception/GlobalExceptionHandler.java`
- `core-backend/src/main/java/com/luminai/common/exception/ResourceNotFoundException.java`

**Acceptance Criteria:**
- [ ] Invalid data returns `400` with structured field validation messages
- [ ] Internal exceptions return clean JSON, never stack traces

---

## 👤 E4 — Frontend Developer

> **Working Directory:** `frontend/`
> **Stack:** TypeScript 5 + React 19 + Vite + Tailwind CSS v4
> **Required Reading:** `docs/02-architecture.md` (§6), `docs/06-technology-stack.md` (§4.3, §7), `docs/07-security-architecture.md` (§2.2)

### Task 11 · S0-08: Design System & Application Layout Shell

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🔴 Critical |
| **SP** | 5 |
| **Depends On** | None — start immediately |
| **Branch** | `feature/S0-08-design-system-shell` |

**Description:**
Create a responsive, dark-themed application shell with collapsible sidebar navigation (Dashboard, Explorer, Connections, Ontology, Graph, Settings), top bar with search/tenant selector, and TanStack Router integration.

**Repo Files:**
- `frontend/src/styles/tokens.css` *(create)*
- `frontend/src/index.css` *(update)*
- `frontend/src/components/layout/Sidebar.tsx` *(create)*
- `frontend/src/components/layout/TopBar.tsx` *(create)*
- `frontend/src/components/layout/AppShell.tsx` *(create)*
- `frontend/src/App.tsx` *(update)*

**Acceptance Criteria:**
- [ ] `npm run build` compiles without errors
- [ ] Sidebar collapses smoothly, adapts to mobile/tablet
- [ ] Route transitions work without page reloads

---

### Task 12 · S0-09: Keycloak OIDC Integration & Login Flow

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🟠 High |
| **SP** | 3 |
| **Depends On** | S0-08 (E4), S0-11 (E5 Docker/Keycloak), S0-06 (E1 Security) |
| **Branch** | `feature/S0-09-oidc-login` |

**Description:**
Integrate OIDC authorization code flow with PKCE using `oidc-client-ts`. Create Zustand auth store, protected route wrapper, callback handler, and premium login page.

**Repo Files:**
- `frontend/src/lib/auth.ts` *(create)*
- `frontend/src/stores/authStore.ts` *(create)*
- `frontend/src/features/auth/LoginPage.tsx` *(create)*
- `frontend/src/components/layout/ProtectedRoute.tsx` *(create)*

**Acceptance Criteria:**
- [ ] Protected pages redirect unauthenticated users to login
- [ ] Login → Keycloak → callback → dashboard flow works end-to-end
- [ ] User details render dynamically in the layout shell

---

### Task 13 · S0-10: OpenAPI Client Codegen Pipeline

| Field | Value |
|---|---|
| **Type** | Task |
| **Priority** | 🟡 Medium |
| **SP** | 3 |
| **Depends On** | S0-08 (E4 layout shell) |
| **Branch** | `feature/S0-10-openapi-codegen` |

**Description:**
Set up `@openapitools/openapi-generator-cli` to auto-generate TypeScript API clients from the backend OpenAPI spec. Create a global fetch wrapper that injects JWT from the auth store.

**Repo Files:**
- `frontend/package.json` *(update — add `generate:api` script)*
- `frontend/src/lib/api.ts` *(create)*
- `frontend/src/lib/api-client/README.md` *(create)*

**Acceptance Criteria:**
- [ ] `npm run generate:api` runs without errors
- [ ] Type-safe service definitions generated under `src/lib/api-client/`
- [ ] Generated output directory is git-ignored

---

## 👤 E5 — DevOps Engineer

> **Working Directories:** `infra/`, `.github/workflows/`, root `docker-compose.yml`
> **Stack:** YAML, Dockerfile, HCL (Terraform)
> **Required Reading:** `docs/02-architecture.md` (§10), `docs/06-technology-stack.md` (§4.4, §4.5), `docs/07-security-architecture.md` (§5)

### Task 14 · S0-11: Docker Compose Dev Environment Expansion

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🔴 Critical — all services depend on this |
| **SP** | 5 |
| **Depends On** | None — start immediately |
| **Branch** | `feature/S0-11-docker-compose` |

**Description:**
Extend Docker Compose to orchestrate full local dev stack: PgBouncer, Neo4j, OpenSearch, MinIO, Redis, and Keycloak. Configure health checks, named volumes, and Keycloak realm import with `luminai-spa` client.

**Repo Files:**
- `docker-compose.yml` *(update — root directory)*
- `infra/keycloak/luminai-realm.json` *(create)*

**Acceptance Criteria:**
- [ ] `docker compose up -d` starts all services successfully
- [ ] All health checks report green
- [ ] Keycloak imports realm config on initial run

---

### Task 15 · S0-12: Multi-stage Dockerfiles

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🟠 High |
| **SP** | 3 |
| **Depends On** | None |
| **Branch** | `feature/S0-12-dockerfiles` |

**Description:**
Create optimized multi-stage Dockerfiles for all three services: Java backend (Gradle → JRE), Python data-engine (uv install → slim runtime), React frontend (Node build → Nginx).

**Repo Files:**
- `core-backend/Dockerfile` *(create)*
- `data-engine/Dockerfile` *(create)*
- `frontend/Dockerfile` *(create)*
- `frontend/nginx.conf` *(create)*

**Acceptance Criteria:**
- [ ] All containers build without errors
- [ ] Frontend handles SPA path refresh (no 404s)

---

### Task 16 · S0-13: GitHub Actions CI Workflows

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🟠 High |
| **SP** | 5 |
| **Depends On** | None |
| **Branch** | `feature/S0-13-ci-workflows` |

**Description:**
Create CI pipelines for all three services with dependency caching, path-based triggers, and test artifact uploads.

**Repo Files:**
- `.github/workflows/ci-java.yml` *(create)*
- `.github/workflows/ci-python.yml` *(create)*
- `.github/workflows/ci-frontend.yml` *(create)*

**Acceptance Criteria:**
- [ ] PRs trigger only relevant build checks (path-filtered)
- [ ] Test failures block merge

---

### Task 17 · S0-14: Cloud Dev Infrastructure Terraform Base

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🟡 Medium |
| **SP** | 5 |
| **Depends On** | None |
| **Branch** | `feature/S0-14-terraform-base` |

**Description:**
Create foundational Terraform modules for AWS VPC (public/private subnets, multi-AZ, NAT/Internet gateways) and remote state backend (S3 + DynamoDB) in `af-south-1`.

**Repo Files:**
- `infra/terraform/modules/vpc/main.tf` *(create)*
- `infra/terraform/envs/dev/main.tf` *(create)*
- `infra/terraform/envs/dev/backend.tf` *(create)*

**Acceptance Criteria:**
- [ ] `terraform init` and `terraform plan` complete without errors
- [ ] No compute/DB instances created (deferred to Sprint 2)

---

## 👤 E6 — Data / AI Engineer

> **Working Directory:** `data-engine/`
> **Stack:** Python 3.12 + FastAPI + Dagster + Polars + DuckDB
> **Required Reading:** `docs/02-architecture.md` (§5, §7), `docs/03-data-model.md` (§6), `docs/06-technology-stack.md` (§4.2)

### Task 18 · S0-15: FastAPI Application Scaffold

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🟠 High |
| **SP** | 3 |
| **Depends On** | None — start immediately |
| **Branch** | `feature/S0-15-fastapi-scaffold` |

**Description:**
Scaffold a modular FastAPI service with CORS config, Pydantic BaseSettings for env vars (Kafka, PostgreSQL, MinIO), health/processing/analytics route stubs, and Kafka consumer/producer stubs.

**Repo Files:**
- `data-engine/app/main.py` *(create)*
- `data-engine/app/config.py` *(create)*
- `data-engine/app/api/health.py` *(create)*
- `data-engine/app/api/processing.py` *(create)*
- `data-engine/app/api/analytics.py` *(create)*
- `data-engine/app/kafka/consumers.py` *(create)*
- `data-engine/app/kafka/producers.py` *(create)*

**Acceptance Criteria:**
- [ ] App runs via `uv run uvicorn app.main:app`
- [ ] `GET /health` returns JSON status
- [ ] `GET /docs` shows Swagger documentation

---

### Task 19 · S0-16: Dagster Workspace & No-Op Pipeline

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🟡 Medium |
| **SP** | 3 |
| **Depends On** | S0-15 (E6) |
| **Branch** | `feature/S0-16-dagster-workspace` |

**Description:**
Set up Dagster orchestrator config with a test pipeline containing two mock assets (`raw_data_placeholder` → `cleaned_data_placeholder`). Verify Polars integration and Dagster Definitions graph.

**Repo Files:**
- `data-engine/dagster_workspace.yaml` *(create)*
- `data-engine/app/processing/pipelines/__init__.py` *(create)*
- `data-engine/app/processing/pipelines/ingest_pipeline.py` *(create)*

**Acceptance Criteria:**
- [ ] `uv run dagster dev -p 3001` starts successfully
- [ ] `http://localhost:3001` shows both assets in Dagster UI
- [ ] Materializing pipeline completes without errors

---

## 📊 Sprint 0 Summary by Engineer

| Engineer | Role | Tasks | Total SP | Can Start Day 1? |
|---|---|---|---|---|
| **E1** | Tech Lead | S0-05, S0-06, S0-07, S0-08, S0-09 | 23 | ✅ Yes (S0-05) |
| **E2** | Backend Lead | S0-03, S0-04 | 8 | ⏳ After E1's S0-05 |
| **E3** | Backend Eng 2 | S0-05, S0-06, S0-07 | 7 | ⏳ After E1's S0-05 |
| **E4** | Frontend Dev | S0-08, S0-09, S0-10 | 11 | ✅ Yes (S0-08) |
| **E5** | DevOps | S0-11, S0-12, S0-13, S0-14 | 18 | ✅ Yes (all tasks) |
| **E6** | Data/AI Eng | S0-15, S0-16 | 6 | ✅ Yes (S0-15) |

> [!IMPORTANT]
> **Critical Path:** E1's **S0-05** (Project Restructure) and E5's **S0-11** (Docker Compose) are the two blockers. Prioritize these on Day 1 to unblock the rest of the team.

> [!TIP]
> **Task ID Note:** E1 and E3 share some overlapping task numbers (S0-05 through S0-09) in their original task sheets. When entering into Jira, use the **task titles** as the primary identifier to avoid confusion, or re-number E3's tasks to avoid collisions.
