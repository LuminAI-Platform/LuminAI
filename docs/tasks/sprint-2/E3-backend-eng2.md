## Sprint 2 — Pipeline + Entity Resolution

- **Role:** Backend Engineer 2
- **Primary Focus:** Kafka Event Listeners (`ingest.valid` & `entity.resolved`), Event Bridge to WebSockets/SSE for real-time frontend status, and Data Engine event routing.
- **Working Directory:** `core-backend/`
- **Language:** Java 21 + Spring Boot 3.5
- **Total Load:** 8 SP (2 tasks)

---

## 🚫 Dev Rules & Restrictions
* **DO NOT** modify `frontend/` or `data-engine/` code directly.
* All Kafka listeners must have error handlers configured.
* Ensure all async tasks maintain `TenantContext` propagation.

---

## 📋 Assigned Tasks

---

### TASK S2-20: Kafka Listeners for Ingestion & ER Events (5 pts)
* **Goal:** Implement `@KafkaListener` handlers in the Core Backend to consume `ingest.valid` and `entity.resolved` events emitted by the Data Engine, updating job statuses and entity counts in real time.
* **Branch:** `feature/S2-20-kafka-listeners-pipeline`
* **Target Files:**
  * `src/main/java/com/luminai/connection/consumer/PipelineEventConsumer.java` 
  * `src/main/java/com/luminai/connection/consumer/EntityResolvedConsumer.java` 

#### Requirements

1. **Listener 1: `ingest.valid`**
   * Listens on topic `ingest.valid`.
   * Updates `PipelineRun` entity status to `CLEANED` or `VALIDATED`.
   * Increments `records_output` counters.

2. **Listener 2: `entity.resolved`**
   * Listens on topic `entity.resolved`.
   * Updates `PipelineRun` status to `COMPLETED`.
   * Saves resolved golden record summaries to database.

#### Acceptance Criteria
- [ ] Listening on `ingest.valid` updates pipeline run status in database.
- [ ] Listening on `entity.resolved` marks pipeline run `COMPLETED`.
- [ ] Failed events are routed to DLQ topic `ingest.dead_letter`.
- [ ] `./gradlew spotlessCheck build -x test` passes.

---

### TASK S2-21: Real-time Pipeline Progress Event Bridge (3 pts)
* **Goal:** Create a Server-Sent Events (SSE) controller endpoint `/api/v1/pipelines/stream` so the frontend UI can stream real-time pipeline progress updates without polling.
* **Branch:** `feature/S2-21-pipeline-sse-bridge`
* **Target Files:**
  * `src/main/java/com/luminai/connection/PipelineSseController.java`

#### Requirements
1. `GET /api/v1/pipelines/stream` returning `SseEmitter`.
2. Emits pipeline progress events (`JOB_PROGRESS`, `RECORD_CLEANED`, `ENTITY_MATCHED`, `JOB_COMPLETE`) to connected clients.

#### Acceptance Criteria
- [ ] Clients connecting to `/api/v1/pipelines/stream` receive live event pushes.
- [ ] Emitter disconnects are cleaned up without leaking memory or threads.
