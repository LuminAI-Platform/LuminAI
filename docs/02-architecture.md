# LuminAI — System Architecture

> **Status:** Sprint 0 — Foundation  
> **Architecture:** Modular Monolith (Java) + Data Engine (Python) + SPA (React)  
> **Cloud:** AWS (EKS, RDS, MSK, S3, OpenSearch Service, ElastiCache)  
> **Philosophy:** Ontology-centric data operating system

---

## 1. Architecture Principles

| # | Principle | Description |
|---|---|---|
| 1 | **Ontology at the Center** | The Ontology is the heart of the platform. Everything feeds data **into** the Ontology or consumes data **from** it. |
| 2 | **Layered Architecture** | Architecture follows a clear layer model: **Data Connection → Pipeline → Ontology → Applications**. |
| 3 | **Modular Monolith** | Clean domain packages inside a single Spring Boot deployment. Extract to services when scale demands. |
| 4 | **3-Language Stack** | Java for business logic. Python for data/AI. TypeScript for frontend. Each language plays to its strength. |
| 5 | **Event-Driven** | Kafka for the data pipeline (connect → pipeline → resolve → index). Sync REST for user-facing queries. |
| 6 | **API-First** | Every capability exposed as a versioned REST API. OpenAPI 3.1 auto-generated (SpringDoc). |
| 7 | **Multi-Tenant** | Hibernate `@TenantId` with schema-per-tenant isolation. Enforced at every layer. |
| 8 | **Cloud-Native** | Docker containers, Kubernetes orchestration, Terraform IaC, ArgoCD GitOps. |
| 9 | **Zero-Trust Security** | JWT auth (Keycloak), policy-based authz (OPA), mTLS between services. |
| 10 | **Observability** | OpenTelemetry Java Agent for zero-code traces; structured JSON logs; Prometheus metrics. |

---

## 2. High-Level System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                             │
│  React SPA · Partner APIs · CLI/SDK                                         │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │ HTTPS / WSS
                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│              API GATEWAY (AWS API Gateway / Kong)                            │
│  Rate limiting · API versioning · Throttling · Request logging · WAF        │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│            CORE BACKEND — Java 21 + Spring Boot 3.3                         │
│                                                                              │
│  Layered Architecture → Domain Packages (one JVM, clean boundaries)        │
│                                                                              │
│  CONNECTION  auth · connection · ontology             ← Data Connection      │
│  ONTOLOGY    ontology · graph                        ← Ontology (heart)     │
│  EXPLORER    explorer                                ← Object Explorer      │
│  APPS        dashboard · collaboration                ← Applications         │
│  AUTOMATE    automate · notification · audit          ← Automate             │
│                                                                              │
│  Shared: Spring Data JPA · Spring Kafka · Spring Data Neo4j ·               │
│          Spring Security · Flyway · Redis (Lettuce) · MinIO SDK             │
└───────────────────┬──────────────────────────────────┬───────────────────────┘
                    │ Kafka (async)                     │ HTTP (sync)
                    ▼                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│            DATA & AI ENGINE — Python 3.12 + FastAPI + Dagster               │
│                                            ← Pipeline Builder              │
│  Pipeline · Entity Resolution · Analytics · AI/ML                           │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                          DATA STORES                                         │
│  PostgreSQL 16 (+ PgBouncer) · Neo4j 5 · OpenSearch 2 · MinIO · Redis 7 ·  │
│  Kafka                                                                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Architecture Layer Mapping

| Layer | LuminAI Component | What It Does |
|---|---|---|
| **Data Connection** | `connection` package (Java) | Connectors, syncs, file upload, schema mapping |
| **Pipeline Builder** | Data Engine (Python) | Clean, normalise, deduplicate, entity resolution |
| **Ontology** | `ontology` + `graph` packages (Java) | Object Types, Link Types, Properties, versioning |
| **Applications** | `explorer` + `dashboard` + `collaboration` (Java) + React SPA | Search, graph viz, dashboards, reports, workspaces |
| **Automate** | `automate` + `notification` (Java) | Rule engine, triggers, alerts, notifications |
| **AI Engine** | Data Engine (Python) | NL queries, anomaly detection, insights |

---

## 3. The 3 Deployable Units

