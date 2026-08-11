## Sprint 3 — Ontology + Graph + Explorer

- **Role:** Backend Engineer 2
- **Primary Focus:** OpenSearch Full-Text & Faceted Search Indexing (`IndexSyncConsumer`), Explorer Search REST API, and Redis Query Caching.
- **Working Directory:** `core-backend/`
- **Language:** Java 21 + Spring Boot 3.5 + Spring Data OpenSearch + Spring Data Redis
- **Total Load:** 13 SP (3 tasks)

---

## 📋 Assigned Tasks

---

### TASK S3-08: IndexSyncConsumer (OpenSearch Indexer) (5 pts)
* **Goal:** Implement `@KafkaListener` consuming `entity.resolved` events to index Golden Records into OpenSearch tenant-scoped indexes (`tenant_{id}_entities`).
* **Branch:** `feature/S3-08-opensearch-index-sync`
* **Target Files:**
  * `src/main/java/com/luminai/explorer/consumer/IndexSyncConsumer.java`
  * `src/main/java/com/luminai/explorer/service/OpenSearchIndexingService.java`

#### Acceptance Criteria
- [ ] Consuming `entity.resolved` indexes document into OpenSearch with fields `id`, `tenantId`, `canonicalName`, `entityType`, `properties`, `createdAt`.
- [ ] Document updates handle upserts cleanly without duplicate index entries.

---

### TASK S3-09: ExplorerController — Full-Text & Faceted Search API (5 pts)
* **Goal:** Build `/api/v1/explorer/search` REST endpoints supporting fuzzy text search, property facet aggregations, pagination, sorting, and field highlights.
* **Branch:** `feature/S3-09-explorer-search-api`
* **Target Files:**
  * `src/main/java/com/luminai/explorer/controller/ExplorerController.java`
  * `src/main/java/com/luminai/explorer/dto/SearchQueryDto.java`
  * `src/main/java/com/luminai/explorer/dto/SearchResponseDto.java`
  * `src/main/java/com/luminai/explorer/service/ExplorerSearchService.java`

#### Endpoint
`GET /api/v1/explorer/search?query=Alice&entityType=Person&page=0&size=20`

#### Acceptance Criteria
- [ ] Full-text search matches entity names and properties with highlights.
- [ ] Facet aggregations return counts grouped by `entityType`.

---

### TASK S3-10: Redis Query Cache Integration (3 pts)
* **Goal:** Configure Spring `@Cacheable` with Redis cache manager (60 s TTL) for frequent Explorer search queries and entity detail views.
* **Branch:** `feature/S3-10-redis-search-cache`
* **Target Files:**
  * `src/main/java/com/luminai/config/CacheConfig.java`

#### Acceptance Criteria
- [ ] Subsequent identical search queries hit Redis cache with response time < 50 ms.
- [ ] Cache keys include active `tenantId` to prevent cross-tenant data caching.
