# LuminAI — Feature Backlog & User Stories

## 1. Backlog Structure

The backlog is organised into **Epics → Features → User Stories**. Each user story uses the format:

> *As a [role], I want to [goal] so that [benefit].*

Priority uses **MoSCoW**: Must, Should, Could, Won't (this release).

## 2. Epics & User Stories

### EPIC 1 — Data Ingestion

#### Feature 1.1 — File Upload Ingestion

| ID | Story | Priority | Points |
|---|---|---|---|
| US-101 | As a **Data Engineer**, I want to upload CSV/JSON/Excel files via the UI so that I can quickly onboard new datasets. **Acceptance:** Max file size 500 MB; multipart/chunked upload for files > 50 MB; rejected files return clear error; file type validated server-side (not just extension). | Must | 5 |
| US-102 | As a **Data Engineer**, I want the system to auto-detect file schema so that I can reduce manual mapping effort. | Must | 8 |
| US-103 | As a **Data Engineer**, I want to preview the first 100 rows before confirming ingestion so that I can verify data quality. | Must | 3 |

#### Feature 1.2 — Database Connectors

| ID | Story | Priority | Points |
|---|---|---|---|
| US-104 | As a **Data Engineer**, I want to connect a PostgreSQL database as a source so that I can ingest structured relational data. | Must | 8 |
| US-105 | As a **Data Engineer**, I want to connect MySQL and SQL Server databases so that I can support diverse client environments. | Should | 8 |
| US-106 | As a **Data Engineer**, I want to configure and schedule recurring sync jobs so that data stays up-to-date automatically. | Must | 8 |

#### Feature 1.3 — API Connectors

| ID | Story | Priority | Points |
|---|---|---|---|
| US-107 | As a **Data Engineer**, I want to register a REST API source with configurable authentication so that I can pull data from web services. | Won't (v1.1) | 13 |
| US-108 | As a **Data Engineer**, I want to map API response fields to ontology properties so that ingested data conforms to our data model. | Won't (v1.1) | 8 |

#### Feature 1.4 — Streaming Ingestion

| ID | Story | Priority | Points |
|---|---|---|---|
| US-109 | As a **Data Engineer**, I want to ingest real-time events via Kafka topics so that the platform processes live data streams. | Could | 13 |
| US-110 | As a **Data Engineer**, I want to receive webhook events and route them into the pipeline so that external systems can push data in real time. | Could | 8 |

---

### EPIC 2 — Data Processing & Quality

#### Feature 2.1 — Data Cleaning

| ID | Story | Priority | Points |
|---|---|---|---|
| US-201 | As a **Data Engineer**, I want the system to flag and handle null/missing values so that downstream analytics are not skewed. | Must | 5 |
| US-202 | As a **Data Engineer**, I want to define custom cleaning rules (type coercion, trimming, default values) so that I can tailor processing per source. | Must | 8 |

#### Feature 2.2 — Deduplication

| ID | Story | Priority | Points |
|---|---|---|---|
| US-203 | As a **Data Engineer**, I want the system to detect duplicate records within a dataset so that data quality is maintained. | Must | 8 |
| US-204 | As a **Data Engineer**, I want to configure matching rules (exact, fuzzy) per entity type so that dedup accuracy is tuneable. | Must | 8 |

#### Feature 2.3 — Schema Transformation

| ID | Story | Priority | Points |
|---|---|---|---|
| US-205 | As a **Data Engineer**, I want to map source fields to ontology properties using a visual mapper so that I can onboard new sources quickly. | Must | 13 |
| US-206 | As a **Data Engineer**, I want to version all schema transformations so that changes are traceable and reversible. | Should | 5 |

---

### EPIC 3 — Entity Resolution

#### Feature 3.1 — Identity Matching

| ID | Story | Priority | Points |
|---|---|---|---|
| US-301 | As a **Data Analyst**, I want the system to automatically link records from different sources that refer to the same real-world entity so that I see a unified view. | Must | 13 |
| US-302 | As a **Data Analyst**, I want to review and manually approve/reject entity merge suggestions so that I maintain data accuracy. | Must | 8 |
| US-303 | As a **Data Analyst**, I want to see the provenance of each property on a unified entity so that I know which source contributed each value. | Should | 5 |

---

### EPIC 4 — Ontology Management

#### Feature 4.1 — Entity & Relationship Types

| ID | Story | Priority | Points |
|---|---|---|---|
| US-401 | As an **Admin**, I want to create and edit entity types with typed properties so that the data model reflects our domain. | Must | 8 |
| US-402 | As an **Admin**, I want to define relationship types between entity types so that we can model real-world connections. | Must | 5 |
| US-403 | As an **Admin**, I want to version the ontology so that schema changes don't break existing data. | Should | 8 |

---

### EPIC 5 — Search

#### Feature 5.1 — Global Search

| ID | Story | Priority | Points |
|---|---|---|---|
| US-501 | As an **Analyst**, I want to search across all entities using a global search bar so that I can find information quickly. | Must | 8 |
| US-502 | As an **Analyst**, I want to filter search results by entity type, source, and date range so that I can narrow results. | Must | 5 |
| US-503 | As an **Analyst**, I want to use natural language queries so that I don't need to learn a query language. | Could | 13 |

---

### EPIC 6 — Graph Visualisation & Analytics

#### Feature 6.1 — Relationship Graph