| Deployable | Language | Framework | Pods (K8s) | Scaling |
|---|---|---|---|---|
| **Frontend** | TypeScript 5 | React 19 + Vite (Nginx) | 2 | CDN + static |
| **Core Backend** | Java 21 | Spring Boot 3.3 | 2–8 | HPA on CPU + JVM metrics |
| **Data Engine** | Python 3.12 | FastAPI + Dagster | 2–6 | HPA on CPU / KEDA on Kafka lag |

---

## 4. Core Backend — Domain Package Architecture

### 4.1 Package Map

Spring Boot organises code by **domain packages** under `com.luminai.*`. Each package encapsulates its own controllers, services, repositories, DTOs, and domain models. Cross-package communication uses Spring's DI (`@Autowired`, constructor injection).

```
com.luminai/
│
├── config/                    ← Global configuration
│   ├── SecurityConfig.java        Spring Security filter chain, JWT resource server
│   ├── KafkaConfig.java           Kafka consumer/producer factory
│   ├── Neo4jConfig.java           Neo4j session factory
│   ├── OpenSearchConfig.java      OpenSearch REST client
│   ├── RedisConfig.java           Cache manager, Redis template
│   ├── WebSocketConfig.java       STOMP broker configuration
│   └── MultiTenancyConfig.java    TenantIdentifierResolver, schema routing
│
├── common/
│   ├── tenant/
│   │   ├── TenantContext.java              ThreadLocal tenant holder
│   │   ├── TenantFilter.java              Servlet filter: extract from JWT, set context
│   │   └── TenantIdentifierResolver.java  Hibernate: route to tenant schema
│   ├── security/
│   │   ├── JwtClaimsExtractor.java        Extract roles, tenant_id from JWT
│   │   ├── OpaClient.java                 HTTP client to OPA sidecar
│   │   └── CurrentTenant.java             @CurrentTenant annotation
│   ├── exception/
│   │   ├── GlobalExceptionHandler.java    @ControllerAdvice
│   │   ├── ApiError.java                  Standard error response
│   │   └── ResourceNotFoundException.java
│   └── audit/
│       └── AuditInterceptor.java          Publish audit events to Kafka
│
├── auth/                      ← Authentication & user management
│   ├── AuthController.java          Login redirect, token refresh, user info
│   ├── AuthService.java             Keycloak admin client, role sync
│   ├── model/User.java              @Entity
│   └── dto/LoginResponse.java
│
├── connection/                ← Data Connection
│   ├── ConnectionController.java   REST: upload, connect, sync status
│   ├── ConnectionService.java      Orchestrate connectors
│   ├── connector/
│   │   ├── FileConnector.java           CSV, JSON, Excel, Parquet (Apache POI, Jackson)
│   │   ├── JdbcConnector.java           PostgreSQL, MySQL, SQL Server (JDBC)
│   │   ├── RestApiConnector.java        Configurable HTTP client (WebClient)
│   │   └── WebhookReceiver.java         Inbound event receiver
│   ├── schema/
│   │   ├── SchemaDetector.java          Infer types from sample rows
│   │   └── SchemaMapper.java            Source field → ontology property
│   ├── sync/
│   │   └── SyncScheduler.java           Spring @Scheduled / Quartz
│   ├── kafka/
│   │   └── ConnectionProducer.java      Publish to ingest.raw
│   ├── model/
│   │   ├── Connector.java               @Entity
│   │   ├── SyncJob.java                 @Entity
│   │   └── SchemaMapping.java           @Entity
│   └── dto/
│
├── ontology/                  ← Entity types, relationship types, versioning
│   ├── OntologyController.java      REST: CRUD entity/rel types
│   ├── EntityTypeService.java
│   ├── RelationshipTypeService.java
│   ├── OntologyVersionService.java  Version, publish, deprecate
│   ├── model/
│   │   ├── EntityType.java          @Entity
│   │   ├── RelationshipType.java    @Entity
│   │   ├── PropertyDefinition.java  @Entity
│   │   └── OntologyVersion.java     @Entity
│   └── dto/
│
├── explorer/                  ← Object Explorer
│   ├── ExplorerController.java      REST: full-text, faceted search, object explore
│   ├── ExplorerService.java         Query builder, result ranking
│   ├── IndexSyncConsumer.java       @KafkaListener(topics = "entity.resolved")
│   ├── IndexSchemaManager.java      Create/update tenant indices
│   └── dto/
│
├── graph/                     ← Neo4j reads, writes, analytics
│   ├── GraphController.java         REST: neighbourhood, path-find, stats
│   ├── GraphService.java            Cypher queries, GDS calls
│   ├── GraphSyncConsumer.java       @KafkaListener(topics = "entity.resolved")
│   ├── model/
│   │   ├── GraphEntity.java         @Node (Spring Data Neo4j)
│   │   └── GraphRelationship.java   @Relationship
│   └── dto/
│
├── dashboard/                 ← Dashboard CRUD, widget framework
│   ├── DashboardController.java     REST: CRUD dashboards + widgets
│   ├── DashboardService.java
│   ├── WidgetService.java           Widget type registry
│   ├── DataAggregationClient.java   HTTP → Python Data Engine /analytics
│   ├── model/
│   │   ├── Dashboard.java           @Entity
│   │   └── Widget.java              @Entity (JSONB config)
│   └── dto/
│
├── collaboration/             ← Workspaces, comments, annotations
│   ├── CollabController.java        REST: workspace, comment CRUD
│   ├── WorkspaceService.java
│   ├── CommentService.java
│   ├── model/
│   │   ├── Workspace.java           @Entity
│   │   ├── Comment.java             @Entity
│   │   └── Annotation.java          @Entity
│   └── dto/
│
├── notification/              ← Alert rules, delivery channels
│   ├── NotificationController.java  REST: alert rules, history
│   ├── AlertRuleService.java
│   ├── NotificationConsumer.java    @KafkaListener(topics = "alerts.triggered")
│   ├── channel/
│   │   ├── EmailSender.java         SendGrid / SES
│   │   ├── WebSocketSender.java     STOMP push
│   │   └── WebhookSender.java       Outbound HTTP
│   ├── model/
│   │   ├── AlertRule.java           @Entity
│   │   └── Notification.java        @Entity
│   └── dto/
│
├── automate/                  ← Automate
│   ├── AutomateController.java      REST: automation rule CRUD
│   ├── RuleEngine.java              Evaluate conditions, execute actions
│   ├── AutomateConsumer.java        @KafkaListener(topics = "entity.resolved")
│   ├── action/
│   │   ├── AlertAction.java         Trigger notification
│   │   ├── WebhookAction.java       Call external webhook
│   │   └── TagAction.java           Tag entity
│   ├── model/
│   │   ├── AutomationRule.java      @Entity
│   │   └── AutomationExecution.java @Entity
│   └── dto/
│
└── audit/                     ← Immutable audit trail
    ├── AuditConsumer.java           @KafkaListener(topics = "audit.log")
    ├── AuditService.java            Write to PG + index in OpenSearch
    ├── model/AuditEvent.java        @Entity
    └── dto/
```

