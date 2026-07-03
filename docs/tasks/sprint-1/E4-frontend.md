# 🧑‍💻 E4 — Frontend Developer Sprint 1 Task Sheet

## Sprint 1 — Data Connection (Weeks 3–4)

- **Role:** Frontend Developer
- **Primary Focus:** Sprint 0 carry-over (design tokens, OIDC login, OpenAPI codegen) on Day 1–2, then user client onboarding workflows, database registry forms, mapping design layouts, and sync status monitors.
- **Working Directory:** `frontend/`
- **Language:** TypeScript 5 + React 19 + Vite + Tailwind CSS v4
- **Total Load:** 31 SP (7 SP carry-over + 24 SP new) — 🔴 OVERLOADED

---

## 🔴 Carry-Over Warning
* **S0-08 (Design Tokens)** — `tokens.css` was never created. The `src/styles/` directory doesn't exist. Must be done first.
* **S0-09 (Keycloak OIDC Flow)** — Files exist (`auth.ts`, `authStore.ts`, `LoginPage.tsx`, `ProtectedRoute.tsx`) but integration was not accepted. **BLOCKER for ALL Sprint 1 frontend screens.** Must be completed Day 1–2.
* **S0-10 (OpenAPI Codegen)** — `api.ts` and `generate:api` script exist but were not accepted. Must be completed before building API-consuming views.

---

## 🚫 Dev Rules & Restrictions
* **DO NOT** modify backend or other workspaces.
* **DO NOT** use generic styling or components. Style exclusively using Tailwind CSS v4.
* **DO NOT** install heavy third-party CSS component UI kits. Use Radix UI primitives combined with Tailwind utility styles.
* **DO NOT** push directly to `main`. Always push to feature branch and open a PR.

---

## 📋 Assigned Tasks

---

### 🔴 TASK S0-08: App Shell & Design Tokens (1 pt) — CARRY-OVER / DAY 1
* **Goal:** Add the missing CSS custom properties design tokens file and verify font loading.
* **Branch:** `feature/S0-08-frontend-tokens`
* **Target Files:**
  * `src/styles/tokens.css` *(create — directory doesn't exist yet)*
  * `src/index.css` *(update)*

#### Requirements
1. **Design Tokens:**
   * Create CSS custom properties for colors, spacing, typography, shadows, and border radii.
   * Import tokens into the main stylesheet.

#### Acceptance Criteria
- [ ] Tailwind compiles successfully using custom tokens config.

---

### 🔴 TASK S0-09: Keycloak OIDC Integration & Login Flow (3 pts) — CARRY-OVER / DAY 1 BLOCKER
* **Goal:** Complete OIDC authorization code flow with PKCE using `oidc-client-ts`. All Sprint 1 screens depend on this.
* **Branch:** `feature/S0-09-oidc-login`
* **Target Files:**
  * `src/lib/auth.ts` *(review/fix)*
  * `src/stores/authStore.ts` *(review/fix)*
  * `src/features/auth/LoginPage.tsx` *(review/fix)*
  * `src/components/layout/ProtectedRoute.tsx` *(review/fix)*

#### Requirements
1. **OIDC Flow:**
   * Configure `oidc-client-ts` with Keycloak issuer, client ID `luminai-spa`, and PKCE.
   * Implement Zustand auth store tracking token lifetimes and user details.
   * Protected route wrapper must redirect unauthenticated users to login.
2. **Callback Handling:**
   * Handle OIDC callback, extract tokens, and populate user context in layout shell.

#### Acceptance Criteria
- [ ] Unauthenticated clients are routed to Keycloak login splash gates.
- [ ] Success callbacks save active JWTs and details in user context layout shells.

---

### 🔴 TASK S0-10: OpenAPI Client Codegen Pipeline (3 pts) — CARRY-OVER
* **Goal:** Complete OpenAPI generator CLI pipeline and JWT-authenticated API fetch wrapper.
* **Branch:** `feature/S0-10-openapi-codegen`
* **Target Files:**
  * `package.json` *(review/fix)*
  * `src/lib/api.ts` *(review/fix)*

#### Requirements
1. **Code Generation:**
   * `npm run generate:api` must produce type-safe TypeScript client interfaces under `src/lib/api-client/`.
   * Generated output directory must be git-ignored.
2. **Auth Interceptor:**
   * Global fetch wrapper must inject JWT from auth store into all API requests.

#### Acceptance Criteria
- [ ] `npm run generate:api` compiles API clients successfully under `src/lib/api-client/`.
- [ ] API client intercepts requests adding authentication JWT token header.

---

### TASK S1-10: Connection UI — File Ingestion Wizard (8 pts)
* **Goal:** Build the drag-and-drop file upload interface with metadata type confirmation and data preview sheets.
* **Target Files:**
  * `src/features/connections/components/FileUploadWizard.tsx`
  * `src/features/connections/components/DataPreviewTable.tsx`
  * `src/pages/connections/ConnectionsPage.tsx`

#### Requirements
1. **Wizard Flow Layout:**
   * Step 1: Upload box with drag-and-drop support. Enforce client-side file validations.
   * Step 2: Show detected columns, data types (retrieved from SchemaDetector API), and preview rows (retrieved from Data Preview API).
   * Step 3: Trigger backend sync task setup.

#### Acceptance Criteria
- [ ] Dragging a file uploads it, shows parsed headers, parses data previews, and displays matched types.

---

### TASK S1-11: Connection UI — Database Connection Form (5 pts)
* **Goal:** Design the interface for registering external database endpoints and selecting source tables.
* **Target Files:**
  * `src/features/connections/components/DatabaseConnectorForm.tsx`
  * `src/features/connections/components/TableSelector.tsx`

#### Requirements
1. **Interactive Database forms:**
   * Provide form fields: connection name, database type (PostgreSQL), database host, port, database name, username, and password.
   * Add a "Test Connection" button that calls external schema discovery APIs.
   * Display dynamic checklists showing tables/schemas to select for syncing.

#### Acceptance Criteria
- [ ] Database credentials can be input, validation succeeds, and lists of tables update based on selected DB properties.

---

### TASK S1-12: Schema Mapper UI (8 pts)
* **Goal:** Create a visual layout allowing mapping of source dataset headers to target ontology model attributes.
* **Target Files:**
  * `src/features/connections/components/VisualSchemaMapper.tsx`
  * `src/pages/connections/SchemaMapPage.tsx`

#### Requirements
1. **Visual mapping editor:**
   * Render source field columns (left side) and target ontology properties (right side).
   * Allow user to map fields by drawing lines (drag and drop) or using simple selectors.
   * Provide options to configure default fallbacks for null values or select string transformations.

#### Acceptance Criteria
- [ ] Map screen compiles cleanly and creates structured schema map configurations.

---

### TASK S1-13: Sync Job Status Monitor (3 pts)
* **Goal:** Create visual displays representing data import status, records count, speeds, and execution errors logs.
* **Target Files:**
  * `src/features/connections/components/SyncJobDetails.tsx`
  * `src/features/connections/components/ExecutionLogs.tsx`

#### Requirements
1. **Job logs screen:**
   * List active and past sync runs showing processing speed (records/second), status (running, failed, complete), and error counters.

#### Acceptance Criteria
- [ ] Ingestion dashboards update stats dynamically.
