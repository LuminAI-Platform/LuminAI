# LuminAI — System Requirements Document (SRD)

## 1. Purpose

LuminAI is an **enterprise data operating system** that allows organisations to connect heterogeneous data sources, transform data through pipelines, model real-world entities in a central **Ontology**, and build operational applications on top of that Ontology.

> **Architecture:** LuminAI follows a layered architecture: **Data Connection → Pipeline → Ontology → Applications**. The Ontology is the heart of the platform — everything feeds into it or consumes from it.

### MVP Scope (August 2026 — 13 weeks, 5 engineers)

The functional requirements below describe the **full system vision**. The MVP ships a working subset:

| In MVP | Deferred to Post-MVP |
|---|---|
| File upload (CSV, JSON, Excel) | API connectors (REST, GraphQL) |
| PostgreSQL DB connector | Streaming ingestion (Kafka, webhooks) |
| Data cleaning, normalisation, dedup | Probabilistic entity resolution (ML) |
| Deterministic entity resolution | AI/ML (NL queries, anomaly detection) |
| Ontology CRUD + versioning | Map & timeline visualisations |
| Object Explorer (search + browse) | Collaboration (workspaces, comments) |
| Graph visualisation | Automation (rule engine, triggers) |
| Basic dashboard (bar, line, pie, table) | Drag-and-drop dashboard builder |
| Auth (email/password, RBAC) | SSO, MFA |
| Audit logging | Report export (PDF) |

---

## 2. Stakeholders

| Role | Responsibility |
|---|---|
| **Data Engineers** | Build and maintain ingestion pipelines, schemas |
| **Data Analysts / Scientists** | Explore data, build models, create reports |
| **Security Officers** | Define access policies, audit compliance |
| **Operations / IT** | Deploy, monitor, and scale infrastructure |
| **End-Users (Gov / Enterprise)** | Consume dashboards, run investigations, make decisions |
| **External System Admins** | Manage source-system connectors and credentials |

---

## 3. Functional Requirements

### 3.1 Data Connection

| ID | Requirement |
|---|---|
| FR-CON-01 | The system SHALL support batch ingestion from CSV, JSON, Parquet, and Excel files. |
| FR-CON-02 | The system SHALL provide database connectors for PostgreSQL, MySQL, SQL Server, Oracle, and MongoDB. |
| FR-CON-03 | The system SHALL support REST & GraphQL API connectors with configurable auth (API key, OAuth 2.0, Bearer). |
| FR-CON-04 | The system SHALL support real-time / streaming ingestion via Kafka, MQTT, and webhooks. |
| FR-CON-05 | The system SHALL validate incoming data against registered schemas and quarantine invalid records. |
| FR-CON-06 | The system SHALL allow scheduling of recurring syncs with CRON expressions. |
| FR-CON-07 | The system SHALL track data lineage from source through every transformation. |

### 3.2 Pipeline Builder

| ID | Requirement |
|---|---|
| FR-PIP-01 | The system SHALL provide a pipeline builder for composing ETL/ELT transformations. |
| FR-PIP-02 | The system SHALL perform data cleaning: null handling, type coercion, outlier flagging. |
| FR-PIP-03 | The system SHALL de-duplicate records using configurable matching rules. |
| FR-PIP-04 | The system SHALL normalise values (dates, currencies, units, encodings). |
| FR-PIP-05 | The system SHALL resolve entities across sources using deterministic and probabilistic matching. |
| FR-PIP-06 | The system SHALL version every pipeline transformation. |

### 3.3 Data Storage

| ID | Requirement |
|---|---|
| FR-STO-01 | The system SHALL store structured data in a relational store (PostgreSQL). |
| FR-STO-02 | The system SHALL store raw / semi-structured data in a data lake (object storage — MinIO / S3). |
| FR-STO-03 | The system SHALL store entity-relationship graphs in a graph database (Neo4j / Apache AGE) with **per-tenant isolation** (multi-database or label-prefix with strict query-level filtering). |
| FR-STO-04 | The system SHALL maintain a full-text search index (OpenSearch) with **per-tenant indices**. |
| FR-STO-05 | The system SHALL support hot/warm/cold data tiering with defined age thresholds, automated movement policies, and cross-tier query support (S3 Intelligent Tiering / lifecycle policies). |
| FR-STO-06 | The system SHALL use a caching layer (Redis) for search query results, user sessions, and rate limiting. |
| FR-STO-07 | The system SHALL use a durable event bus (Kafka) for asynchronous inter-service communication with dead-letter queues for failed messages. |
| FR-STO-08 | The system SHALL maintain automated backups for all stateful data stores (PostgreSQL: WAL + PITR, Neo4j: dump/online backup, OpenSearch: snapshots, MinIO: versioning, Redis: RDB/AOF) with RPO ≤ 1 hour and RTO ≤ 4 hours. |
| FR-STO-09 | The system SHALL ensure eventual consistency across PostgreSQL (source of truth), Neo4j, and OpenSearch via reconciliation jobs that verify record counts and checksums. |
| FR-STO-10 | The system SHALL use connection pooling (PgBouncer / RDS Proxy) for multi-tenant database access to prevent connection exhaustion under schema-per-tenant routing. |

