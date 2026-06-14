# 🧑‍💻 E4 — Frontend Developer Sprint 1 Task Sheet

## Sprint 1 — Data Connection (Weeks 3–4)

- **Role:** Frontend Developer
- **Primary Focus:** User client onboarding workflows (wizard layouts), external database registry forms, mapping design layouts, and ingestion synchronization status monitors.
- **Working Directory:** `frontend/`
- **Language:** TypeScript 5 + React 19 + Vite + Tailwind CSS v4

---

## ⚠️ Carry-Over Warning
* **S0-09 (Keycloak OIDC Flow)** and **S0-10 (OpenAPI Codegen)** are absolute blockers for all Sprint 1 views. You must complete these tasks on **Day 1–2** before beginning the files or database sync wizard pages. See the Sprint 0 task sheet for details.

---

## 🚫 Dev Rules & Restrictions
* **DO NOT** modify backend or other workspaces.
* **DO NOT** use generic styling or components. Style exclusively using Tailwind CSS v4.
* **DO NOT** install heavy third-party CSS component UI kits. Use Radix UI primitives combined with Tailwind utility styles.
* **DO NOT** push directly to `main`. Always push to feature branch and open a PR.

---

## 📋 Assigned Tasks

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
