# LuminAI — Sprint Plan (13 Weeks / 6 Sprints)

> **Stack:** Java / Spring Boot (Core Backend) + Python (Data Engine) + React/TypeScript (Frontend)  
> **Team:** 5 engineers  
> **Timeline:** 13 weeks (May 5 – August 1, 2026)  
> **Cloud:** AWS (EKS, RDS, MSK, S3, OpenSearch, ElastiCache)  
> **Architecture:** Modular monolith + separate Data Engine  

---

## 1. MVP Definition

A working platform where a user can:

> **Connect data → Pipeline (clean & deduplicate) → Resolve entities → Model in Ontology → Search & Explore → Visualise graph → Build dashboards**

Features **not** in this MVP: AI/ML, API connectors, streaming ingestion, collaboration, automation, maps, timeline, SSO, MFA, PDF export. These are planned for v1.1–v1.2 (see Section 8).

---

## 2. Team Structure

| Engineer | Primary | Secondary | Modules Owned |
|---|---|---|---|
| **E1 — Tech Lead** | Core Backend (Java) | Architecture, code review | Auth, Ontology, Dashboard, Audit |
| **E2 — Backend** | Core Backend (Java) | — | Connection, Explorer, Graph, Kafka |
| **E3 — Frontend** | React (TypeScript) | — | All UI screens |
| **E4 — DevOps** | Infrastructure | Python (Dagster setup) | CI/CD, Docker, K8s, Terraform, Monitoring |
| **E5 — Data/AI Eng** | Data Engine (Python) | — | Pipeline, Entity Resolution, Analytics |

---

## 3. Velocity

| Metric | Value |
|---|---|
| Sprint duration | 2 weeks (Sprint 2 is 3 weeks) |
| Velocity | 40–55 story points / sprint |
| Total sprints | 6 (Sprints 0–5) |
| Total duration | **13 weeks** |

---

## 4. Sprint Breakdown

---

### SPRINT 0 — Foundation (Weeks 1–2)

| ID | Task | Pts | Owner |
|---|---|---|---|
| S0-01 | Monorepo scaffold (core-backend/, data-engine/, frontend/, infra/) | 3 | E4 |
| S0-02 | Docker Compose (PG + PgBouncer, Neo4j, Kafka, OpenSearch, MinIO, Redis, Keycloak) | 5 | E4 |
| S0-03 | GitHub Actions CI (Java: spotless+test+build, Python: ruff+pytest, Frontend: eslint+vitest) | 5 | E4 |
| S0-04 | Docker multi-stage builds (3 Dockerfiles) | 3 | E4 |
| S0-05 | AWS dev account + VPC + basic Terraform | 5 | E4 |
| S0-06 | Spring Boot scaffold: build.gradle.kts, application.yml, Flyway, Actuator health | 5 | E1 |
| S0-07 | Spring Security: Keycloak OIDC resource server, JWT validation, RBAC | 8 | E1 |
| S0-08 | Multi-tenancy: TenantFilter, TenantContext, Hibernate TenantIdentifierResolver | 5 | E1 |
| S0-09 | Flyway initial migration: users, tenants, roles, base schema | 3 | E1 |
| S0-10 | Input validation middleware (Jakarta Validation on all DTOs) | 2 | E1 |
| S0-11 | Spring Kafka config: producer/consumer factory, error handler, DLQ publisher | 3 | E2 |
| S0-12 | PgBouncer setup in Docker Compose + connection pool config | 2 | E2 |
| S0-13 | CORS + CSP + security headers | 2 | E2 |
| S0-14 | Python Data Engine scaffold: FastAPI, health, config, OpenTelemetry | 3 | E5 |
| S0-15 | Dagster setup: workspace, daemon, webserver, no-op pipeline | 3 | E5 |
| S0-16 | React scaffold: Vite + React 19, design tokens, layout shell (sidebar, topbar, routing) | 5 | E3 |
| S0-17 | Login page + Keycloak OIDC redirect flow (frontend) | 3 | E3 |
| S0-18 | OpenAPI codegen pipeline: SpringDoc → openapi.json → TypeScript client | 3 | E3 |
| **Total** | | **68** | |

