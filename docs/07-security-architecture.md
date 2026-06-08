# LuminAI — Security Architecture

## 1. Security Principles

| Principle | Description |
|---|---|
| **Zero Trust** | Never trust, always verify. Every request is authenticated and authorised regardless of network. |
| **Defence in Depth** | Multiple overlapping controls (network, application, data). |
| **Least Privilege** | Users and services get only the permissions they need. |
| **Encryption Everywhere** | Data encrypted in transit (TLS 1.3) and at rest (AES-256). |
| **Audit Everything** | Immutable audit trail for all data access and system changes. |
| **Compliance by Design** | GDPR, POPIA, NDPR baked into the architecture. |

---

## 2. Authentication Architecture

### 2.1 Identity Provider

```
┌──────────┐     OIDC      ┌────────────┐     Federation     ┌──────────────┐
│  Client  │ ────────────▶ │  Keycloak  │ ◀───────────────── │ Corporate    │
│  (React) │   Auth Code   │  (IdP)     │   LDAP / SAML     │ Directory    │
└──────────┘    + PKCE     └─────┬──────┘                    └──────────────┘
                                 │
                         JWT (access + refresh)
                                 │
                                 ▼
                        ┌────────────────┐
                        │  API Gateway   │  ← Validates JWT signature + expiry
                        │  (Kong/Envoy)  │
                        └────────────────┘
```

| Capability | Implementation | MVP? |
|---|---|---|
| Email/Password login | Keycloak built-in | ✅ MVP |
| Social / SSO login | Keycloak Google/Microsoft providers | Post-MVP (v1.1) |
| LDAP/AD federation | Keycloak User Federation | Post-MVP (v1.1) |
| Multi-Factor Auth | Keycloak OTP (TOTP/WebAuthn) | Post-MVP (v1.1) |
| Session management | Short-lived access tokens (15 min) + refresh tokens (7 days) | ✅ MVP |
| Service-to-service auth | Client credentials grant; mTLS within K8s | ✅ MVP |

### 2.2 Token Flow

1. User authenticates via Keycloak → receives `access_token` (JWT) + `refresh_token`.
2. `access_token` includes: `sub`, `tenant_id`, `roles[]`, `permissions[]`, `exp`.
3. API Gateway validates JWT signature, expiry, and audience on every request.
4. Gateway injects `X-Tenant-ID` and `X-User-ID` headers for downstream services.
5. Refresh tokens are stored server-side (Redis) and rotated on use.

---

## 3. Authorisation Architecture

### 3.1 Model

LuminAI uses a **hybrid RBAC + ABAC** model enforced by **Open Policy Agent (OPA)**.

```
┌──────────────────────────────────────────────────────┐
│                    AUTH DECISION                      │
│                                                      │
│   RBAC (Role-Based)        ABAC (Attribute-Based)    │
│   ─────────────────        ──────────────────────    │
│   Admin                    tenant_id == resource.     │
│   Analyst                       tenant_id            │
│   Data Engineer            data_classification       │
│   Viewer                        <= user.clearance    │
│                            time_of_day in allowed    │
│                                 range                │
│                                                      │
│              ┌────────────────────┐                   │
│              │   OPA / Rego       │                   │
│              │   Policy Engine    │                   │
│              └────────────────────┘                   │
└──────────────────────────────────────────────────────┘
```

### 3.2 Role Definitions

| Role | Permissions |
|---|---|
| **Platform Admin** | Full system access; manage tenants; deploy models; manage users. |
| **Tenant Admin** | Manage users within tenant; configure ontology; manage connectors. |
| **Data Engineer** | Create/edit ingestion pipelines; manage schemas; run processing jobs. |
| **Analyst** | Search, explore, visualise data; create dashboards; run analytics. |
| **Data Scientist** | Train/deploy ML models; access feature store; run experiments. |
| **Viewer** | Read-only access to shared dashboards and reports. |

### 3.3 Data-Level Access Control

| Level | Mechanism | MVP? |
|---|---|---|
| **Tenant isolation** | Every query scoped by `tenant_id` from JWT. | ✅ MVP |
| **Dataset-level** | OPA policy checks user's dataset access list against requested resource. | ✅ MVP |
| **Row-level** | OPA evaluates row attributes (e.g., classification, region) against user attributes. | Post-MVP (v1.2) |
| **Column-level** | Sensitive fields (e.g., SSN, salary) masked unless user has explicit permission. | Post-MVP (v1.2) |

### 3.4 OPA Integration