### 3.4 Ontology

| ID | Requirement |
|---|---|
| FR-ONT-01 | The system SHALL allow administrators to define Object Types / Entity Types (Person, Organisation, Device, etc.). |
| FR-ONT-02 | The system SHALL allow definition of typed, directional Link Types / Relationships between entities. |
| FR-ONT-03 | The system SHALL support inheritance and polymorphism in entity schemas. |
| FR-ONT-04 | The system SHALL version ontology definitions and support migration. |
| FR-ONT-05 | The system SHALL auto-suggest ontology mappings during data connection. |

### 3.5 Analytics & AI

| ID | Requirement |
|---|---|
| FR-AI-01 | The system SHALL provide statistical aggregation functions (mean, median, percentile, distribution). |
| FR-AI-02 | The system SHALL integrate an ML pipeline for training, validating, and deploying models. |
| FR-AI-03 | The system SHALL support anomaly detection on numeric and categorical streams. |
| FR-AI-04 | The system SHALL provide graph analytics: centrality, community detection, shortest path. |
| FR-AI-05 | The system SHALL offer an LLM-powered natural-language query interface. |
| FR-AI-06 | The system SHALL generate automated insight summaries from datasets. |
| FR-AI-07 | The system SHALL provide decision-recommendation workflows backed by models. |

### 3.6 Applications

| ID | Requirement |
|---|---|
| FR-APP-01 | The system SHALL provide configurable dashboards with drag-and-drop widgets. |
| FR-APP-02 | The system SHALL render interactive graph network visualisations (Object Explorer). |
| FR-APP-03 | The system SHALL provide a global search bar with structured and NL query modes (Explorer). |
| FR-APP-04 | The system SHALL support map-based geospatial visualisations. |
| FR-APP-05 | The system SHALL support timeline visualisations for event sequences. |
| FR-APP-06 | The system SHALL allow users to export reports as PDF, CSV, or share via link. |
| FR-APP-07 | The system SHALL provide an investigation workspace for link-analysis workflows. |

### 3.7 Collaboration

| ID | Requirement |
|---|---|
| FR-COL-01 | The system SHALL support shared workspaces with role-based membership. |
| FR-COL-02 | The system SHALL allow annotations and comments on entities and visualisations. |
| FR-COL-03 | The system SHALL provide configurable alert rules that notify via email, SMS, or in-app. |

### 3.8 Automate

| ID | Requirement |
|---|---|
| FR-AUT-01 | The system SHALL support rule-engine-based decision pipelines. |
| FR-AUT-02 | The system SHALL trigger automated actions (alerts, API calls) on defined events. |
| FR-AUT-03 | The system SHALL log all automation executions for audit. |

---

## 4. Non-Functional Requirements

### 4.1 Performance

| ID | Requirement |
|---|---|
| NFR-PER-01 | Dashboard pages SHALL load in < 2 s (P95) for datasets up to 10 M rows. |
| NFR-PER-02 | Search queries SHALL return results in < 500 ms (P95). |
| NFR-PER-03 | Streaming ingestion SHALL sustain ≥ 50 000 events/second per tenant. |
| NFR-PER-04 | Graph traversal queries of depth ≤ 4 SHALL complete in < 3 s (P95). |

### 4.2 Scalability

| ID | Requirement |
|---|---|
| NFR-SCA-01 | The system SHALL scale horizontally to support 100+ concurrent tenants. |
| NFR-SCA-02 | Storage SHALL scale to petabyte level via object-storage tiering. |
| NFR-SCA-03 | Compute-intensive jobs (ML training, batch ETL) SHALL run on auto-scaling worker pools. |

