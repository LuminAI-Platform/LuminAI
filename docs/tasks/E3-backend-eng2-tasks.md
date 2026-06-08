# 🧑‍💻 E3 — Backend Engineer 2 Task Sheet

## Sprint 0 — Foundation (Weeks 1–2)

- **Role:** Backend Developer
- **Primary Focus:** Database schemas/migrations, exception handling, servlet security filters.
- **Working Directory:** `core-backend/`
- **Language:** Java 21 + Spring Boot 3.5

---

## 📖 Reference Documentation

Please review the following project specifications in the `docs/` folder before commencing:
* `docs/03-data-model.md` (specifically §8 relational database schema tables)
* `docs/07-security-architecture.md` (specifically §4.4 secure HTTP headers and security response metadata)

---

## 🚫 Dev Rules & Restrictions
* **DO NOT** modify `frontend/`, `data-engine/`, or `infra/` workspaces.
* **DO NOT** modify E1's package restructuring or OIDC core configuration without approval.
* **DO NOT** modify E2's multi-tenancy context routing or Kafka configurations.
* **DO NOT** push directly to `main` or `develop`.

---

## 📋 Assigned Tasks

---

### TASK S0-05: Flyway Database Migrations Setup (3 pts)
* **Goal:** Design the SQL migration scripts to initialize the shared public schemas and isolated tenant database templates.
* **Working Directory:** `core-backend/`
* **Target Files:**
  * `src/main/resources/db/migration/V1__init_public_schema.sql`
  * `src/main/resources/db/migration/V2__create_tenant_template_schema.sql`

#### Requirements
1. **Public Schema (V1):**
   * Write the migration script to create global shared tables in the `public` schema:
     * `tenants` (ID, name, unique slug, status, timestamps)
     * `users` (ID, Keycloak unique ID, email, full name, foreign key to tenant ID, role mapping, timestamps)
   * Create database indexes for lookup queries (e.g., index on user email, index on tenant slug).
2. **Tenant Template Schema (V2):**
   * Write the database migration script that establishes the base structures cloned when onboarding new tenant schemas.
   * Target tables to create (refer to schemas in `docs/03-data-model.md` §8):
     * `entity_types` (Ontology definition metadata)
     * `entities` (Core master entity records)
     * `relationships` (Ontology link mappings between entities)
     * `property_definitions` (Data schemas per entity type)

#### Acceptance Criteria
* The application runs migrations automatically on boot when the `dev` profile is active.
* All global tables exist in `public` schema, and template tables compile correctly.
* Re-running the application with existing tables does not crash migration verification.

---

### TASK S0-06: Security Headers & CORS Filters (2 pts)
* **Goal:** Restrict API access and secure downstream browsers by enforcing standard headers and origin configurations.
* **Working Directory:** `core-backend/`
* **Target Files:**
  * `src/main/java/com/luminai/common/security/SecurityHeadersFilter.java`

#### Requirements
1. **Security Headers Filter:**
   * Implement a servlet filter registered high in the filter chain (`@Order` configuration).
   * Inject headers into every response:
     * `X-Content-Type-Options: nosniff` (prevent MIME sniffing)
     * `X-XSS-Protection: 0` (disable legacy browser scripts, rely on CSP)
     * `Strict-Transport-Security` (enforce HTTPS for 1 year, including subdomains)
     * `Referrer-Policy: strict-origin-when-cross-origin`
     * `Permissions-Policy` (disable browser hardware like camera, microphone, geolocation)
2. **CORS Rules Mapping:**
   * Enforce restrictions limiting cross-origin requests exclusively to the configured frontend server (`http://localhost:5173`).

#### Acceptance Criteria
* Requesting any API endpoint yields the expected headers in the response payload.
* Running `curl -I http://localhost:8080/actuator/health` displays the correct HTTP header configurations.

---

### TASK S0-07: Global Exception Handling & Validation (2 pts)
* **Goal:** Standardize error formats returning from the REST API to protect internal system stack traces and give helpful validation messages.
* **Working Directory:** `core-backend/`
* **Target Files:**
  * `src/main/java/com/luminai/common/exception/ApiError.java`
  * `src/main/java/com/luminai/common/exception/GlobalExceptionHandler.java`
  * `src/main/java/com/luminai/common/exception/ResourceNotFoundException.java`

#### Requirements
1. **API Error Payload Standard:**
   * Design a data record `ApiError` representing all error HTTP responses. Include fields: timestamp, status code, generic error type description, error message, API path request context, and detailed array of field-level validation errors.
2. **Controller Advice Handler:**
   * Implement a `@ControllerAdvice` handler class to intercept standard Spring Exceptions:
     * `MethodArgumentNotValidException` (returns status 400 Bad Request with field-level constraint lists)
     * `ResourceNotFoundException` (returns status 404 Not Found)
     * `AccessDeniedException` (returns status 403 Forbidden)
     * Generic `Exception` fallback (returns status 500 Internal Server Error with hidden stack trace)

#### Acceptance Criteria
* Passing invalid data parameters to an endpoint (e.g. failing `@NotNull` or `@Email` checks) returns status 400 and the structured field validation messages.
* Internal exceptions yield a clean JSON response rather than a Java stack trace trace.