```
  Service                     OPA Sidecar
  ┌────────┐   POST /v1/data   ┌──────┐
  │ FastAPI│ ─────────────────▶│ OPA  │
  │ / Go   │  {input: ...}     │      │
  │        │◀─────────────────  │      │
  └────────┘  {result: allow}   └──────┘
```

- OPA runs as a sidecar container in each service pod.
- Policies written in Rego; version-controlled in Git.
- Policy bundles pushed to OPA via bundle API.

---

## 4. Data Protection

### 4.1 Encryption

| Scope | Standard | Implementation |
|---|---|---|
| **In Transit** | TLS 1.3 | cert-manager + mTLS between services; AWS ACM for external. |
| **At Rest (DB)** | AES-256 | PostgreSQL TDE or volume-level encryption (EBS). |
| **At Rest (Object Store)** | AES-256 | MinIO/S3 server-side encryption (SSE-S3/SSE-KMS). |
| **At Rest (Search)** | AES-256 | OpenSearch encryption at rest. |
| **Backup** | AES-256-GCM | Encrypted backup storage via Vault-managed keys. |

### 4.2 Key Management

```
┌──────────────────────────┐
│   HashiCorp Vault        │
│                          │
│  ┌──────────────────┐    │
│  │ Transit Engine   │    │  ← encrypt/decrypt API for services
│  │ (envelope encrypt)│   │
│  └──────────────────┘    │
│  ┌──────────────────┐    │
│  │ KV Engine        │    │  ← DB passwords, API keys
│  │ (v2 - versioned) │    │
│  └──────────────────┘    │
│  ┌──────────────────┐    │
│  │ PKI Engine       │    │  ← internal TLS certificates
│  └──────────────────┘    │
└──────────────────────────┘
```

- Master key managed by Vault auto-unseal (cloud KMS).
- All service credentials rotated automatically via Vault dynamic secrets.
- No secrets in code, config files, or environment variables.

### 4.3 Data Classification

| Level | Label | Examples | Controls |
|---|---|---|---|
| 1 | **Public** | Published reports, public company info | Standard access |
| 2 | **Internal** | Operational dashboards, internal metadata | Authenticated users only |
| 3 | **Confidential** | PII, financial data, health records | Role + dataset permission |
| 4 | **Restricted** | Intelligence data, national security | Named-user access; enhanced audit; data masking |

### 4.4 Input Security

| Control | Implementation | Layer |
|---|---|---|
| **Input Validation** | Jakarta Validation (`@NotNull`, `@Size`, `@Email`, `@Pattern`) on all DTOs. Custom validators for domain-specific rules. | Core Backend |
| **SQL Injection** | Parameterized queries only (JPA/Hibernate). No raw string concatenation in queries. | Core Backend |
| **XSS Prevention** | OWASP Java HTML Sanitizer for any user-submitted text stored in the database. React auto-escapes output. | Core Backend + Frontend |
| **File Upload Validation** | Server-side MIME type detection (Apache Tika); max 500 MB; reject executables; virus scan (ClamAV) in pipeline. | Core Backend |
| **CORS Policy** | Strict allow-list: only the frontend domain (`https://app.luminai.io`) and local dev (`http://localhost:5173`). No wildcards. Configured in `SecurityConfig.java`. | Core Backend |
| **Content Security Policy (CSP)** | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://api.luminai.io wss://api.luminai.io; frame-ancestors 'none';` Set via response header in Spring Security. | Core Backend |
| **Rate Limiting** | API Gateway: per-tenant, per-IP throttling (100 req/s default). Bucket4j inside Spring as defense-in-depth. | API Gateway + Core Backend |
| **Request Size Limits** | `server.tomcat.max-http-form-post-size=10MB`; `spring.servlet.multipart.max-file-size=500MB`. | Core Backend |

---

## 5. Network Security

```
┌──────────────────────────────────────────────────────────────┐
│                        Internet                               │
└────────────────────────────┬──────────────────────────────────┘
                             │
                     ┌───────▼───────┐
                     │  WAF / DDoS   │  ← Cloudflare / AWS Shield
                     │  Protection   │
                     └───────┬───────┘
                             │
                     ┌───────▼───────┐
                     │  Load Balancer│  ← TLS termination
                     │  (L7)        │
                     └───────┬───────┘
                             │
              ┌──────────────▼──────────────┐
              │      K8s Ingress            │
              │      (Nginx/Envoy)          │
              └──────┬──────────────┬───────┘
                     │              │
          ┌──────────▼───┐  ┌──────▼──────┐
          │  Public Tier │  │  Internal   │  ← NetworkPolicy
          │  (API GW,    │  │  Tier       │     isolates tiers
          │   Frontend)  │  │  (Services, │
          └──────────────┘  │   Data)     │
                            └─────────────┘
```

