# LuminAI — Technology Stack

> **Status:** Sprint 0 — Foundation  
> **Architecture:** Modular Monolith (Java) + Data Engine (Python) + SPA (React/TypeScript)  
> **Cloud:** AWS (EKS, RDS, MSK, S3, OpenSearch Service, ElastiCache)  
> **Philosophy:** Ontology-centric data operating system

---

## 1. Design Philosophy

| Priority | Principle |
|---|---|
| 🥇 **Enterprise Robustness** | Java/Spring Boot is the industry standard for enterprise platforms — banks, governments, and telecoms already trust it. |
| 🥈 **Right Tool for the Job** | Java for business logic and system orchestration. Python for data/AI. TypeScript for the frontend. Each language plays to its strength. |
| 🥉 **Speed to Market** | Modular monolith (not microservices) means 1 backend deployment, no inter-service HTTP overhead, faster iteration. |
| 4 | **Scalability** | Java 21 Virtual Threads handle 100K+ concurrent requests per JVM. Modules can be extracted to services when scale demands it. |

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND                                            │
│  React 19 + TypeScript 5 (Vite)                                             │
│  Cytoscape.js · ECharts · Mapbox GL · vis-timeline                          │
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
│               CORE BACKEND (Java 21 · Spring Boot 3.3)                      │
│                                                                              │
│  One Spring Boot application, modularised internally via packages:          │
│                                                                              │
│  ┌──────────────┐ ┌───────────────┐ ┌──────────────┐ ┌────────────────┐    │
│  │ auth         │ │ connection     │ │ ontology     │ │ explorer       │    │
│  │              │ │               │ │              │ │                │    │
│  │ • Keycloak   │ │ • File upload │ │ • Entity type│ │ • OpenSearch   │    │
│  │   OIDC       │ │ • DB connect  │ │   CRUD       │ │   indexing     │    │
│  │ • JWT valid  │ │ • API connect │ │ • Rel type   │ │ • Full-text    │    │
│  │ • RBAC/ABAC  │ │ • Webhook rx  │ │   CRUD       │ │   query        │    │
│  │ • Tenant ctx │ │ • Schema map  │ │ • Versioning │ │ • Faceted      │    │
│  │              │ │ • Kafka prod  │ │ • Migrations │ │ • Redis cache  │    │
│  └──────────────┘ └───────────────┘ └──────────────┘ └────────────────┘    │
│                                                                              │
│  ┌──────────────┐ ┌───────────────┐ ┌──────────────┐ ┌────────────────┐    │
│  │ graph        │ │ dashboard     │ │ collaboration│ │ notification   │    │
│  │              │ │               │ │              │ │                │    │
│  │ • Neo4j      │ │ • CRUD        │ │ • Workspaces │ │ • Email        │    │
│  │   read/write │ │ • Widget defs │ │ • Comments   │ │ • In-app (WS)  │    │
│  │ • Neighbour  │ │ • Data agg    │ │ • Annotations│ │ • Webhook      │    │
│  │ • Path-find  │ │ • Sharing     │ │ • Activity   │ │ • Alert rules  │    │
│  │ • Analytics  │ │               │ │   feed       │ │                │    │
│  └──────────────┘ └───────────────┘ └──────────────┘ └────────────────┘    │
│                                                                              │
│  ┌──────────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │ automate                         │  │ audit                           │  │
│  │ • Rule defs · Triggers · Actions│  │ • Immutable log · Kafka → PG/OS│  │
│  └──────────────────────────────────┘  └─────────────────────────────────┘  │
│                                                                              │
│  Shared: Spring Data JPA (Hibernate) · Spring Kafka · Spring Data Neo4j    │
│  Shared: Spring Security · OpenTelemetry · Tenant filter · OPA client      │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │ Kafka (async)
                                │ HTTP  (sync)
                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│               DATA & AI ENGINE (Python 3.12 · FastAPI + Dagster)            │
