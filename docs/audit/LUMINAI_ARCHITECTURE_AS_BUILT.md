# LuminAI As-Built Technical Architecture & Operational Workflows

**Document Version:** 1.0.0  
**Audit Date:** November 2026  
**Auditor:** Senior Principal Enterprise Architect & DevSecOps Lead  

---

## 1. System Component Architecture

LuminAI is composed of three primary application tiers, backed by relational, graph, object, and key-value storage engines, with optional message queuing and telemetry exporters.

```mermaid
flowchart TD
    subgraph ClientLayer["Client Layer (Browser)"]
        SPA["React 19 SPA (Vite + Tailwind v4)"]
        Zustand["Zustand Auth & State Store"]
        CytoCanvas["Cytoscape.js Graph Canvas"]
        SPA --> Zustand
        SPA --> CytoCanvas
    end

    subgraph IngressLayer["Edge & Ingress (Nginx / CloudFront)"]
        Nginx["Nginx Reverse Proxy / SSL Termination"]
    end

    subgraph AppTiers["Application Microservices"]
        subgraph CoreBackend["Core Backend (Spring Boot 3.5.0 / Java 21)"]
            SecFilter["Security Filter Chain (Keycloak JWT + API Key)"]
            TenantFilter["TenantContext Filter (ThreadLocal Schema)"]
            ConnCtrl["Connection & Ingest Controllers"]
            OntCtrl["Ontology & Graph Controllers"]
            CleanPreviewSvc["ConnectionCleanPreviewService (Java Heuristics)"]
            FlywayMgr["Flyway Migration Manager"]
            
            SecFilter --> TenantFilter
            TenantFilter --> ConnCtrl
            TenantFilter --> OntCtrl
            ConnCtrl --> CleanPreviewSvc
        end

        subgraph DataEngine["Data Engine (FastAPI / Python 3.12)"]
            FastApiApp["FastAPI Entrypoint (Lifespan & CORS)"]
            DagsterTrig["Dagster In-Process Orchestrator"]
            PolarsDuckDB["DuckDB & Polars Engine"]
            EREngine["Entity Resolution (Blocking / Scoring / Clustering)"]
            RunTracker["Pipeline Run Tracker (SQLite / PG)"]
            
            FastApiApp --> DagsterTrig
            DagsterTrig --> PolarsDuckDB
            PolarsDuckDB --> EREngine
            DagsterTrig --> RunTracker
        end
    end

    subgraph StorageLayer["Data & Persistence Layer"]
        Postgres[("PostgreSQL 16 (Multi-Schema: public + tenant_{slug})")]
        Neo4j[("Neo4j Graph Database (Entities & Links)")]
        MinIO[("MinIO S3 Storage (Raw Ingestion Buckets)")]
        Redis[("Redis (Auth Tokens & Cache)")]
    end

    subgraph AuthLayer["Identity & Control Plane"]
        Keycloak["Keycloak 24 (OIDC / OAuth2 Realm: luminai)"]
    end

    SPA -->|HTTPS :443| Nginx
    Nginx -->|Proxy /api/v1/*| SecFilter
    Nginx -->|Proxy /process/*, /analytics/*| FastApiApp
    Nginx -->|Static Assets| SPA
    
    SPA -->|OIDC Login / Token| Keycloak
    SecFilter -->|Validate JWT JWKS| Keycloak
    
    ConnCtrl -->|Sample & Config| Postgres
    CleanPreviewSvc -->|Persist Golden Records| Postgres
    CleanPreviewSvc -->|Sync Nodes & Edits| Neo4j
    ConnCtrl -->|PutObject Raw CSV/ZIP| MinIO
    
    CoreBackend -.->|REST /process/trigger| FastApiApp
    PolarsDuckDB -->|Read Staging & Write Golden| Postgres
    CoreBackend -->|Cache Tenant Metadata| Redis
```

---