### 4.2 Module Responsibilities

| Package | Layer | What It Does | Data Owned (PostgreSQL) | External Systems |
|---|---|---|---|---|
| **auth** | Platform | JWT validation, RBAC guards, Keycloak OIDC, tenant context | `users`, `roles`, `tenant_memberships` + Redis sessions | Keycloak, OPA |
| **connection** | Data Connection | File upload → MinIO, DB/API connectors, schema mapping, Kafka producer, sync scheduling | `connectors`, `sync_jobs`, `schema_mappings` | MinIO, Kafka, external DBs/APIs |
| **ontology** | Ontology | Entity/relationship type CRUD, property schemas, versioning, migration scripts | `entity_types`, `relationship_types`, `property_definitions`, `ontology_versions` | — |
| **explorer** | Applications | Kafka → OpenSearch index sync, full-text queries, faceted search, Redis query cache | OpenSearch indices, Redis cache | OpenSearch |
| **graph** | Ontology | Kafka → Neo4j node/edge writes, neighbourhood queries, shortest-path, graph analytics | Neo4j nodes + edges | Neo4j |
| **dashboard** | Applications | Dashboard/widget CRUD, data aggregation (proxies to Python), sharing | `dashboards`, `widgets`, `shared_links` | Data Engine (HTTP) |
| **collaboration** | Applications | Workspaces, comments, annotations, activity feed | `workspaces`, `comments`, `annotations` | — |
| **notification** | Automate | Alert rules, Kafka → delivery (email/WebSocket/webhook) | `alert_rules`, `notifications` | SendGrid, WebSocket |
| **automate** | Automate | Rule definitions, trigger evaluation (Kafka), action execution, logging | `automation_rules`, `automation_executions` | Kafka, notification package |
| **audit** | Platform | Kafka → immutable audit records in PG + searchable index in OpenSearch | `audit_events` | OpenSearch |