│                                                                              │
│  Pipeline │ Entity Resolution │ Analytics │ AI/ML                         │
│                                                                              │
│  Shared: Polars · Dagster · confluent-kafka · SQLAlchemy · OpenTelemetry    │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         DATA STORES                                          │
│                                                                              │
│  PostgreSQL 16 (+ PgBouncer) · Neo4j 5 · OpenSearch 2 · MinIO · Redis 7 ·  │
│  Kafka                                                                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Language-to-Service Mapping

### 3.1 Java 21 — Core Backend

Java handles **all business logic, CRUD, event orchestration, and system-level concerns**.

| What Java Handles | Why Java |
|---|---|
| Authentication & authorisation | Spring Security is the most mature auth framework in any language. Keycloak has first-class Spring support. |
| Data connection (connectors, sync scheduling, Kafka production) | Spring Kafka is Kafka's native integration — Kafka itself is written in Java/Scala. |
| Ontology management (CRUD, versioning) | Spring Data JPA + Hibernate for clean entity modelling with strong typing. |
| Object Explorer (OpenSearch indexing + queries) | Spring Data OpenSearch provides type-safe query builders. |
| Graph (Neo4j reads/writes, analytics) | Spring Data Neo4j is the most mature graph-DB integration available. |
| Dashboards, collaboration, notifications, automate, audit | Spring's dependency injection, transaction management, and scheduling handle enterprise concerns that other frameworks bolt on. |
| Multi-tenancy middleware | Hibernate's `@TenantId` + `TenantIdentifierResolver` provide built-in multi-tenancy. |
| WebSocket (real-time events) | Spring WebSocket + STOMP for real-time dashboard updates and notifications. |

### 3.2 Python 3.12 — Data & AI Engine

Python handles **everything that touches data transformation, ML, or scientific computing**.

| What Python Handles | Why Python |
|---|---|
| Data cleaning, normalisation, deduplication | Polars/pandas — the entire data-engineering ecosystem. |
| Pipeline orchestration | Dagster — asset-centric DAGs with observability. |
| Entity resolution (probabilistic matching) | Dedupe, recordlinkage, scikit-learn — no Java equivalent. |
| Analytics (OLAP, statistics) | DuckDB, scipy, statsmodels — unmatched in Java. |
| AI/ML (LLM, anomaly detection, model serving) | LangChain, PyTorch, MLflow — the AI ecosystem is Python-native. |

### 3.3 TypeScript 5 — Frontend

TypeScript handles **the user interface**.

| What TypeScript Handles | Why TypeScript |
|---|---|
| React SPA (all UI screens) | Largest frontend ecosystem; type safety with React. |
| Graph visualisation (Cytoscape.js) | Best graph-viz libraries are JavaScript-native. |
| Charts (ECharts), Maps (Mapbox), Timeline (vis-timeline) | All visualisation libraries are JS-native. |
| Shared types package | OpenAPI codegen from Spring Boot → TypeScript API client for the frontend. |

### 3.4 Summary Matrix

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     LANGUAGE ASSIGNMENT                                   │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                    JAVA 21 (Spring Boot 3.3)                       │  │
│  │  Enterprise backend — business logic, orchestration, security      │  │
│  │                                                                    │  │
│  │  • Auth (Spring Security + Keycloak)                              │  │
│  │  • Connection (connectors, sync scheduler, Kafka producer)        │  │
│  │  • Ontology (entity/relationship type CRUD, versioning)           │  │
│  │  • Explorer (OpenSearch indexing + queries)                       │  │
│  │  • Graph (Neo4j reads/writes, analytics)                          │  │
│  │  • Dashboard (CRUD, widget framework, data aggregation)           │  │
│  │  • Collaboration (workspaces, comments, annotations)              │  │
│  │  • Notification (alerts, email, WebSocket delivery)               │  │
│  │  • Automate (rule engine, triggers, actions)                      │  │
│  │  • Audit (immutable trail, Kafka consumer)                        │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                    PYTHON 3.12 (FastAPI + Dagster)                  │  │
│  │  Data-intensive, ML/AI, scientific computing                       │  │
│  │                                                                    │  │
│  │  • Pipeline (cleaning, normalisation, dedup, ETL)                │  │
│  │  • Entity Resolution (blocking, comparison, clustering, merge)    │  │
│  │  • Analytics (aggregation, OLAP, time-series, statistics)         │  │
│  │  • AI/ML (NL queries, anomaly detection, insights, model serve)   │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                    TYPESCRIPT 5 (React 19 + Vite)                   │  │
│  │  Frontend application                                              │  │
│  │                                                                    │  │
│  │  • Web SPA (dashboards, graph viz, explorer, connection, admin)   │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Detailed Stack