| ID | Story | Priority | Points |
|---|---|---|---|
| US-601 | As an **Analyst**, I want to visualise an entity's relationships as an interactive graph so that I can explore connections. | Must | 13 |
| US-602 | As an **Analyst**, I want to expand/collapse graph nodes to explore multi-hop relationships so that I can trace indirect connections. | Must | 8 |
| US-603 | As an **Analyst**, I want to filter the graph by relationship type and confidence score so that I focus on relevant connections. | Should | 5 |

#### Feature 6.2 — Graph Analytics

| ID | Story | Priority | Points |
|---|---|---|---|
| US-604 | As an **Analyst**, I want to run centrality analysis to find the most connected entities so that I can identify key actors. | Should | 8 |
| US-605 | As an **Analyst**, I want to detect clusters/communities in the graph so that I can identify groups. | Could | 8 |

---

### EPIC 7 — Dashboards & Visualisation

#### Feature 7.1 — Dashboard Builder

| ID | Story | Priority | Points |
|---|---|---|---|
| US-701 | As an **Analyst**, I want to create dashboards with preset widgets (charts, tables, KPIs) so that I can monitor data at a glance. | Should | 13 |
| US-702 | As an **Analyst**, I want to apply date-range and entity-type filters across all widgets so that dashboards stay contextual. | Must | 5 |
| US-703 | As an **Analyst**, I want to export a dashboard as a PDF report so that I can share insights with stakeholders. | Should | 5 |

#### Feature 7.2 — Map Visualisation

| ID | Story | Priority | Points |
|---|---|---|---|
| US-704 | As an **Analyst**, I want to plot entities with geospatial data on a map so that I can see location-based patterns. | Won't (v1.1) | 8 |

#### Feature 7.3 — Timeline Visualisation

| ID | Story | Priority | Points |
|---|---|---|---|
| US-705 | As an **Analyst**, I want to view events on a timeline so that I can understand temporal patterns. | Could | 8 |

---

### EPIC 8 — AI & Machine Learning

#### Feature 8.1 — Anomaly Detection

| ID | Story | Priority | Points |
|---|---|---|---|
| US-801 | As a **Data Scientist**, I want to run anomaly detection on transaction data so that I can flag suspicious activity. | Won't (v1.2) | 13 |

#### Feature 8.2 — LLM Assistant

| ID | Story | Priority | Points |
|---|---|---|---|
| US-802 | As an **Analyst**, I want to ask questions about my data in natural language and get answers so that I don't need SQL expertise. | Could | 13 |
| US-803 | As an **Analyst**, I want the AI to auto-generate summary insights from a dataset so that I can quickly understand key facts. | Could | 8 |

#### Feature 8.3 — Predictive Models

| ID | Story | Priority | Points |
|---|---|---|---|
| US-804 | As a **Data Scientist**, I want to train and deploy classification/regression models through the platform so that predictions are operationalised. | Could | 21 |

---

### EPIC 9 — Authentication & User Management

#### Feature 9.1 — Authentication

| ID | Story | Priority | Points |
|---|---|---|---|
| US-901 | As a **User**, I want to log in with email/password so that I can access the platform securely. | Must | 5 |
| US-902 | As a **User**, I want to log in via SSO (Google, Microsoft) so that I can use my corporate credentials. | Won't (v1.1) | 8 |
| US-903 | As an **Admin**, I want to enforce multi-factor authentication so that accounts are protected. | Won't (v1.1) | 5 |

#### Feature 9.2 — Roles & Permissions

| ID | Story | Priority | Points |
|---|---|---|---|
| US-904 | As an **Admin**, I want to assign roles (Admin, Analyst, Engineer, Viewer) to users so that access is controlled. | Must | 8 |
| US-905 | As an **Admin**, I want to restrict data access by tenant and dataset so that users only see authorised data. | Must | 8 |

---

### EPIC 10 — Collaboration & Workflow

#### Feature 10.1 — Shared Workspaces

| ID | Story | Priority | Points |
|---|---|---|---|
| US-1001 | As an **Analyst**, I want to share a dashboard or investigation with my team so that we can collaborate. | Could | 5 |
| US-1002 | As an **Analyst**, I want to annotate entities and visualisations with comments so that I can document findings. | Could | 5 |

#### Feature 10.2 — Alerts

| ID | Story | Priority | Points |
|---|---|---|---|
| US-1003 | As an **Analyst**, I want to set up alert rules that notify me when conditions are met so that I don't have to monitor data manually. | Could | 8 |

---

## 3. Backlog Summary

| Epic | Must Stories | Should Stories | Could Stories | Won't (deferred) | Total Points |
|---|---|---|---|---|---|
| 1 — Ingestion | 4 | 1 | 2 | 2 | 74 |
| 2 — Processing | 4 | 1 | 0 | 0 | 34 |
| 3 — Entity Resolution | 2 | 1 | 0 | 0 | 26 |
| 4 — Ontology | 2 | 1 | 0 | 0 | 21 |
| 5 — Search | 2 | 0 | 1 | 0 | 26 |
| 6 — Graph Viz & Analytics | 2 | 2 | 1 | 0 | 42 |
| 7 — Dashboards | 1 | 2 | 1 | 1 | 39 |
| 8 — AI & ML | 0 | 0 | 3 | 1 | 55 |
| 9 — Auth & Users | 2 | 0 | 0 | 2 | 34 |
| 10 — Collaboration | 0 | 0 | 3 | 0 | 18 |
| **Totals** | **19** | **8** | **11** | **6** | **369** |

> **MVP scope (13 weeks):** All **Must** stories (19) + selected **Should** stories. Total MVP points: ~190. Won't stories are deferred to v1.1/v1.2.
