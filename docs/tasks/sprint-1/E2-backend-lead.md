# 🧑‍💻 E2 — Backend Lead Sprint 1 Task Sheet

## Sprint 1 — Data Connection (Weeks 3–4)

- **Role:** Backend Lead / Senior Developer
- **Primary Focus:** File and database connector logic, raw storage uploads, schema inference engines, and event publication onto Kafka queues.
- **Working Directory:** `core-backend/`
- **Language:** Java 21 + Spring Boot 3.5

---

## ⚠️ Carry-Over Warning
* **S0-04 (Kafka Config)** must be completed on **Day 1** before starting Sprint 1. It is a hard blocker for all ingestion events and E6's tasks. See the Sprint 0 task sheet for details on S0-04.

---

## 🚫 Dev Rules & Restrictions
* **DO NOT** modify frontend, data-engine, or other backend domains unless reassigned.
* **DO NOT** commit raw credentials, environment files, or keys.
* **DO NOT** push directly to `main`. Always push to feature branch and open a PR.

---

## 📋 Assigned Tasks

---

### TASK S1-01: ConnectionController + ConnectionService (3 pts)
* **Goal:** Create REST endpoints and backing services to manage the registry of data connections.
* **Target Files:**
  * `src/main/java/com/luminai/connection/ConnectionController.java`
  * `src/main/java/com/luminai/connection/ConnectionService.java`
  * `src/main/java/com/luminai/connection/model/Connection.java`

#### Requirements
1. **CRUD API:**
   * Create database connection model (capturing type [FILE, POSTGRESQL], name, metadata description, status, sync scheduling configuration, and encrypted credential keys).
   * Implement CRUD endpoints secured by tenant scope.

#### Acceptance Criteria
- [ ] Connectors are registered, updated, deleted, and retrieved within tenant boundaries.

---

### TASK S1-02: FileConnector (5 pts)
* **Goal:** Parse incoming uploads (CSV, JSON, Excel) and upload them securely into MinIO's raw storage zone.
* **Target Files:**
  * `src/main/java/com/luminai/connection/service/FileConnectorService.java`
  * `src/main/java/com/luminai/connection/service/MinioStorageService.java`

#### Requirements
1. **MinIO Upload integration:**
   * Build client connection class calling MinIO SDK using credentials from environment configurations.
2. **File processing limits:**
   * Block uploads larger than 500 MB. Enable chunked uploads (multipart upload API) for files larger than 50 MB.
3. **Raw Bucket storage:**
   * Store files under bucket path: `/raw/{tenantId}/{connectorId}/{fileId}`.

#### Acceptance Criteria
- [ ] Uploading test files saves raw binaries to MinIO buckets.
- [ ] Files over 500 MB are rejected with appropriate error response codes.

---

### TASK S1-05: JdbcConnector: PostgreSQL (8 pts)
* **Goal:** Build the connection pipeline querying external databases to list schemas and extract records.
* **Target Files:**
  * `src/main/java/com/luminai/connection/service/PostgresConnectorService.java`

#### Requirements
1. **External DB Discovery:**
   * Establish temporary JDBC connection using decrypted credentials from Vault.
   * Retrieve list of accessible schemas and tables.
2. **Extract rows:**
   * Query database tables using chunked cursors (e.g., fetch size 1000) to avoid memory overload.

#### Acceptance Criteria
- [ ] Discovery endpoint returns schema metadata.
- [ ] Ingestion job queries database table and extracts rows correctly without OOM crashes.

---

### TASK S1-06: ConnectionProducer (3 pts)
* **Goal:** Publish ingested records onto Kafka streams for backend and processing engines.
* **Target Files:**
  * `src/main/java/com/luminai/connection/producer/ConnectionProducer.java`

#### Requirements
1. **Kafka Event publishing:**
   * Serialize each row record into a standardized JSON message wrapper (payload contents, connection context metadata, tenant information, extract timestamp).
   * Publish onto topic: `ingest.raw`.

#### Acceptance Criteria
- [ ] Triggering a connection sync schedules events on the Kafka topic `ingest.raw`.
- [ ] Event payloads contain valid tenant, connection, and row-level structures.
