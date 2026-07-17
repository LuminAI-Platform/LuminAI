# 🧑‍💻 DevOps Task Sheet: Sprint 1 Integration & Local Environment Fixes

While the basic sandbox environment setup is complete, we have hit critical blockers in wiring up our data connection interfaces and enabling end-to-end local/cloud testing. 

Please complete the following integration tasks as soon as possible to unblock the backend and data engineering teams.

---

## 📋 Summary of New Tasks
* **Task 28 (S1-D6):** Aiven Kafka Cluster Setup & Render Environment Config (🔴 *Critical Blocker*)
* **Task 29 (S1-D7):** Expand Local `docker-compose.yml` for Zookeeper & Kafka (🟠 *High Priority*)
* **Task 30 (S1-D8):** Provision S3-Compatible Cloud Storage (AWS S3/Cloudflare R2) (🟠 *High Priority*)
* **Task 31 (S1-D9):** Keycloak Client Redirect & Web Origin Updates for Vercel (🟠 *High Priority*)
* **Task 32 (S1-D10):** Add OpenAPI Client Codegen to Frontend CI Workflow (🟡 *Medium Priority*)

---

## 🛠️ Detailed Task Outlines

### 🔴 TASK 28 · S1-D6: Aiven Kafka Cluster Setup & Render Config

> **⚠️ NOTE:** Upstash Kafka was decommissioned on March 11, 2025. We are using **Aiven for Apache Kafka** (free tier) as a drop-in replacement. The same SASL/SCRAM-SHA-256 authentication protocol is supported — no backend code changes needed.

* **Goal:** Set up a managed Kafka broker for the deployed dev environments.
* **Why it's needed:** The backend and data-engine on Render cannot connect to `localhost:9092`. They need a cloud-accessible broker to publish and consume raw rows.
* **Instructions:**
  1. Sign up at [aiven.io](https://aiven.io) and create a **free-tier Apache Kafka** service (select the region closest to your Render services).
  2. In the Aiven Console, go to your Kafka service → **Topics** and create:
     * `ingest.raw` (Partitions: 6, Cleanup policy: Delete)
     * `ingest.dead_letter` (Partitions: 1, Cleanup policy: Delete)
  3. Go to your Kafka service → **Overview** → **Connection information** and note the:
     * **Service URI** (this is the bootstrap server, e.g., `kafka-xxxxxxxx-your-org.aiven.com:12345`)
     * **SASL credentials** (username & password for SCRAM-SHA-256)
  4. In the **Render Dashboard**, update the environment variables for `luminai-core` (Spring Boot Web Service) and `data-engine` (FastAPI Web Service) with:
     * `KAFKA_BOOTSTRAP_SERVERS` → Aiven Service URI
     * `KAFKA_USERNAME` → Aiven SASL username
     * `KAFKA_PASSWORD` → Aiven SASL password
  5. Verify that Aiven's Kafka requires `SASL_SSL` with `SCRAM-SHA-256` — this matches our existing `application-prod.yml` config. If Aiven's free tier uses client certificate auth instead, update `application-prod.yml` security protocol accordingly.
* **Acceptance Criteria:**
  - [ ] Aiven Kafka instance is live and accessible.
  - [ ] Topics `ingest.raw` and `ingest.dead_letter` exist on the cluster.
  - [ ] Both Render apps are configured and do not crash on startup when initializing Kafka connection factories.

---

### 🟠 TASK 29 · S1-D7: Expand Local `docker-compose.yml` with Kafka & Zookeeper
* **Goal:** Allow local backend and python developers to run integration tests without cloud dependencies.
* **Why it's needed:** The root `docker-compose.yml` is missing Kafka, but local configurations default to `localhost:9092`.
* **Instructions:**
  Update the root [docker-compose.yml](../../../docker-compose.yml) to add Zookeeper and Kafka broker containers. Add the following services:
  ```yaml
    zookeeper:
      image: confluentinc/cp-zookeeper:7.4.0
      environment:
        ZOOKEEPER_CLIENT_PORT: 2181
      networks:
        - luminai-net

    kafka:
      image: confluentinc/cp-kafka:7.4.0
      ports:
        - "9092:9092"
      environment:
        KAFKA_BROKER_ID: 1
        KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
        KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:29092,PLAINTEXT_HOST://localhost:9092
        KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
        KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      depends_on:
        - zookeeper
      networks:
        - luminai-net
  ```
* **Acceptance Criteria:**
  - [ ] `docker compose up -d` boots Zookeeper and Kafka successfully.
  - [ ] Local Kafka broker is accessible on `localhost:9092`.

---

### 🟠 TASK 30 · S1-D8: Cloud Object Storage Configuration (S3/R2)
* **Goal:** Enable persistent raw file uploads in the deployed dev environments.
* **Why it's needed:** Render disks are ephemeral. Local MinIO storage inside Render containers will delete uploaded datasets on restart.
* **Instructions:**
  1. Provision a bucket on AWS S3 (free tier) or Cloudflare R2 (free tier) named `luminai-raw-dev`.
  2. Create an IAM user/token with read/write access to this bucket.
  3. In the **Render Dashboard**, update environment variables for `luminai-core` and `data-engine` to point to this bucket instead of `localhost:9000`:
     * `MINIO_ENDPOINT` (Set to the AWS/Cloudflare endpoint URL)
     * `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY`
     * `MINIO_SECURE` (`true`)
* **Acceptance Criteria:**
  - [ ] Bucket created and connection variables are configured on Render web services.

---

### 🟠 TASK 31 · S1-D9: Configure Keycloak Redirect URIs and Web Origins for Production
* **Goal:** Fix auth redirects on the live client app.
* **Why it's needed:** Keycloak is currently configured with `http://localhost:5173`. When accessing the live Vercel URL, Keycloak blocks login redirects.
* **Instructions:**
  1. Access the Keycloak Admin Console running on Render.
  2. Select the `luminai` realm.
  3. Go to **Clients** → Select `luminai-spa`.
  4. In the client settings:
     * Add your Vercel deployment URL (e.g. `https://luminai-frontend.vercel.app/*`) to the **Valid Redirect URIs**.
     * Add your Vercel deployment URL (e.g. `https://luminai-frontend.vercel.app`) to the **Web Origins**.
* **Acceptance Criteria:**
  - [ ] The client redirects back to Vercel after a successful login without OAuth redirect mismatch errors.

---

### 🟡 TASK 32 · S1-D10: CI/CD Pipeline Automation (OpenAPI Client Codegen)
* **Goal:** Prevent backend API changes from breaking the frontend build.
* **Why it's needed:** If the backend controller endpoints change, the frontend client files must regenerate and validate during pull requests.
* **Instructions:**
  Update the frontend workflow `.github/workflows/ci-frontend.yml` to automatically execute OpenAPI generator compilation before verifying the production build:
  ```yaml
    - name: Generate OpenAPI API Client
      run: npm run generate:api
      working-directory: frontend
  ```
* **Acceptance Criteria:**
  - [ ] Frontend pull request pipeline builds API client dependencies automatically and passes compilation checks.
