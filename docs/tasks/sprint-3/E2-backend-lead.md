## Sprint 3 — Ontology + Graph + Explorer

- **Role:** Backend Lead
- **Primary Focus:** Neo4j Graph Synchronization, Graph Query APIs, OpenSearch Full-Text & Faceted Search Indexing, Explorer Search REST API, and Redis Query Caching.
- **Working Directory:** `core-backend/`
- **Language:** Java 21 + Spring Boot 3.5 + Spring Data Neo4j + OpenSearch + Redis
- **Total Load:** 29 SP (6 tasks) — ✅ **COMPLETED (29/29 SP)**

---

## 🚫 Dev Rules & Restrictions
* **DO NOT** modify `data-engine/` or `frontend/` code directly.
* All Cypher queries and Neo4j node/edge operations MUST include `tenant_id` property filtering to enforce multi-tenant graph isolation.
* All OpenSearch queries and indexes MUST be scoped by active tenant (`tenant_{id}_entities`).

---

## 📋 Assigned Tasks

---

### TASK S3-05: GraphSyncConsumer (Neo4j Node & Edge Synchroniser) (8 pts) — ✅ COMPLETED
* **Goal:** Implement a `@KafkaListener` in `core-backend` to consume `entity.resolved` events emitted by the Data Engine, creating or updating Neo4j graph nodes and edges in real time.
* **Branch:** `feature/S3-05-graph-sync-consumer`
* **Target Files:**
  * `src/main/java/com/luminai/graph/consumer/GraphSyncConsumer.java`
  * `src/main/java/com/luminai/graph/service/Neo4jSyncService.java`
  * `src/main/java/com/luminai/graph/repository/Neo4jGraphRepository.java`

#### Requirements
1. Consume `entity.resolved` topic events.
2. Construct/MERGE Neo4j nodes with label `:Entity` and properties `id`, `tenant_id`, `canonical_name`, `entity_type`.
3. Construct/MERGE Neo4j directional edges connecting resolved entities.

#### Acceptance Criteria
- [x] Listening on `entity.resolved` updates Neo4j database nodes and edges.
- [x] Multi-tenant isolation verified: tenant A nodes cannot connect to tenant B nodes.

---

### TASK S3-06: GraphController — Subgraph & Neighbourhood Query API (5 pts) — ✅ COMPLETED
* **Goal:** Create graph traversal REST endpoint `/api/v1/graph/neighbourhood` returning nodes and edges up to depth N (1–4) surrounding a target entity ID.
* **Branch:** `feature/S3-06-graph-neighbourhood-api`
* **Target Files:**
  * `src/main/java/com/luminai/graph/controller/GraphController.java`
  * `src/main/java/com/luminai/graph/dto/GraphQueryResponseDto.java`
  * `src/main/java/com/luminai/graph/service/GraphQueryService.java`

#### REST Endpoint
`GET /api/v1/graph/neighbourhood?entityId={id}&depth=2&relationshipType=EMPLOYED_BY`

#### Acceptance Criteria
- [x] Returns Cytoscape.js compatible JSON format `{ nodes: [...], edges: [...] }`.
- [x] Depth restricted to max 4 to prevent query timeout.

---

### TASK S3-07: GraphController — Shortest-Path API (3 pts) — ✅ COMPLETED
* **Goal:** Implement `/api/v1/graph/shortest-path` endpoint executing Neo4j shortestPath Cypher algorithms between two entity node IDs.
* **Branch:** `feature/S3-07-graph-shortest-path-api`
* **Target Files:**
  * `src/main/java/com/luminai/graph/controller/GraphController.java`

#### Acceptance Criteria
- [x] Returns ordered node and edge path between source and target entity IDs.
- [x] Returns 404 / empty path if no connection exists between specified entities.

---

### TASK S3-08: IndexSyncConsumer (OpenSearch Indexer) (5 pts) — ✅ COMPLETED
* **Goal:** Implement `@KafkaListener` consuming `entity.resolved` events to index Golden Records into OpenSearch tenant-scoped indexes (`tenant_{id}_entities`).
* **Branch:** `feature/S3-08-opensearch-index-sync`
* **Target Files:**
  * `src/main/java/com/luminai/explorer/consumer/IndexSyncConsumer.java`
  * `src/main/java/com/luminai/explorer/service/OpenSearchIndexingService.java`

#### Acceptance Criteria
- [x] Consuming `entity.resolved` indexes document into OpenSearch with fields `id`, `tenantId`, `canonicalName`, `entityType`, `properties`, `createdAt`.
- [x] Document updates handle upserts cleanly without duplicate index entries.

---

### TASK S3-09: ExplorerController — Full-Text & Faceted Search API (5 pts) — ✅ COMPLETED
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
- [x] Full-text search matches entity names and properties with highlights.
- [x] Facet aggregations return counts grouped by `entityType`.

---

### TASK S3-10: Redis Query Cache Integration (3 pts) — ✅ COMPLETED
* **Goal:** Configure Spring `@Cacheable` with Redis cache manager (60 s TTL) for frequent Explorer search queries and entity detail views.
* **Branch:** `feature/S3-10-redis-search-cache`
* **Target Files:**
  * `src/main/java/com/luminai/config/CacheConfig.java`

#### Acceptance Criteria
- [x] Subsequent identical search queries hit Redis cache with response time < 50 ms.
- [x] Cache keys include active `tenantId` to prevent cross-tenant data caching.


