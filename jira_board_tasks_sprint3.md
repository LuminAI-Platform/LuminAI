# 📋 LuminAI — Jira Board Tasks (Sprint 3)

> **Sprint:** S3 — Ontology + Graph + Explorer (Weeks 8–9)  
> **Team Size:** 6 Engineers  
> **Total Story Points:** 75 SP  
> **Repo:** `LuminAI` (GitHub)  

---

## 🔑 Legend

| Field | Description |
|---|---|
| **Type** | Story / Task |
| **Priority** | 🔴 Critical · 🟠 High · 🟡 Medium |
| **SP** | Story Points |
| **Branch** | Git branch to create |
| **Repo Path** | Where to find/create files in the GitHub repo |

---

## 👤 E1 — Tech Lead / Senior Backend Engineer

> **Working Directory:** `core-backend/`  
> **Stack:** Java 21 + Spring Boot 3.5  

### Task 1 · S3-01: EntityTypeService & OntologyController

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🔴 Critical |
| **SP** | 8 |
| **Branch** | `feature/S3-01-entity-type-service` |

**Description:**
Build CRUD REST APIs for dynamic Ontology Entity Types with JSON schema property validation rules, inheritance, and display metadata.

**Repo Files:**
- `core-backend/src/main/java/com/luminai/ontology/model/EntityType.java`
- `core-backend/src/main/java/com/luminai/ontology/dto/EntityTypeDto.java`
- `core-backend/src/main/java/com/luminai/ontology/controller/EntityTypeController.java`
- `core-backend/src/main/java/com/luminai/ontology/service/EntityTypeService.java`
- `core-backend/src/main/java/com/luminai/ontology/repository/EntityTypeRepository.java`

---

### Task 2 · S3-02: RelationshipTypeService

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🟠 High |
| **SP** | 5 |
| **Branch** | `feature/S3-02-relationship-type-service` |

**Description:**
Build CRUD REST APIs for directional Ontology Relationship Types connecting source and target entity types.

**Repo Files:**
- `core-backend/src/main/java/com/luminai/ontology/model/RelationshipType.java`
- `core-backend/src/main/java/com/luminai/ontology/dto/RelationshipTypeDto.java`
- `core-backend/src/main/java/com/luminai/ontology/controller/RelationshipTypeController.java`

---

### Task 3 · S3-03: OntologyVersionService & Publishing

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🟡 Medium |
| **SP** | 5 |
| **Branch** | `feature/S3-03-ontology-version-service` |

**Description:**
Publish immutable ontology schema release snapshots and calculate schema diffs.

---

### Task 4 · S3-04: Flyway Migration V6 — Ontology Tables

| Field | Value |
|---|---|
| **Type** | Task |
| **Priority** | 🔴 Critical |
| **SP** | 2 |
| **Branch** | `feature/S3-04-flyway-v6-ontology` |

**Description:**
Create `V6__ontology_tables.sql` defining `entity_types`, `relationship_types`, and `ontology_versions` inside `tenant_template`.

---

## 👤 E2 — Backend Lead

> **Working Directory:** `core-backend/`  
> **Stack:** Java 21 + Spring Boot 3.5 + Spring Data Neo4j  

### Task 5 · S3-05: GraphSyncConsumer (Neo4j Sync)

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🔴 Critical |
| **SP** | 8 |
| **Branch** | `feature/S3-05-graph-sync-consumer` |

**Description:**
`@KafkaListener` consuming `entity.resolved` events to sync Golden Records into Neo4j nodes and edges with tenant scoping.

---

### Task 6 · S3-06: GraphController — Neighbourhood Query API

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🟠 High |
| **SP** | 5 |
| **Branch** | `feature/S3-06-graph-neighbourhood-api` |

**Description:**
REST API `/api/v1/graph/neighbourhood` for depth-N Cypher graph traversals.

---

### Task 7 · S3-07: GraphController — Shortest-Path API

| Field | Value |
|---|---|
| **Type** | Task |
| **Priority** | 🟡 Medium |
| **SP** | 3 |
| **Branch** | `feature/S3-07-graph-shortest-path-api` |

**Description:**
Shortest path graph algorithm REST endpoint `/api/v1/graph/shortest-path`.

---

## 👤 E3 — Backend Engineer 2

> **Working Directory:** `core-backend/`  
> **Stack:** Java 21 + Spring Boot 3.5 + OpenSearch + Redis  

### Task 8 · S3-08: IndexSyncConsumer (OpenSearch Indexer)

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🔴 Critical |
| **SP** | 5 |
| **Branch** | `feature/S3-08-opensearch-index-sync` |

**Description:**
`@KafkaListener` consuming `entity.resolved` to index entities into tenant-scoped OpenSearch indexes.

---

### Task 9 · S3-09: ExplorerController — Search & Facets API

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🟠 High |
| **SP** | 5 |
| **Branch** | `feature/S3-09-explorer-search-api` |

**Description:**
Full-text search, facet aggregations, and pagination endpoint `/api/v1/explorer/search`.

---

### Task 10 · S3-10: Redis Query Cache Integration

| Field | Value |
|---|---|
| **Type** | Task |
| **Priority** | 🟡 Medium |
| **SP** | 3 |
| **Branch** | `feature/S3-10-redis-search-cache` |

---

## 👤 E4 — Frontend Developer

> **Working Directory:** `frontend/`  
> **Stack:** React 19 + TypeScript + Vite + Tailwind CSS v4  

### Task 11 · S3-11: Ontology UI — Editor

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🟠 High |
| **SP** | 5 |
| **Branch** | `feature/S3-11-ontology-editor-ui` |

---

### Task 12 · S3-12: Explorer UI — Search Bar & Faceted Cards

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🔴 Critical |
| **SP** | 8 |
| **Branch** | `feature/S3-12-explorer-search-ui` |

---

### Task 13 · S3-13: Entity Detail View & Lineage

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🟠 High |
| **SP** | 5 |
| **Branch** | `feature/S3-13-entity-detail-ui` |

---

## 👤 E5 — DevOps Engineer

> **Working Directory:** `infra/`  

### Task 14 · S3-15: Helm Charts & ArgoCD Setup

| Field | Value |
|---|---|
| **Type** | Story |
| **Priority** | 🟡 Medium |
| **SP** | 5 |
| **Branch** | `feature/S3-15-helm-argocd-setup` |

---

## 👤 E6 — Data / AI Engineer

> **Working Directory:** `data-engine/`  

### Task 15 · S3-14: Cross-Store Data Reconciliation Engine

| Field | Value |
|---|---|
| **Type** | Task |
| **Priority** | 🟡 Medium |
| **SP** | 3 |
| **Branch** | `feature/S3-14-data-reconciliation` |
