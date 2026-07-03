# 🧑‍💻 E2 — Backend Lead Sprint 1 Task Sheet

## Sprint 1 — Data Connection (Weeks 3–4)

- **Role:** Backend Lead / Senior Developer
- **Primary Focus:** Sprint 0 carry-over Kafka configuration (Day 1 blocker), then file and database connector logic, raw storage uploads, and event publication onto Kafka queues.
- **Working Directory:** `core-backend/`
- **Language:** Java 21 + Spring Boot 3.5
- **Total Load:** 22 SP (3 SP carry-over + 19 SP new)

---

## 🔴 Carry-Over Warning
* **S0-04 (Kafka Config)** was not merged in Sprint 0. It **MUST** be completed on **Day 1** before starting any Sprint 1 tasks. It is a hard blocker for S1-06 (ConnectionProducer) and E6's Kafka consumer.

---

## 🚫 Dev Rules & Restrictions
* **DO NOT** modify frontend, data-engine, or other backend domains unless reassigned.
* **DO NOT** commit raw credentials, environment files, or keys.
* **DO NOT** push directly to `main`. Always push to feature branch and open a PR.

---

## 📋 Assigned Tasks

---

### 🔴 TASK S0-04: Spring Kafka Configuration & Topics (3 pts) — CARRY-OVER / DAY 1 BLOCKER
* **Goal:** Configure Spring Kafka connection factories, templates, retry listeners, error handling, and auto-provision 7 Kafka topics on startup.
* **Branch:** `feature/S0-04-kafka-config`
* **Target Files:**
  * `src/main/java/com/luminai/config/KafkaConfig.java` *(review/fix — file exists but was not accepted)*
  * `src/main/resources/application-dev.yml` *(update)*

#### Requirements
1. **Kafka Connection Setup:**
   * Configure producer and consumer factory beans with appropriate serializers/deserializers.
   * Set up retry listeners and error handling with dead-letter queue recovery.
2. **Topic Provisioning:**
   * Auto-create 7 topics on startup: `ingest.raw`, `ingest.valid`, `entity.resolved`, `entity.updated`, `audit.log`, `alerts.triggered`, `ingest.dead_letter`.

#### Acceptance Criteria
- [ ] Spring Boot boots up successfully and registers connection factories.
- [ ] All 7 topics are auto-created in the local broker.
- [ ] Failed messages trigger dead-letter queue routing to `ingest.dead_letter`.

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