## 2. End-to-End User Journey

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Tenant Administrator
    actor Analyst as Data Analyst
    participant UI as React SPA (LuminAI)
    participant Auth as Keycloak IAM
    participant Core as Core Backend (Spring Boot)
    participant Engine as Data Engine (FastAPI)
    participant DB as PostgreSQL (tenant_schema)
    participant Graph as Neo4j Graph DB

    %% Onboarding & Auth
    Note over Admin,Auth: 1. Authentication & Organization Context
    Admin->>UI: Access Platform URL
    UI->>Auth: Redirect to Keycloak Login
    Auth-->>UI: Return JWT Access & Refresh Tokens
    UI->>Core: GET /api/v1/auth/me (Bearer JWT)
    Core-->>UI: Return User Profile & Tenant Association

    %% Connection Setup & Ingest
    Note over Admin,Core: 2. Data Connection & File Ingestion
    Admin->>UI: Navigate to Connections & Upload CSV / ZIP
    UI->>Core: POST /api/v1/connections/{id}/upload (Multipart)
    Core->>Core: Validate TenantContext & Connection ID
    Core->>Core: Store Raw File in MinIO & Save Sample Rows
    Core-->>UI: Return Ingested Status & Row Count

    %% Pipeline Processing
    Note over Analyst,Engine: 3. Cleaning & Entity Resolution Pipeline
    Analyst->>UI: Open Pipeline Page & Trigger Cleaning
    UI->>Engine: POST /process/trigger (source_id, tenant_id)
    Engine->>Engine: Dagster In-Process Materialization (DuckDB + Polars)
    Engine->>DB: Read staging_records -> Write golden_records
    Engine-->>UI: 202 Accepted (run_id)
    loop Poll Progress
        UI->>Engine: GET /process/status/{run_id}
        Engine-->>UI: Status (running -> completed, progress_pct: 100)
    end

    %% Exploration & Graph Visualization
    Note over Analyst,Graph: 4. Data Exploration & Ontology Visualization
    Analyst->>UI: Navigate to Graph Page / Entity Explorer
    UI->>Core: GET /api/v1/graph/nodes & relationships
    Core->>Graph: Execute Cypher Query (primaryTenant = tenant_slug)
    Graph-->>Core: Return Nodes & Edges
    Core-->>UI: Render Interactive Cytoscape Canvas
```

---

## 3. Data Ingestion, Processing & Entity Resolution Pipeline

```mermaid
flowchart TD
    subgraph Stage1["1. Raw Ingestion"]
        Upload[Upload CSV / JSON / ZIP] --> Parser[ConnectionFileParser]
        Parser --> MinIOStorage[(MinIO Raw Object Store)]
        Parser --> SampleStorage[Sample Rows in DB Connection Config]
        Parser -.->|Kafka ingest.raw if enabled| Consumer[IngestRawConsumer]
    end

    subgraph Stage2["2. Data Cleaning & Validation (data-engine)"]
        Consumer --> Staging[(staging_records Table)]
        SampleStorage -.->|Direct Ingest| Staging
        Staging --> DagsterClean[Dagster: cleaning_pipeline]
        DagsterClean --> SchemaInference[Schema & Type Inference]
        SchemaInference --> NullSanitize[Null & Format Normalization]
        NullSanitize --> AssetChecks{Quality Gate Asset Checks}
        AssetChecks -- Pass --> CleanParquet[Clean Parquet Dataset]
        AssetChecks -- Fail --> QuarantineTable[(quarantined_records)]
    end

    subgraph Stage3["3. Entity Resolution & Golden Records"]
        CleanParquet --> Blocking[LSH & Attribute Blocking]
        Blocking --> Comparison[Pairwise String Comparison]
        Comparison --> Classifier[Threshold & ML Classifier]
        Classifier -- Match >= 0.85 --> Cluster[Connected Components Clustering]
        Classifier -- Match 0.65-0.84 --> MergeQueue[(er_candidates Review Queue)]
        Cluster --> GoldenGen[Golden Record Generation]
        GoldenGen --> GoldenTable[(golden_records Table)]
        GoldenGen --> ProvenanceTable[(provenance Lineage Table)]
    end

    subgraph Stage4["4. Consumption & Export"]
        GoldenTable --> GraphSync[Sync Entity Nodes to Neo4j]
        GoldenTable --> ExplorerUI[Explorer Table & Detail View]
        GoldenTable --> CSVExport[Cleaned Dataset CSV Export]
    end