**Done when:**
- `docker compose up` starts all 9 services (PG, PgBouncer, Neo4j, Kafka, OpenSearch, MinIO, Redis, Keycloak, Dagster).
- `./gradlew bootRun` starts Spring Boot with health endpoint.
- `npm run dev` starts React with login page.
- User logs in via Keycloak, sees dashboard shell with tenant context.
- CI runs on every PR: lint + test + build.

---

### SPRINT 1 — Data Connection (Weeks 3–4)

| ID | Task | Pts | Owner |
|---|---|---|---|
| S1-01 | ConnectionController + ConnectionService (REST API) | 3 | E2 |
| S1-02 | FileConnector: CSV/JSON/Excel parser → MinIO raw zone (max 500 MB, chunked >50 MB) | 5 | E2 |
| S1-03 | SchemaDetector: infer column types from first N rows | 5 | E2 |
| S1-04 | Data preview endpoint: first 100 rows as JSON | 3 | E2 |
| S1-05 | JdbcConnector: PostgreSQL — discover tables, extract data | 8 | E2 |
| S1-06 | ConnectionProducer: publish validated records to Kafka `ingest.raw` | 3 | E2 |
| S1-07 | SchemaMapper: source field → ontology property mapping CRUD | 5 | E1 |
| S1-08 | Connector credentials via Vault / AWS Secrets Manager | 3 | E1 |
| S1-09 | Flyway migration: connectors, sync_jobs, schema_mappings tables | 2 | E1 |
| S1-10 | Connection UI: file upload wizard (drag & drop, type detect, preview) | 8 | E3 |
| S1-11 | Connection UI: DB connector form (host, port, creds, table picker) | 5 | E3 |
| S1-12 | Schema mapper UI: visual field mapping interface | 8 | E3 |
| S1-13 | Sync job status UI (progress, record counts, errors) | 3 | E3 |
| S1-14 | Kafka consumer scaffold in Data Engine (consume `ingest.raw`) | 3 | E5 |
| S1-15 | Basic Helm chart templates | 3 | E4 |
| **Total** | | **67** | |

**Done when:**
- CSV upload → preview → map schemas → data in MinIO + Kafka.
- PG connector → select tables → data flows to Kafka.

---

### SPRINT 2 — Pipeline + Entity Resolution (Weeks 5–7, 3 weeks)

> **Why 3 weeks:** Pipeline + ER is the core differentiator and hardest technical challenge. Extra week prevents crunch.

| ID | Task | Pts | Owner |
|---|---|---|---|
| S2-01 | Pipeline Kafka consumer for `ingest.raw`, trigger Dagster pipeline | 5 | E5 |
| S2-02 | Cleaning pipeline: null handling, type coercion, trimming | 5 | E5 |
| S2-03 | Normalisation: dates (ISO 8601), currencies, casing, encoding | 5 | E5 |
| S2-04 | Deduplication: exact + fuzzy matching within source | 5 | E5 |
| S2-05 | Staging writer: cleaned records → MinIO staging + PG staging table | 3 | E5 |
| S2-06 | Kafka producer: `ingest.valid` | 2 | E5 |
| S2-07 | ER: blocking (name phonetic + country + entity type) | 5 | E5 |
| S2-08 | ER: pairwise comparison (Jaro-Winkler, Levenshtein) | 8 | E5 |
| S2-09 | ER: classification (configurable thresholds) | 5 | E5 |
| S2-10 | ER: clustering (connected components) + golden record merge | 5 | E5 |
| S2-11 | ER: provenance tracking (source → property mapping) | 3 | E5 |
| S2-12 | Kafka producer: `entity.resolved` | 2 | E5 |
| S2-13 | Configurable cleaning rules API (Core Backend, CRUD) | 5 | E1 |
| S2-14 | Manual review API: pending merges, accept/reject/split | 5 | E2 |
| S2-15 | Pipeline monitoring UI: job list, status, progress bars | 5 | E3 |
| S2-16 | Entity merge review UI: side-by-side comparison, confidence scores | 8 | E3 |
| S2-17 | Dagster schedules for recurring pipelines | 3 | E4 |
| S2-18 | Staging environment setup on AWS (EKS + RDS + MSK) | 8 | E4 |
| **Total** | | **87** | 3 weeks |