### 4.1 Core Backend — Java

| Component | Technology | Purpose |
|---|---|---|
| **Language** | Java 21 (LTS) | Long-term support; virtual threads; records; pattern matching |
| **Framework** | Spring Boot 3.3 | Auto-config, embedded Tomcat, production-ready |
| **Concurrency** | Virtual Threads (Project Loom) | Lightweight threads for massive I/O concurrency without reactive complexity |
| **ORM** | Spring Data JPA + Hibernate 6 | Type-safe entity mapping, schema migrations (Flyway), multi-tenancy |
| **Graph DB** | Spring Data Neo4j 7 | Object-graph mapping for Neo4j; Cypher query builder |
| **Search** | Spring Data OpenSearch | Index management, type-safe queries, aggregations |
| **Kafka** | Spring Kafka 3 | Producer/consumer with auto-config, error handling, DLQ, batch consumption |
| **Auth** | Spring Security 6 + spring-boot-starter-oauth2-resource-server | JWT validation, method-level security (`@PreAuthorize`), RBAC |
| **Validation** | Jakarta Validation (Hibernate Validator) | DTO validation with annotations (`@NotNull`, `@Size`, `@Email`) |
| **WebSocket** | Spring WebSocket + STOMP | Real-time dashboard updates, notification delivery |
| **HTTP Client** | Spring WebClient (reactive) / RestClient | Communication with Python Data Engine |
| **Caching** | Spring Cache + Redis (Lettuce) | Query result cache, session cache |
| **Multi-Tenancy** | Hibernate `@TenantId` + `TenantIdentifierResolver` | Built-in schema-per-tenant isolation |
| **Scheduling** | Spring Scheduler + Quartz | Recurring sync jobs |
| **Config** | Spring Cloud Config / env profiles | Environment-based configuration |
| **API Docs** | SpringDoc OpenAPI 2 | Auto-generated OpenAPI 3.1 from annotations |
| **Migrations** | Flyway 10 | SQL-based, versioned database migrations |
| **Object Storage** | MinIO Java SDK | File upload to data lake |
| **Build** | Gradle 8 (Kotlin DSL) | Faster than Maven; incremental builds; dependency management |
| **Testing** | JUnit 5 + Mockito + Testcontainers | Unit, integration, and E2E with real DBs in Docker |
| **Tracing** | OpenTelemetry Java Agent | Zero-code distributed tracing (auto-instrumentation) |
| **Logging** | SLF4J + Logback (structured JSON) | Structured logging for Loki/ELK |
| **Policy** | OPA Java client (open-policy-agent/opa-java) | ABAC policy evaluation |
| **Container** | Eclipse Temurin 21-jre-alpine | ~200 MB image; or GraalVM native for ~50 MB |

### 4.2 Data & AI Engine — Python

| Component | Technology | Purpose |
|---|---|---|
| **Framework** | FastAPI 0.115 | Async API for analytics/AI |
| **Orchestration** | Dagster 1.7 | Pipeline DAGs, schedules, sensors |
| **Data Processing** | Polars 1.x | Fast DataFrames (Rust backend) |
| **Data Quality** | Great Expectations | Validation assertions |
| **Entity Resolution** | Dedupe / recordlinkage | Probabilistic matching |
| **OLAP** | DuckDB 1.x | In-process analytical queries |
| **ML** | scikit-learn, XGBoost, PyTorch | Model training |
| **ML Tracking** | MLflow 2.x | Experiment tracking, model registry |
| **LLM** | LangChain / LlamaIndex | NL→SQL, NL→Cypher |
| **Embeddings** | pgvector | Vector storage for semantic search |
| **Kafka** | confluent-kafka-python | Event consumption/production |
| **Testing** | pytest + pytest-asyncio + pytest-cov | Unit + integration tests |
| **Package Mgr** | uv | Fast, deterministic lockfiles |
| **Linting** | ruff | Replaces flake8, black, isort |
| **Type Check** | mypy (strict) | Static type checking |
| **Container** | python:3.12-slim | ~150 MB image |

