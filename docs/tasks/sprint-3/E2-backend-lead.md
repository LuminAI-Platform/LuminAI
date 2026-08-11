## Sprint 3 — Ontology + Graph + Explorer

- **Role:** Backend Lead
- **Primary Focus:** Neo4j Graph Synchronization Consumer and Subgraph / Neighbourhood & Shortest-Path Graph Query APIs.
- **Working Directory:** `core-backend/`
- **Language:** Java 21 + Spring Boot 3.5 + Spring Data Neo4j
- **Total Load:** 16 SP (3 tasks)

---

## 🚫 Dev Rules & Restrictions
* **DO NOT** modify `data-engine/` or `frontend/` code directly.
* All Cypher queries and Neo4j node/edge operations MUST include `tenant_id` property filtering to enforce multi-tenant graph isolation.

---

## 📋 Assigned Tasks

---

### TASK S3-05: GraphSyncConsumer (Neo4j Node & Edge Synchroniser) (8 pts)
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
- [ ] Listening on `entity.resolved` updates Neo4j database nodes and edges.
- [ ] Multi-tenant isolation verified: tenant A nodes cannot connect to tenant B nodes.

---

### TASK S3-06: GraphController — Subgraph & Neighbourhood Query API (5 pts)
* **Goal:** Create graph traversal REST endpoint `/api/v1/graph/neighbourhood` returning nodes and edges up to depth N (1–4) surrounding a target entity ID.
* **Branch:** `feature/S3-06-graph-neighbourhood-api`
* **Target Files:**
  * `src/main/java/com/luminai/graph/controller/GraphController.java`
  * `src/main/java/com/luminai/graph/dto/GraphQueryResponseDto.java`
  * `src/main/java/com/luminai/graph/service/GraphQueryService.java`

#### REST Endpoint
`GET /api/v1/graph/neighbourhood?entityId={id}&depth=2&relationshipType=EMPLOYED_BY`

#### Acceptance Criteria
- [ ] Returns Cytoscape.js compatible JSON format `{ nodes: [...], edges: [...] }`.
- [ ] Depth restricted to max 4 to prevent query timeout.

---

### TASK S3-07: GraphController — Shortest-Path API (3 pts)
* **Goal:** Implement `/api/v1/graph/shortest-path` endpoint executing Neo4j shortestPath Cypher algorithms between two entity node IDs.
* **Branch:** `feature/S3-07-graph-shortest-path-api`
* **Target Files:**
  * `src/main/java/com/luminai/graph/controller/GraphController.java`

#### Acceptance Criteria
- [ ] Returns ordered node and edge path between source and target entity IDs.
- [ ] Returns 404 / empty path if no connection exists between specified entities.