### 4.3 Availability & Reliability

| ID | Requirement |
|---|---|
| NFR-AVA-01 | The platform SHALL target 99.9 % uptime (SLA). |
| NFR-AVA-02 | The system SHALL support zero-downtime deployments (blue-green / canary). |
| NFR-AVA-03 | Critical data stores SHALL be replicated across ≥ 2 availability zones. |

### 4.4 Security

| ID | Requirement |
|---|---|
| NFR-SEC-01 | All data in transit SHALL be encrypted with TLS 1.3. |
| NFR-SEC-02 | All data at rest SHALL be encrypted (AES-256). |
| NFR-SEC-03 | Authentication SHALL use OAuth 2.0 / OIDC with MFA support. |
| NFR-SEC-04 | Authorisation SHALL support RBAC and ABAC. |
| NFR-SEC-05 | The system SHALL maintain immutable audit logs for all data access. |
| NFR-SEC-06 | The system SHALL comply with GDPR, POPIA (South Africa), and NDPR (Nigeria). |

### 4.5 Maintainability

| ID | Requirement |
|---|---|
| NFR-MAI-01 | The system SHALL follow a modular monolith architecture with the ability to extract services for independent scaling. |
| NFR-MAI-02 | All APIs SHALL be documented via OpenAPI 3.1 specifications. |
| NFR-MAI-03 | Code coverage SHALL remain ≥ 80 % across services. |

### 4.6 Observability

| ID | Requirement |
|---|---|
| NFR-OBS-01 | Distributed tracing SHALL be implemented across all services (OpenTelemetry). |
| NFR-OBS-02 | Centralised logging SHALL aggregate logs from all services. |
| NFR-OBS-03 | Health-check and readiness endpoints SHALL be exposed on every service. |

---

## 5. Constraints

| Constraint | Detail |
|---|---|
| Cloud provider | AWS (EKS, RDS, MSK, S3, OpenSearch Service, ElastiCache). |
| Cloud-native deployment | Must run on Kubernetes (AWS EKS). |
| Multi-tenancy | Each tenant's data must be logically isolated (schema-per-tenant). |
| African data-sovereignty | Must support deployment to AWS Cape Town (`af-south-1`) for African data residency. |
| Open-source preference | Prefer OSS components to minimise licensing cost. |

---

## 6. Assumptions

1. Organisations will provide appropriate credentials and network access to their data sources.
2. Initial deployment targets a single AWS region; multi-region follows in Phase 3+.
3. MVP users will be fewer than 500 concurrent users per tenant.
4. The platform does **not** generate or own any data — it acts as the intelligence layer.
5. MVP team: 2 backend (Java), 1 frontend (React), 1 DevOps, 1 data/AI engineer (Python).
6. August 2026 delivery is a working MVP demo; production hardening follows in v1.1.

---

## 7. Future Features (Post-MVP)

The following features are **planned for future phases**, not the MVP:

| Feature | Phase |
|---|---|
| **API Connectors** — REST/GraphQL with configurable auth (OAuth, API key) | v1.1 (Sep 2026) |
| **Streaming Ingestion** — Kafka topics, webhooks, real-time event processing | v1.1 |
| **SSO + MFA** — Google/Microsoft SSO, TOTP multi-factor authentication | v1.1 |
| **Probabilistic ER** — ML-based entity resolution (beyond deterministic matching) | v1.1 |
| **Map Visualisation** — Geospatial entity plotting (Mapbox GL) | v1.1 |
| **Timeline Visualisation** — Event sequences on interactive timeline | v1.1 |
| **Datasets** — Versioned, immutable data snapshots at each pipeline stage | v1.1 |
| **Actions** — Defined operations on Ontology objects (create, modify, link, delete) | v1.1 |
| **AI/ML** — NL-to-SQL queries, anomaly detection, automated insights | v1.2 (Oct 2026) |
| **Collaboration** — Shared workspaces, comments, annotations | v1.2 |
| **Automation** — Rule engine, triggers, automated actions | v1.2 |
| **Report Export** — PDF dashboards, CSV bulk export | v1.2 |
| **Data Lineage** — Full DAG visualisation of data provenance | v1.2 |
| **Workshop** — No-code/low-code application builder on the Ontology | v2.0 |
| **Code Workbook** — Notebook-style Python/SQL environment | v2.0 |
| **Fusion** — Spreadsheet interface linked to Ontology | v3.0 |