### 4.3 Frontend — TypeScript

| Component | Technology | Purpose |
|---|---|---|
| **Framework** | React 19 + TypeScript 5 | SPA with type safety |
| **Build** | Vite 6 | Instant HMR, fast production builds |
| **Routing** | TanStack Router v1 | Type-safe file-based routing |
| **Server State** | TanStack Query v5 | Caching, background refetch, optimistic updates |
| **Client State** | Zustand v5 | Auth state, UI preferences, active tenant |
| **Forms** | React Hook Form + Zod | Schema-validated forms |
| **Graph Viz** | Cytoscape.js 3.30 | Canvas-based graph, handles 10K+ nodes |
| **Charts** | Apache ECharts 5 | 20+ chart types, animation, dark mode |
| **Maps** | Mapbox GL JS 3 (or Leaflet) | Vector tiles, geospatial layers |
| **Timeline** | vis-timeline 7 | Interactive event timelines |
| **Tables** | TanStack Table v8 | Virtualised rows (100K+) |
| **UI Primitives** | Radix UI | Accessible, unstyled primitives |
| **Styling** | Tailwind CSS 4 | Utility-first, rapid UI development, consistent design system |
| **Icons** | Lucide React | Tree-shakeable icon set |
| **i18n** | i18next | EN, FR, AR, PT, SW |
| **API Client** | OpenAPI Generator (from Spring Backend) | Auto-generated typed HTTP client |
| **Testing** | Vitest + @testing-library/react | Unit + component tests |
| **Container** | nginx:alpine | Static SPA serving (~30 MB) |

### 4.4 Data Stores

| Store | Technology | Purpose | Multi-Tenancy |
|---|---|---|---|
| **Relational** | PostgreSQL 16 | Entities, ontology, users, dashboards, audit | Schema-per-tenant (Hibernate) |
| **Connection Pool** | PgBouncer / RDS Proxy | Connection pooling for multi-tenant schema switching | Shared (transparent proxy) |
| **Graph** | Neo4j 5 | Entity relationships, graph analytics (GDS) | Label-prefix isolation |
| **Search** | OpenSearch 2.x | Full-text search, faceted filtering | Index-per-tenant |
| **Object Store** | MinIO / S3 | Data lake, file uploads, ML artifacts | Bucket-per-tenant |
| **Cache** | Redis 7 / Valkey | Sessions, query cache, rate limits | Key-prefix isolation |
| **Event Bus** | Apache Kafka / MSK | Async inter-service events | Tenant ID in message key |
| **API Gateway** | AWS API Gateway / Kong | Edge rate limiting, WAF, API versioning, request logging | Per-tenant throttling |
| **Extensions** | pgvector (PG ext.) | Embedding vectors for semantic search | Via PG schema |
| **Extensions** | TimescaleDB (PG ext.) | Time-series (IoT, metrics) | Via PG schema |

### 4.5 Infrastructure

| Component | Technology | Purpose |
|---|---|---|
| Orchestration | Kubernetes (AWS EKS) | Container orchestration |
| IaC | Terraform + Terragrunt | Cloud resource provisioning |
| GitOps | ArgoCD | Declarative K8s deployments |
| CI | GitHub Actions | Build, test, lint, scan |
| IAM | Keycloak 24 | OIDC, MFA, SSO |
| Authorization | OPA (Open Policy Agent) | RBAC + ABAC |
| Secrets | HashiCorp Vault / AWS Secrets Manager | Dynamic credentials |
| TLS | cert-manager + ACM | Automated certificates |
| CDN | Amazon CloudFront | Static frontend caching, global edge |
| DNS | Amazon Route 53 | DNS management, health checks |
| DDoS | AWS Shield Standard | DDoS protection |