**Done when:**
- Upload dirty CSV → pipeline cleans + normalises → ER matches entities → golden records in PG.
- Analyst can review and accept/reject merges in UI.

---

### SPRINT 3 — Ontology + Graph + Explorer (Weeks 8–9)

| ID | Task | Pts | Owner |
|---|---|---|---|
| S3-01 | OntologyController + EntityTypeService: CRUD with property schemas | 8 | E1 |
| S3-02 | RelationshipTypeService: typed directional relationships CRUD | 5 | E1 |
| S3-03 | OntologyVersionService: version, publish, changelog | 5 | E1 |
| S3-04 | Flyway migrations: entity_types, relationship_types, ontology_versions | 2 | E1 |
| S3-05 | GraphSyncConsumer: @KafkaListener → Neo4j node + edge creation | 8 | E2 |
| S3-06 | GraphController: neighbourhood query API (depth 1–4, filter by rel type) | 5 | E2 |
| S3-07 | GraphController: shortest-path API | 3 | E2 |
| S3-08 | IndexSyncConsumer: @KafkaListener → OpenSearch indexer | 5 | E2 |
| S3-09 | ExplorerController: full-text query, faceted filtering, pagination | 5 | E2 |
| S3-10 | Redis query cache (Spring @Cacheable, 60 s TTL) | 3 | E2 |
| S3-11 | Ontology UI: entity type editor (add/edit properties, versions) | 5 | E3 |
| S3-12 | Explorer UI: search bar, results cards, type filters | 8 | E3 |
| S3-13 | Entity detail page: properties, provenance, link to graph | 5 | E3 |
| S3-14 | Reconciliation job: PG vs Neo4j vs OpenSearch count/checksum | 3 | E5 |
| S3-15 | Helm charts for staging deployment + ArgoCD setup | 5 | E4 |
| **Total** | | **75** | |

**Done when:**
- Search bar returns entities with highlights and facets.
- Entity detail shows provenance (which source contributed each field).
- Neo4j is populated with relationships.

---

### SPRINT 4 — Graph Viz + Dashboard (Weeks 10–11)

| ID | Task | Pts | Owner |
|---|---|---|---|
| S4-01 | Graph viz: Cytoscape.js canvas, force-directed layout | 13 | E3 |
| S4-02 | Node interactions: click, double-click expand, collapse | 5 | E3 |
| S4-03 | Graph controls: zoom, pan, fit, layout toggle, filters | 5 | E3 |
| S4-04 | Node detail sidebar | 3 | E3 |
| S4-05 | DashboardController + DashboardService: CRUD + widget definitions | 5 | E1 |
| S4-06 | WidgetService: pluggable widget type registry (bar, line, pie, table, KPI) | 5 | E1 |
| S4-07 | Analytics endpoints (Python): aggregation, time-series rollups | 5 | E5 |
| S4-08 | DataAggregationClient: Spring WebClient → Data Engine /analytics | 3 | E2 |
| S4-09 | Dashboard UI: grid layout + chart widgets (ECharts) | 8 | E3 |
| S4-10 | KPI card + data table widgets | 5 | E3 |
| S4-11 | Production Terraform (EKS, RDS, MSK, OpenSearch, ElastiCache, S3) | 8 | E4 |
| **Total** | | **65** | |

**Done when:**
- Interactive graph exploration (expand/collapse nodes, filters).
- Dashboard with 3+ widget types showing real data.

---

### SPRINT 5 — Polish, Security, Deploy (Weeks 12–13)

| ID | Task | Pts | Owner |
|---|---|---|---|
| S5-01 | AuditConsumer: @KafkaListener → immutable PG + OpenSearch | 3 | E1 |
| S5-02 | Audit log viewer UI (admin only) | 3 | E3 |
| S5-03 | E2E tests: upload → clean → resolve → explore → graph → dashboard | 8 | E1+E5 |
| S5-04 | Performance tests: explorer < 500 ms, dashboard < 2 s (k6) | 5 | E4 |
| S5-05 | Security audit: OWASP ZAP, RBAC bypass checks, tenant isolation | 5 | E4 |
| S5-06 | Production Helm deploy + Grafana dashboards + alerting | 5 | E4 |
| S5-07 | CSV export (explorer results) | 3 | E2 |
| S5-08 | DR runbook finalisation | 2 | E4 |
| S5-09 | Bug triage and fixes (buffer) | 8 | All |
| S5-10 | Documentation: user guide, API docs (Swagger UI), deployment runbook | 5 | All |
| S5-11 | Client demo preparation | 3 | All |
| **Total** | | **50** | |