| Control | Implementation |
|---|---|
| **WAF** | AWS WAF — OWASP Top 10 rules |
| **DDoS** | AWS Shield Standard |
| **CDN** | Amazon CloudFront |
| **Ingress** | K8s Ingress controller (Nginx or Envoy) |
| **Network Policies** | Calico / Cilium — restrict pod-to-pod traffic by namespace and label |
| **Egress** | Restrict outbound to allow-listed destinations only |
| **mTLS** | Service mesh or Envoy sidecar for encrypted inter-service traffic |

---

## 6. Audit & Compliance

### 6.1 Audit Logging

| Event Category | Examples | Storage |
|---|---|---|
| **Authentication** | Login, logout, MFA challenge, failed login | Keycloak event log + Kafka audit topic |
| **Authorization** | Access granted, access denied, role change | OPA decision log + Kafka audit topic |
| **Data Access** | Entity view, search query, export | Application audit log + Kafka audit topic |
| **Data Mutation** | Entity create/update/delete, ingestion | Application audit log + Kafka audit topic |
| **Admin Action** | User create, role assign, connector config | Application audit log + Kafka audit topic |

### 6.2 Audit Infrastructure

```
Services ──▶ Kafka (audit.log topic) ──▶ OpenSearch (hot, 90d) ──▶ MinIO (cold, 7yr)
                                          │
                                          ▼
                                     Grafana / Kibana
                                     (audit dashboards)
```

- Audit records are **append-only** and **immutable**.
- Retention: 90 days hot (OpenSearch), 7 years cold (object storage / compliance archive).
- **Tamper protection — SHA-256 hash chain:**

```
Record N:
  id:            uuid
  timestamp:     ISO 8601
  tenant_id:     uuid
  actor:         user_id
  action:        "entity.view"
  resource:      "entity:P-001"
  previous_hash: SHA-256(Record N-1)
  hash:          SHA-256(id + timestamp + tenant_id + actor + action + resource + previous_hash)
```

- Each record's `hash` is computed from its content + the previous record's hash, forming a linked chain.
- **Verification:** A scheduled reconciliation job re-computes hashes and alerts on any break in the chain.
- **Separation:** Audit records are written to a **separate PostgreSQL schema** (`audit`) that application services have **INSERT-only** access to (no UPDATE/DELETE).

### 6.3 Compliance

| Regulation | Applicability | Key Controls |
|---|---|---|
| **GDPR** (EU) | Any EU data subjects | Right to erasure, data portability, consent, DPO. |
| **POPIA** (South Africa) | South African data subjects | Lawful purpose, data minimisation, notification. |
| **NDPR** (Nigeria) | Nigerian data subjects | Consent, data protection officer, audit rights. |
| **SOC 2 Type II** | Enterprise customers | Security, availability, confidentiality controls. |

**Data Subject Rights Implementation:**
- **Right to Erasure:** Soft-delete + scheduled hard-delete pipeline; cascades through PG, Neo4j, OpenSearch, MinIO.
- **Data Portability:** Export API (JSON/CSV) for all personal data linked to a subject ID.
- **Consent Management:** Consent records stored per purpose per subject; enforced at ingestion.

---

## 7. Security Operations

### 7.1 Vulnerability Management

| Activity | Tool | Cadence |
|---|---|---|
| SAST (static analysis) | Semgrep / SonarQube | Every CI build |
| Container image scanning | Trivy | Every CI build |
| Dependency scanning | Dependabot / Renovate | Daily |
| DAST (dynamic analysis) | OWASP ZAP | Weekly (staging) |
| Penetration testing | Third-party vendor | Quarterly |

### 7.2 Incident Response

| Phase | Actions |
|---|---|
| **Detection** | Alerting via Prometheus, Grafana, WAF logs |
| **Triage** | On-call engineer classifies severity (P1–P4) |
| **Containment** | Revoke compromised credentials; isolate affected services |
| **Eradication** | Patch vulnerability; rotate keys via Vault |
| **Recovery** | Restore from backup; validate data integrity |
| **Post-mortem** | Blameless retrospective; update runbooks |

### 7.3 Secret Rotation Schedule

| Secret Type | Rotation Frequency |
|---|---|
| Database credentials | 30 days (Vault dynamic secrets) |
| API keys | 90 days |
| TLS certificates | Auto-renewed (cert-manager) |
| JWT signing keys | 90 days (Keycloak rotation) |
| Encryption keys | Annual (Vault transit auto-rotate) |