### 4.3 Key Spring Boot Patterns

**Multi-Tenancy (Hibernate built-in):**
```java
@Component
public class LuminTenantIdentifierResolver implements TenantIdentifierResolver {
    @Override
    public String resolveCurrentTenantIdentifier() {
        return TenantContext.getCurrentTenant(); // ThreadLocal, set by TenantFilter
    }
}

// In MultiTenancyConfig.java:
// Hibernate property: hibernate.multiTenancy = SCHEMA
// Each tenant gets: SET search_path = tenant_{tenantId}
```

**Kafka Consumer (declarative):**
```java
@Component
public class IndexSyncConsumer {
    @KafkaListener(topics = "entity.resolved", groupId = "core-backend-search")
    public void onEntityResolved(@Payload EntityResolvedEvent event) {
        searchService.indexEntity(event.tenantId(), event.entityId(), event.properties());
    }
}
```

**Security (method-level):**
```java
@RestController
@RequestMapping("/api/v1/ontology")
public class OntologyController {

    @PreAuthorize("hasRole('ADMIN') or hasRole('ENGINEER')")
    @PostMapping("/entity-types")
    public EntityTypeResponse createEntityType(@Valid @RequestBody CreateEntityTypeRequest req) {
        return ontologyService.createEntityType(req);
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'ENGINEER', 'ANALYST', 'VIEWER')")
    @GetMapping("/entity-types")
    public List<EntityTypeResponse> listEntityTypes() {
        return ontologyService.listEntityTypes();
    }
}
```

---

## 5. Data & AI Engine (Python)

### 5.1 Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  FastAPI + Dagster Daemon                                            │
│                                                                      │
│  Pipeline · Entity Resolution · Analytics · AI/ML                           │
└──────────────────────────────────────────────────────────────────────┘
│  Kafka ← raw       Kafka ← valid        REST in        REST in    │
│  Dagster DAGs       Block → Compare      DuckDB OLAP   LangChain  │
│  Clean/Norm/Dedup   Classify → Merge     Group/Agg     NL→SQL     │
│  → Kafka valid      → Kafka resolved     TimeSeries    Anomaly    │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.2 API Endpoints
```
POST  /process/trigger                # Trigger Dagster pipeline
GET   /process/status/{runId}         # Pipeline run status
POST  /analytics/query                # Ad-hoc aggregation
POST  /analytics/timeseries           # Time-series rollups
POST  /ai/nl-query                    # Natural language → SQL/Cypher → result
POST  /ai/anomaly/run                 # Run anomaly detection
GET   /health                         # Liveness
```

### 5.3 Communication with Core Backend
```
Core Backend (Java)                      Data Engine (Python)
       │                                        │
       │ ── HTTP POST /process/trigger ──────→  │  (Trigger pipeline)
       │ ── HTTP POST /analytics/query ──────→  │  (Dashboard data)
       │ ── HTTP POST /ai/nl-query ──────────→  │  (NL question)
       │                                        │
       │ ◀── Kafka: entity.resolved ──────────  │  (ER results)
       │ ◀── Kafka: alerts.triggered ─────────  │  (Anomaly alerts)
```

---

## 6. End-to-End Data Flow

```
1. User uploads CSV                                     [DATA CONNECTION]
   React → POST /api/v1/connection/upload → Spring Boot (ConnectionController)

2. ConnectionService parses file, validates schema
   → MinIO (/{tenant}/raw/) + Kafka: ingest.raw + returns sync job ID

3. Data Engine (Pipeline) consumes ingest.raw            [PIPELINE BUILDER]
   → Dagster: clean → normalise → dedup → transform
   → MinIO (/{tenant}/staging/) + Kafka: ingest.valid

4. Data Engine (Entity Resolution) consumes ingest.valid [PIPELINE BUILDER]
   → Block → Compare → Classify → Cluster → Merge
   → PostgreSQL (entities table) + Kafka: entity.resolved

5. Core Backend consumes entity.resolved:                [ONTOLOGY]
   → IndexSyncConsumer: indexes in OpenSearch
   → GraphSyncConsumer: creates/updates Neo4j nodes + edges

6. User searches                                        [EXPLORER]
   React → GET /api/v1/explorer?q=... → ExplorerController → OpenSearch

7. User explores graph                                  [EXPLORER]
   React → GET /api/v1/graph/{id}/neighbourhood → GraphController → Neo4j

8. User views dashboard                                 [APPLICATIONS]
   React → GET /api/v1/dashboards/{id} → DashboardController
   → Config from PG + data from Data Engine (/analytics/query) → ECharts
```