**Done when:**
- Full E2E flow works: upload → clean → resolve → search → graph → dashboard.
- Deployed to production AWS.
- Security tested, documentation complete.
- Ready for client demo.

---

## 5. Release Timeline

```
Sprint 0  │ Weeks 1–2   (May 5–16)    │ Foundation: Scaffold, Auth, CI/CD, Docker
Sprint 1  │ Weeks 3–4   (May 19–30)   │ Data Connection: Upload, DB Connect, Schema Map
Sprint 2  │ Weeks 5–7   (Jun 2–20)    │ Pipeline + Entity Resolution (3 weeks)
Sprint 3  │ Weeks 8–9   (Jun 23–Jul 4)│ Ontology + Graph + Explorer
Sprint 4  │ Weeks 10–11 (Jul 7–18)    │ Graph Viz + Dashboard Builder
Sprint 5  │ Weeks 12–13 (Jul 21–Aug 1)│ Polish, Security, Deploy
                                       │
                                       ▼
                                  MVP RELEASE — Week 13 (August 1)
```

---

## 6. Milestones

| Milestone | Sprint | Week | Deliverable | Demo to Client? |
|---|---|---|---|---|
| **M0 — Foundation** | 0 | 2 | Login works, empty dashboard shell, CI running | No |
| **M1 — First Data In** | 1 | 4 | Upload CSV → see preview → data in system | ✅ Yes |
| **M2 — Clean + Unified Data** | 2 | 7 | Upload dirty data → cleaned + entities matched | ✅ Yes |
| **M3 — Knowledge Graph** | 3 | 9 | Search entities → see relationships in graph | No |
| **M4 — Full Experience** | 4 | 11 | Dashboards + graph viz + explorer all working | ✅ Yes |
| **MVP RELEASE** | 5 | 13 | Production deployed, security tested, documented | ✅ Yes |

> **Invite the client to M1, M2, and M4 demos.** Showing working software early builds confidence.

---

## 7. Risks & Mitigations

| Risk | Prob | Impact | Mitigation |
|---|---|---|---|
| 13 weeks is too tight for full MVP | High | High | Scope already cut. Sprint 2 has buffer week. Sprint 5 is polish-only. |
| Entity resolution accuracy | Medium | High | Deterministic matching first; ML model in v1.1. Manual review safety net. |
| Neo4j tenant isolation leak | Medium | Critical | Strict Cypher query filters + integration tests that verify isolation. |
| PG connection exhaustion at 10+ tenants | Medium | High | PgBouncer from Sprint 0; RDS Proxy in production. |
| Frontend bundle too large (Cytoscape + ECharts) | Medium | Medium | Code-split + lazy-load viz libraries. |
| Data Engine OOM on large datasets | Medium | High | Polars lazy frames + chunked processing. |
| Sprint 5 overflows (end-of-project crunch) | High | Medium | Start security testing in Sprint 4; keep Sprint 5 scope minimal (50 pts). |
| Client scope creep | High | High | Written scope agreement before Sprint 0; change requests go to backlog. |

---

## 8. Post-MVP Roadmap

| Phase | Timeframe | Features |
|---|---|---|
| **v1.1** | Sep 2026 | API connectors (REST/GraphQL), streaming ingestion, SSO + MFA, probabilistic ER (ML), MySQL/SQL Server connectors, map & timeline visualisations, Datasets, Actions |
| **v1.2** | Oct 2026 | AI/ML (NL queries, anomaly detection, automated insights), collaboration (workspaces, comments), automation (rule engine, triggers), report export (PDF/CSV), data lineage |
| **v2.0** | Dec 2026 | Workshop (no-code app builder), extract Explorer/Graph to separate services, multi-region deployment |
| **v3.0** | Mar 2027 | Code Workbook, Fusion (spreadsheet), AI agent workflows, plugin SDK, SOC 2 |