```

---

## 4. Authentication, Authorization & Multi-Tenant Request Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Client as Client Request (Browser / External API)
    participant Nginx as Edge Reverse Proxy
    participant SecFilter as Spring Security Filter Chain
    participant TenantFilter as TenantContext Filter
    participant Controller as REST Controller
    participant Hibernate as Hibernate MultiTenancy (SCHEMA)
    participant Postgres as PostgreSQL Database

    Client->>Nginx: HTTP Request with Headers:
    Note over Client,Nginx: Authorization: Bearer <Keycloak_JWT><br/>OR X-API-Key: <lum_live_hash><br/>X-Tenant-ID: acme-corp
    
    Nginx->>SecFilter: Forward Request

    alt Bearer JWT Provided
        SecFilter->>SecFilter: Validate JWT Signature against Keycloak JWKS
        SecFilter->>SecFilter: Extract Realm Roles (ADMIN, USER, etc.)
    else X-API-Key Provided
        SecFilter->>SecFilter: Compute SHA-256 Hash of Key
        SecFilter->>Postgres: SELECT * FROM public.api_keys WHERE hash = ?
        SecFilter->>SecFilter: Load Tenant & Assign OPERATOR Role
    end

    SecFilter->>TenantFilter: Forward with Authentication Context
    TenantFilter->>TenantFilter: Extract Tenant UUID & Slug from Token or Header
    TenantFilter->>TenantFilter: Set ThreadLocal: TenantContext.setTenant(uuid, slug)
    
    TenantFilter->>Controller: Invoke Endpoint (@PreAuthorize Check)
    Controller->>Hibernate: Execute JPA Query (e.g. goldenRecordRepository.findAll())
    Hibernate->>Hibernate: Resolve Current Tenant: "tenant_" + TenantContext.getTenantSlug()
    Hibernate->>Postgres: SET search_path TO "tenant_acme", "public"
    Hibernate->>Postgres: SELECT * FROM golden_records ...
    Postgres-->>Hibernate: Return Tenant-Isolated Data
    Hibernate-->>Controller: Entities
    Controller-->>Client: 200 OK JSON Response
    
    TenantFilter->>TenantFilter: finally { TenantContext.clear(); }
```

---

## 5. External Service and Database Dependencies

```mermaid
graph LR
    subgraph AppCore["LuminAI Application Core"]
        CB["core-backend (Java 21)"]
        DE["data-engine (Python 3.12)"]
        FE["frontend (React 19)"]
    end

    subgraph StorageDependencies["Storage & Graph Dependencies"]
        PG["PostgreSQL 16"]
        N4J["Neo4j 5.x"]
        MIO["MinIO S3 API"]
        RDS["Redis 7.x"]
    end

    subgraph IntegrationDependencies["Message & Ingress Dependencies"]
        KC["Keycloak 24"]
        KFK["Apache Kafka 3.7"]
        OS["OpenSearch 2.x"]
    end

    CB -->|JDBC :5432| PG
    CB -->|Bolt :7687| N4J
    CB -->|S3 REST :9000| MIO
    CB -->|RESP :6379| RDS
    CB -->|OIDC JWKS :8180| KC
    CB -->|TCP :9092 (Optional)| KFK
    CB -->|HTTP REST :8000| DE

    DE -->|SQLAlchemy :5432| PG
    DE -->|S3 REST :9000| MIO
    DE -->|Kafka Consumer :9092 (Optional)| KFK
    DE -->|HTTP :9200 (Optional)| OS

    FE -->|HTTP :8080| CB
    FE -->|HTTP :8000| DE
    FE -->|OIDC :8180| KC
```

---

## 6. Architectural Weaknesses and Known Discrepancies

### Weakness 1: Divergent Cleaning Implementations
- **Issue:** `ConnectionCleanPreviewService.java` implements in-memory string routines (title casing names, lowercase emails, naive confidence scoring), while `data-engine` contains a production-grade Polars/DuckDB cleaning pipeline with validation checks.
- **Risk:** Clean preview shown in the UI may not match the actual data materialized into golden records by the batch pipeline.
- **Remediation:** Phase out the Java cleaning heuristics; proxy preview requests directly to `data-engine`'s DuckDB in-memory sampler.

### Weakness 2: Dual Table Schemas (Public vs Multi-Schema)
- **Issue:** Core backend Flyway creates `golden_records` inside `tenant_{slug}` with columns `id`, `canonical_name`, `properties` JSONB. Data Engine Alembic creates `staging_records` and `golden_records` in `public` with `golden_id` VARCHAR and `attributes` TEXT.
- **Risk:** Data engine must dynamically inspect columns (`is_postgres_schema = "canonical_name" in cols`) to reconcile differences.
- **Remediation:** Standardize table models across both services into `tenant_{slug}`.

### Weakness 3: Memory Footprint vs Budget Reality
- **Issue:** Running Postgres, Neo4j, Redis, MinIO, Keycloak, Kafka, Zookeeper, OpenSearch, Dagster daemon, Spring Boot, and FastAPI simultaneously requires >12GB RAM, costing ~$150-$300/month on AWS or Render. The project target budget is ~GHS 10,000/year (~$700/year, ~$58/month).
- **Remediation:** The production Lightsail profile (`docker-compose.prod.yml`) correctly disables Kafka, Zookeeper, and OpenSearch. Further consolidation should run Keycloak and PostgreSQL on tuned memory limits (<512MB heap each) to safely fit on a single 4GB Lightsail instance ($24-$40/month).

