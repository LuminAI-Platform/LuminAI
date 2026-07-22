
## 🔑 Summary of Required Work

All frontend UI views, OIDC login flows, and styling shells are built. However, some frontend forms and pages currently fallback to `localStorage` mock states rather than connecting directly to the live Spring Boot REST endpoints.

Completing these 4 Jira tasks will replace all mock fallbacks with real `apiFetch` integration calls, enabling full End-to-End system testing.

---

## 📌 Tasks Breakdown

### Task 1 · S1-FE-01: Wire ConnectionsPage to Real REST API (`/api/v1/connections`)

**Description:**
Replace `localStorage.getItem("local_database_connectors")` and mock initial arrays with an asynchronous `useEffect` hook that fetches registered connectors from the backend endpoint `GET /api/v1/connections`. Update delete buttons to issue `DELETE /api/v1/connections/{id}`.

**Acceptance Criteria:**
- [ ] On mount, `ConnectionsPage.tsx` calls `apiFetch('/api/v1/connections')` to retrieve data connection objects.
- [ ] Connectors list renders real database and file data returned from the backend.
- [ ] Deleting a connector triggers `apiFetch('/api/v1/connections/${id}', { method: 'DELETE' })` and updates the UI state on success.
- [ ] Loading spinner and error state banners render cleanly if the backend is unreachable.

---

### Task 2 · S1-FE-02: Align DatabaseConnectorForm Payload with Backend DTO Schema

**Description:**
Update the payload formatting in `handleRegister` to match the backend Java record `ConnectionDto.CreateRequest`. Convert database type to uppercase enum strings (`POSTGRESQL`, `MYSQL`, `MSSQL`) and package connection configuration properties (`host`, `port`, `database`, `username`, `selectedTables`) inside the `config` JSON string.

**Acceptance Criteria:**
- [ ] Submitting the form calls `apiFetch('/api/v1/connections', { method: 'POST', body: ... })`.
- [ ] Request body strictly matches the backend schema:
  ```typescript
  {
    name: name,
    type: dbType.toUpperCase(), // "POSTGRESQL", "MYSQL", "MSSQL"
    config: JSON.stringify({ host, port, database: databaseName, username, selectedTables }),
    credentialsRef: `vault-secret-${Date.now()}`
  }
  ```
- [ ] Success callback closes modal and reloads the active connection list.

---

### Task 3 · S1-FE-03: Register File Ingestions as Connection Entities in FileUploadWizard

**Description:**
When a user completes a drag-and-drop file upload in `FileUploadWizard.tsx`, call `POST /api/v1/connections` with `type: "FILE"` so that file metadata is registered in the backend PostgreSQL database, saving the file onto storage and triggering Kafka ingestion events.

**Acceptance Criteria:**
- [ ] Completing Step 4 in the wizard posts a connection payload with `type: "FILE"`:
  ```typescript
  {
    name: file.name,
    type: "FILE",
    config: JSON.stringify({ fileName: file.name, fileSize: file.size, rowsCount: parsedData.rows.length }),
    credentialsRef: "minio-bucket-raw"
  }
  ```
- [ ] Uploaded file connection appears under the "Uploaded Files" tab on `ConnectionsPage`.

---

### Task 4 · S1-FE-04: Wire SyncJobDetails and ExecutionLogs to Live Backend Status API

**Description:**
Remove hardcoded `demo={true}` props from `<SyncJobDetails />` and `<ExecutionLogs />` components in `ConnectionsPage.tsx`. Connect the widgets to poll `/api/v1/sync-jobs` or consume real sync job state updates from backend events.

**Acceptance Criteria:**
- [ ] `demo={true}` flag removed from `<SyncJobDetails />` and `<ExecutionLogs />`.
- [ ] Processing speed, rows processed counter, and logs update dynamically from real backend job status responses.

---

## 🛠️ Developer Execution Order

1. **S1-FE-02** — Fix `DatabaseConnectorForm` payload formatting (2 SP)
2. **S1-FE-01** — Wire `ConnectionsPage` to `GET/DELETE /api/v1/connections` (3 SP)
3. **S1-FE-03** — Register file uploads in `FileUploadWizard` (3 SP)
4. **S1-FE-04** — Connect `SyncJobDetails` live job status monitor (2 SP)