---

## 7. Kafka Topic Design

| Topic | Producer | Consumer | Key | Partitions |
|---|---|---|---|---|
| `ingest.raw` | Core Backend (Connection) | Data Engine (Pipeline) | `{tenant}:{source}` | 6 |
| `ingest.valid` | Data Engine (Pipeline) | Data Engine (ER) | `{tenant}:{type}` | 6 |
| `ingest.dead_letter` | Data Engine | Ops monitoring | original key | 3 |
| `entity.resolved` | Data Engine (ER) | Core Backend (Search, Graph) | `{tenant}:{entity_id}` | 6 |
| `entity.updated` | Core Backend (Ontology) | Core Backend (Search) | `{tenant}:{entity_id}` | 3 |
| `analytics.results` | Data Engine (Analytics) | Core Backend (Dashboard) | `{tenant}:{job_id}` | 3 |
| `alerts.triggered` | Data Engine (Anomaly) | Core Backend (Notification) | `{tenant}:{alert_id}` | 3 |
| `automate.events` | Core Backend (Automate) | Core Backend (Notification) | `{tenant}:{rule_id}` | 3 |
| `audit.log` | Both | Core Backend (Audit) | `{tenant}:{user_id}` | 6 |

---

## 8. Multi-Tenancy

| Layer | Strategy |
|---|---|
| **PostgreSQL** | Schema-per-tenant via Hibernate `TenantIdentifierResolver`. Each tenant: `SET search_path = tenant_{id}`. **PgBouncer / RDS Proxy** in front to prevent connection exhaustion during schema switching. |
| **Neo4j** | Label-prefix per tenant (`ACME_Person`, `ACME_Organisation`). All Cypher queries MUST include tenant label filter. Integration tests verify isolation. |
| **OpenSearch** | Index-per-tenant (`acme-entities`, `globex-entities`). |
| **MinIO** | Bucket-per-tenant (`acme-raw/`, `acme-staging/`). |
| **Redis** | Key-prefix (`acme:session:...`, `acme:cache:...`). |
| **Kafka** | Tenant ID in message key; consumer filtering. |

**Enforcement flow:**
```
JWT { tenant_id: "acme", roles: ["analyst"] }
  → API Gateway (rate limit, WAF, request logging)
  → TenantFilter (Servlet) → sets TenantContext (ThreadLocal)
  → Hibernate TenantIdentifierResolver → selects schema
  → PgBouncer / RDS Proxy → connection pooling
  → OPA policy → validates tenant + role access
  → Database → physically isolated per schema
```

---

## 9. Resilience Patterns

| Pattern | Implementation |
|---|---|
| **Circuit Breaker** | Resilience4j (`@CircuitBreaker`) on Core Backend → Data Engine HTTP calls |
| **Retry + Backoff** | Spring Retry (`@Retryable`) for transient failures; Kafka consumer retries |
| **Dead Letter Queue** | Spring Kafka `DeadLetterPublishingRecoverer` → `*.dead_letter` topics |
| **Idempotency** | Idempotency key on Kafka messages; dedup check before DB write |
| **Graceful Shutdown** | Spring Boot graceful shutdown; in-flight requests drain; Kafka offsets committed |
| **Health Checks** | Spring Actuator `/actuator/health` (liveness + readiness) |
| **Rate Limiting** | Bucket4j + Redis (per tenant, 100 req/s default) |
| **Timeout** | Spring WebClient timeout: 30 s default, 5 s search, 120 s analytics |

---

## 10. Deployment Architecture