### 4.6 Observability

| Component | Technology | Purpose |
|---|---|---|
| Telemetry | OpenTelemetry Collector | Metrics, logs, traces pipeline |
| Metrics | Prometheus + Grafana | Service metrics, dashboards |
| Logging | Grafana Loki | Centralised log aggregation |
| Tracing | Grafana Tempo | Distributed tracing |

### 4.7 Security

| Component | Technology | Purpose |
|---|---|---|
| SAST | SonarQube / Semgrep | Static code analysis |
| Container Scan | Trivy | Docker vulnerability scanning |
| Dependency Scan | Renovate / Dependabot | Automated updates |
| DAST | OWASP ZAP | Dynamic security testing |

---

## 5. Why Java + Spring Boot for the Core Backend

| Advantage | Detail |
|---|---|
| **Spring Security** | The most mature authentication/authorisation framework. Built-in Keycloak support, method-level security (`@PreAuthorize("hasRole('ADMIN')")`), OAuth2 resource server. |
| **Spring Kafka** | Kafka was written in Java — the Spring Kafka integration is first-class. Auto-configured consumers, error handling, DLQ, batch listeners, exactly-once semantics. |
| **Spring Data Neo4j** | The best graph-DB ORM available. Object-graph mapping, derived query methods, Cypher template. No other language has this level of Neo4j integration. |
| **Hibernate Multi-Tenancy** | Built-in schema-per-tenant with `@TenantId` annotation and `TenantIdentifierResolver`. No middleware hacks needed. |
| **Virtual Threads (Java 21)** | Create millions of lightweight threads for I/O-bound work. No async/await complexity, no callback hell, no reactive programming. Write blocking code that scales like async. |
| **Type System** | Sealed interfaces, records, pattern matching, generics — stronger compile-time safety than TypeScript. |
| **Testcontainers** | Spin up real PostgreSQL, Neo4j, Kafka, OpenSearch in Docker during tests. Integration tests run against real infrastructure, not mocks. |
| **OpenTelemetry Java Agent** | Attach the agent to the JVM — get automatic distributed tracing for every HTTP request, DB query, and Kafka message without writing a single line of instrumentation code. |
| **Enterprise Trust** | Banks, governments, and telecoms (LuminAI's target customers) know Java. They trust it. Code audits are easier for their teams. |
| **GraalVM Native (future)** | Compile Spring Boot to native binary — ~50 MB image, ~0.1 s startup. Optional for when fast cold-start scaling matters. |

---

## 6. Monorepo Structure

```
luminai/
├── .github/
│   └── workflows/
│       ├── ci-java.yml                # Lint, test, build Spring Boot
│       ├── ci-python.yml              # Lint, test Python Data Engine
│       ├── ci-frontend.yml            # Lint, test, build React
│       └── cd-deploy.yml             # Docker build → ArgoCD sync
│
├── core-backend/                      # Java 21 + Spring Boot 3.3
│   ├── src/main/java/com/luminai/
│   │   ├── LuminAiApplication.java
│   │   ├── config/
│   │   │   ├── SecurityConfig.java
│   │   │   ├── KafkaConfig.java
│   │   │   ├── Neo4jConfig.java
│   │   │   ├── OpenSearchConfig.java
│   │   │   ├── RedisConfig.java
│   │   │   └── MultiTenancyConfig.java
│   │   ├── common/
│   │   │   ├── tenant/                # TenantContext, TenantFilter, TenantIdentifierResolver
│   │   │   ├── security/             # JwtAuthFilter, OpaClient, @CurrentTenant
│   │   │   ├── exception/            # GlobalExceptionHandler, ApiError
│   │   │   └── audit/                # AuditInterceptor
│   │   ├── auth/
│   │   │   ├── AuthController.java
│   │   │   ├── AuthService.java
│   │   │   ├── dto/
│   │   │   └── model/
│   │   ├── connection/
│   │   │   ├── ConnectionController.java
│   │   │   ├── ConnectionService.java
│   │   │   ├── connector/            # FileConnector, JdbcConnector, RestApiConnector
│   │   │   ├── schema/               # SchemaDetector, SchemaMapper
│   │   │   ├── sync/                 # SyncScheduler (Quartz)
│   │   │   ├── kafka/                # ConnectionProducer
│   │   │   ├── dto/
│   │   │   └── model/
│   │   ├── ontology/
│   │   │   ├── OntologyController.java
│   │   │   ├── EntityTypeService.java
│   │   │   ├── RelationshipTypeService.java
│   │   │   ├── OntologyVersionService.java
│   │   │   ├── dto/
│   │   │   └── model/
│   │   ├── explorer/
│   │   │   ├── ExplorerController.java
│   │   │   ├── ExplorerService.java
│   │   │   ├── IndexSyncConsumer.java # @KafkaListener for entity.resolved
│   │   │   ├── dto/
│   │   │   └── model/
│   │   ├── graph/
│   │   │   ├── GraphController.java
│   │   │   ├── GraphService.java
│   │   │   ├── GraphSyncConsumer.java # @KafkaListener for entity.resolved
│   │   │   ├── dto/
│   │   │   └── model/                # Neo4j @Node entities
│   │   ├── dashboard/
│   │   │   ├── DashboardController.java
│   │   │   ├── DashboardService.java
│   │   │   ├── WidgetService.java
│   │   │   ├── dto/
│   │   │   └── model/
│   │   ├── collaboration/
│   │   │   ├── CollabController.java
│   │   │   ├── WorkspaceService.java
│   │   │   ├── CommentService.java
│   │   │   ├── dto/
│   │   │   └── model/
│   │   ├── notification/
│   │   │   ├── NotificationController.java
│   │   │   ├── AlertRuleService.java
│   │   │   ├── NotificationConsumer.java # @KafkaListener for alerts.triggered
│   │   │   ├── channel/              # EmailSender, WebSocketSender, WebhookSender
│   │   │   ├── dto/
│   │   │   └── model/
│   │   ├── automate/
│   │   │   ├── AutomateController.java
│   │   │   ├── RuleEngine.java
│   │   │   ├── AutomateConsumer.java  # @KafkaListener for entity events
│   │   │   ├── action/               # AlertAction, WebhookAction, TagAction
│   │   │   ├── dto/
│   │   │   └── model/
│   │   └── audit/
│   │       ├── AuditConsumer.java     # @KafkaListener for audit.log
│   │       ├── AuditService.java
│   │       └── model/
│   ├── src/main/resources/
│   │   ├── application.yml
│   │   ├── application-dev.yml
│   │   ├── application-staging.yml
│   │   └── application-prod.yml
│   ├── src/test/java/com/luminai/    # JUnit 5 + Testcontainers
│   ├── build.gradle.kts
│   ├── settings.gradle.kts
│   └── Dockerfile
│
├── data-engine/                       # Python 3.12 + FastAPI + Dagster
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   │   ├── analytics.py
│   │   │   ├── ai.py
│   │   │   └── processing.py
│   │   ├── processing/
│   │   │   ├── pipelines/             # Dagster assets
│   │   │   ├── cleaning.py
│   │   │   ├── normalisation.py
│   │   │   └── deduplication.py
│   │   ├── entity_resolution/
│   │   │   ├── blocker.py
│   │   │   ├── comparator.py
│   │   │   ├── classifier.py
│   │   │   └── merger.py
│   │   ├── analytics/
│   │   │   ├── aggregator.py
│   │   │   └── timeseries.py
│   │   ├── ai/
│   │   │   ├── nl_query.py
│   │   │   ├── anomaly.py
│   │   │   ├── insights.py
│   │   │   └── embeddings.py
│   │   ├── kafka/
│   │   │   ├── consumers.py
│   │   │   └── producers.py
│   │   └── config.py
│   ├── tests/
│   ├── dagster_workspace.yaml
│   ├── pyproject.toml
│   └── Dockerfile
│
├── frontend/                          # React 19 + TypeScript 5
│   ├── src/
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── connection/            # Data Connection (file upload, DB connect)
│   │   │   ├── explorer/              # Object Explorer (search, browse)
│   │   │   ├── graph/
│   │   │   ├── dashboards/
│   │   │   ├── entities/
│   │   │   ├── ontology/
│   │   │   ├── analytics/
│   │   │   ├── ai/
│   │   │   ├── collaboration/
│   │   │   ├── automate/              # Automate (rule builder)
│   │   │   └── admin/
│   │   ├── components/
│   │   │   ├── ui/                    # Design system (Button, Card, Modal)
│   │   │   ├── data/                  # EntityCard, GraphNode, ChartWidget
│   │   │   └── layout/               # Sidebar, TopBar, ContentArea
│   │   ├── hooks/
│   │   ├── lib/
│   │   │   └── api-client/            # Auto-generated from OpenAPI spec
│   │   ├── stores/
│   │   ├── styles/
│   │   └── types/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── Dockerfile
│
├── infra/
│   ├── terraform/
│   │   ├── modules/
│   │   └── envs/
│   │       ├── dev/
│   │       ├── staging/
│   │       └── production/
│   ├── helm/
│   │   ├── core-backend/
│   │   ├── data-engine/
│   │   ├── frontend/
│   │   └── shared/
│   ├── docker/
│   │   ├── java.Dockerfile
│   │   ├── python.Dockerfile
│   │   └── frontend.Dockerfile
│   └── argocd/
│
├── docker-compose.yml                 # Full local stack
├── docker-compose.stores.yml          # Stores only (PG, Neo4j, Kafka, etc.)
└── README.md
```

---

## 7. Frontend ↔ Backend Type Sharing (OpenAPI Codegen)

Since the frontend (TypeScript) and backend (Java) are different languages, we bridge them via OpenAPI:

```
Spring Boot (SpringDoc)                     React (TypeScript)
       │                                           │
       ├── Auto-generates openapi.json ──────────▶ │
       │   from @RestController                    │
       │   annotations                             │
       │                                           ├── openapi-generator-cli
       │                                           │   generates TypeScript
       │                                           │   API client + types
       │                                           │
       │                                           ├── src/lib/api-client/
       │                                           │   ├── models/
       │                                           │   ├── apis/
       │                                           │   └── index.ts
```

**CI Pipeline Step:**
```yaml
# In ci-frontend.yml
- name: Generate API Client
  run: |
    npx @openapitools/openapi-generator-cli generate \
      -i ../core-backend/build/openapi.json \
      -g typescript-fetch \
      -o src/lib/api-client
```

This ensures frontend types always match backend DTOs — no manual type syncing needed.

---

## 8. Team Structure (5 Engineers)

| Engineer | Primary | Secondary | Modules Owned |
|---|---|---|---|
| **E1 — Tech Lead** | Core Backend (Java) | Architecture, code review | Auth, Ontology, system design |
| **E2 — Backend** | Core Backend (Java) | Data Engine (Python) | Connection, Explorer, Graph, Notification, Automate |
| **E3 — Frontend** | React (TypeScript) | Core Backend (Java) | All UI: dashboards, graph viz, explorer, connection wizard |
| **E4 — Data Eng** | Data Engine (Python) | Core Backend (Java) | Pipeline, Entity Resolution, Analytics |
| **E5 — Data/DevOps** | Data Engine (Python) | Infrastructure | AI/ML, Dagster pipelines, K8s, CI/CD, monitoring |

---

## 9. Java Development Standards

| Standard | Tool |
|---|---|
| **JDK** | Eclipse Temurin 21 (LTS) |
| **Build** | Gradle 8 (Kotlin DSL) with dependency verification |
| **Code Style** | Google Java Style Guide, enforced via `spotless` Gradle plugin |
| **Linting** | SpotBugs, Error Prone, SonarQube |
| **Testing** | JUnit 5 + Mockito + AssertJ + Testcontainers |
| **Coverage** | JaCoCo (target ≥ 80%) |
| **API Docs** | SpringDoc OpenAPI 2 → auto-generated spec |
| **Migrations** | Flyway 10 (SQL scripts, versioned) |
| **Container** | Multi-stage: build with `gradle:8-jdk21` → run with `eclipse-temurin:21-jre-alpine` (~200 MB) |
| **Native (future)** | GraalVM native-image via Spring AOT → (~50 MB, ~0.1 s startup) |

**Sample Gradle Dependencies:**
```kotlin
// build.gradle.kts
dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-data-neo4j")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-oauth2-resource-server")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-websocket")
    implementation("org.springframework.kafka:spring-kafka")
    implementation("org.opensearch.client:spring-data-opensearch-starter:1.5.0")
    implementation("org.springframework.boot:spring-boot-starter-data-redis")
    implementation("org.flywaydb:flyway-core")
    implementation("io.minio:minio:8.5.10")
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:2.5.0")
    implementation("io.opentelemetry.instrumentation:opentelemetry-spring-boot-starter")

    runtimeOnly("org.postgresql:postgresql")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.testcontainers:testcontainers")
    testImplementation("org.testcontainers:postgresql")
    testImplementation("org.testcontainers:neo4j")
    testImplementation("org.testcontainers:kafka")
}
```

---

## 10. Local Development Setup

```bash
# Prerequisites: JDK 21, Gradle 8, Node.js 22, Python 3.12, uv, Docker

# 1. Clone
git clone https://github.com/your-org/luminai.git && cd luminai

# 2. Start data stores
docker compose -f docker-compose.stores.yml up -d
# → PostgreSQL, Neo4j, OpenSearch, MinIO, Redis, Kafka, Keycloak

# 3. Start Core Backend (Java)
cd core-backend
./gradlew bootRun --args='--spring.profiles.active=dev'
# → Spring Boot on http://localhost:8080
# → Swagger UI on http://localhost:8080/swagger-ui.html

# 4. Start Data Engine (Python)
cd data-engine
uv sync
uv run uvicorn app.main:app --reload --port 8000
# → FastAPI on http://localhost:8000
# → Dagster UI: uv run dagster dev -p 3001

# 5. Start Frontend (React)
cd frontend
npm install
npm run dev
# → React on http://localhost:5173

# Total: 3 terminals + Docker for stores
```

---

## 11. Performance Targets

| Metric | Target | How |
|---|---|---|
| API response (CRUD) | < 200 ms (P95) | Spring Boot + Virtual Threads + PgBouncer |
| Search latency | < 500 ms (P95) | OpenSearch + Redis query cache |
| Graph traversal (depth 2) | < 1 s (P95) | Neo4j indexes + Spring Data Neo4j |
| Graph traversal (depth 4) | < 3 s (P95) | Neo4j GDS + depth limits |
| Dashboard load | < 2 s (P95) | Cached aggregations + streaming chunks |
| File ingestion | ≥ 10K records/s | Kafka batched production + Polars parsing |
| Streaming ingestion | ≥ 50K events/s/tenant | Spring Kafka batch listener |
| Entity resolution | ≥ 1M pairs/hour | Python Polars + Dedupe |

---

## 12. Decision Summary

| Decision | Rationale |
|---|---|
| **Java 21 + Spring Boot 3.3 for Core Backend** | Enterprise-grade; best Spring Data integrations (JPA, Neo4j, OpenSearch, Kafka); virtual threads; team knows Java. |
| **Python for Data & AI Engine** | Unmatched ML/AI/data ecosystem; CPU-bound work separated from I/O-bound backend. |
| **TypeScript/React for Frontend** | Largest frontend ecosystem; visualisation libraries (Cytoscape, ECharts) are JS-native. |
| **Modular Monolith** | 1 deployment; zero inter-service latency; extract modules when scale demands. |
| **OpenAPI codegen for type sharing** | Bridges Java↔TypeScript; auto-generated API client keeps frontend types in sync. |
| **Gradle over Maven** | Faster incremental builds; Kotlin DSL is more readable; better dependency management. |
| **Flyway over Liquibase** | SQL-native migrations; simpler; team can write raw SQL migrations. |
| **Testcontainers for integration tests** | Real PG, Neo4j, Kafka in Docker during tests; no mocks for infrastructure. |