```
                        ┌───────────────────────────┐
                        │  CloudFront (CDN)          │
                        │  AWS WAF · Shield          │
                        └─────────────┬─────────────┘
                                      │
                        ┌─────────────▼─────────────┐
                        │  ALB + API Gateway         │
                        │  Rate limiting · TLS term  │
                        └─────────────┬─────────────┘
                                      │
┌──────────────────────────────────────▼───────────────────────────┐
│                    Kubernetes Cluster (EKS)                       │
│                                                                  │
│  NAMESPACE: luminai-app                                          │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ frontend (Nginx)         × 2 pods                     │     │
│  │ core-backend (Spring)    × 2–8 pods  (HPA: CPU/JVM)  │     │
│  │ data-engine (FastAPI)    × 2–6 pods  (HPA/KEDA)      │     │
│  │ dagster-daemon           × 1 pod                      │     │
│  │ dagster-webserver        × 1 pod                      │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  NAMESPACE: luminai-data                                         │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ PostgreSQL (1P+2R) + PgBouncer · Neo4j (3)            │     │
│  │ OpenSearch (3) · MinIO (4) · Redis Sentinel (3)       │     │
│  │ Kafka (3)                                              │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  NAMESPACE: luminai-platform                                     │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ Keycloak (2) · Vault (3) · ArgoCD (2) · cert-manager  │     │
│  │ Prometheus · Grafana · Loki · Tempo · OTel Collector   │     │
│  └────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────┘
```

### CI/CD Pipeline

```
Push to main
  │
  ▼
GitHub Actions
  ├── ci-java.yml ────→ spotless → compile → test (Testcontainers) → Docker → Trivy
  ├── ci-python.yml ──→ ruff → pytest → Docker → Trivy
  └── ci-frontend.yml ─→ eslint → vitest → build → Docker → Trivy
  │
  ▼
Update Helm chart image tags → ArgoCD sync
  ├── Dev: auto-sync
  ├── Staging: auto-sync
  └── Production: manual approval
```

---

## 11. Architecture Decision Records

| # | Decision | Rationale |
|---|---|---|
| ADR-001 | **Java 21 + Spring Boot 3.3 for Core Backend** | Enterprise-grade; best Spring Data integrations (JPA, Neo4j, OpenSearch, Kafka); virtual threads for massive concurrency; team knows Java. |
| ADR-002 | **Modular monolith** (not microservices) | 1 deployment, zero inter-service latency, 1 DB pool, simpler ops. Packages can be extracted when scale demands. |
| ADR-003 | **Separate Python Data Engine** | Different runtime (CPU-bound); massive deps (PyTorch 2+ GB); independent scaling; data/ML ecosystem has no Java equivalent. |
| ADR-004 | **Keep Kafka** | Data pipeline (connect → pipeline → resolve → index) requires durable, replayable events. Spring Kafka is native integration. |
| ADR-005 | **Hibernate for ORM** (not jOOQ, JDBC Template) | Built-in multi-tenancy, entity auditing, L2 cache, migration tooling (Flyway). |
| ADR-006 | **Spring Data Neo4j** | Best graph-DB ORM; object-graph mapping; derived queries; Cypher templates. |
| ADR-007 | **Gradle over Maven** | Faster incremental builds; Kotlin DSL; better dependency management; build cache. |
| ADR-008 | **Flyway migrations** | SQL-native; simple versioning; team writes raw SQL. |
| ADR-009 | **OpenAPI codegen for frontend types** | SpringDoc generates API spec; openapi-generator-cli creates TypeScript client. No manual type syncing. |
| ADR-010 | **Resilience4j** (not Hystrix) | Active project; annotation-driven; built for Spring Boot. Hystrix is end-of-life. |
| ADR-011 | **Ontology-centric terminology** | Module names reflect the layered architecture (Data Connection, Pipeline, Ontology, Explorer, Automate) for clarity and market positioning. |
| ADR-012 | **API Gateway at the edge** (not just in-app rate limiting) | Government/enterprise clients require edge-level rate limiting, WAF, API versioning, and request logging before traffic hits the JVM. Bucket4j inside Spring is defense-in-depth, not primary. |
| ADR-013 | **PgBouncer / RDS Proxy for connection pooling** | Schema-per-tenant causes `SET search_path` on every tenant switch. Without pooling, connection exhaustion occurs at 10+ concurrent tenants. PgBouncer in dev, RDS Proxy in production. |

---

## 12. Future Features (Post-MVP)

| Feature | Phase | Where It Lives |
|---|---|---|
| **Datasets** — Versioned, immutable data snapshots | v1.1 | `dataset` package (Java) |
| **Actions** — Defined operations on Ontology objects | v1.1 | `ontology` package extension |
| **Data Lineage** — Full DAG visualisation | v1.2 | `lineage` package (Java) |
| **Workshop** — No-code/low-code app builder | v2.0 | `workshop` package (Java) + React builder |
| **Code Workbook** — Notebook environment | v2.0 | Data Engine (Python) |
| **Fusion** — Spreadsheet over Ontology | v3.0 | React component |
