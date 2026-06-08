# 🧑‍💻 E5 — DevOps Engineer Task Sheet

## Sprint 0 — Foundation (Weeks 1–2)

- **Role:** Infrastructure & DevOps Engineer
- **Primary Focus:** Local orchestration (Docker), CI workflows, Dockerfiles, and base cloud infrastructure configurations.
- **Working Directories:** `infra/`, `.github/workflows/`, and root `docker-compose.yml`
- **Languages:** YAML, Dockerfile syntax, HCL (Terraform)

---

## 📖 Reference Documentation

Please review the following project specifications in the `docs/` folder before commencing:
* `docs/02-architecture.md` (specifically §10 on deployment architecture and CI/CD pipelines)
* `docs/06-technology-stack.md` (specifically §4.5 infrastructure layer details and §4.4 data stores configuration)
* `docs/07-security-architecture.md` (specifically §5 on network and gateway topology)

---

## 🚫 Dev Rules & Restrictions
* **DO NOT** modify frontend or backend source files (`src/` folders) under any circumstances.
* **DO NOT** commit raw credentials, environment files (`.env`), or local terraform state files to Git.
* **DO NOT** expose open data store ports publicly. Bind all dev container ports exclusively to loopback addresses (`127.0.0.1`).

---

## 📋 Assigned Tasks

---

### TASK S0-11: Docker Compose Dev Environment Expansion (5 pts)
* **Goal:** Set up local container stack orchestrating all required platform services.
* **Working Directory:** Root project directory `/`
* **Target Files:**
  * `docker-compose.yml`
  * `infra/keycloak/luminai-realm.json`

#### Requirements
1. **Infrastructure Stack additions:**
   * Extend the existing Compose file to orchestrate:
     * **PgBouncer** (ports: `6432` pointing to PostgreSQL database)
     * **Neo4j** (ports: `7474`, `7687` for browser UI and bolt connection)
     * **OpenSearch** (ports: `9200` for search indexing)
     * **MinIO** (ports: `9000`, `9001` for object storage and console dashboard)
     * **Redis** (ports: `6379` for caching & web sockets)
     * **Keycloak** (ports: `8180` running OIDC provider)
2. **Configuration Policies:**
   * Ensure named volumes are configured for persistent services to avoid local data loss on restart.
   * Add health check blocks verifying service availability for dependent services.
3. **Keycloak Realm Seed:**
   * Configure Keycloak to import a predefined realm (`luminai`) containing client ID configuration for `luminai-spa` and seed roles/admin users on boot.

#### Acceptance Criteria
* Running `docker compose up -d` starts all services successfully.
* All service health checks report green.
* Keycloak imports the client and user realm configuration cleanly on initial run.

---

### TASK S0-12: Multi-stage Dockerfiles (3 pts)
* **Goal:** Create optimized, secure container definitions for production deployment of each service.
* **Working Directories:**
  * `core-backend/`
  * `data-engine/`
  * `frontend/`
* **Target Files:**
  * `core-backend/Dockerfile`
  * `data-engine/Dockerfile`
  * `frontend/Dockerfile`
  * `frontend/nginx.conf`

#### Requirements
1. **Core Backend (Java):**
   * Multi-stage build compilation using Gradle container, copying output artifact jar into JRE container.
2. **Data Engine (Python):**
   * Slim python build image copying pyproject files, installing libraries via `uv` lock file, and setting up runtime.
3. **Frontend (React):**
   * Compilation stage using node container, copying client build distribution static directory into an Nginx web-server container.
   * Provide custom Nginx config resolving single-page application paths back to `/index.html`.

#### Acceptance Criteria
* Containers build successfully without dependencies errors or embedded developer utilities.
* Frontend container handles client router path refresh events without throwing 404 errors.

---

### TASK S0-13: GitHub Actions CI Workflows (5 pts)
* **Goal:** Construct automated continuous integration pipelines validating code health on pull request submissions.
* **Working Directory:** `.github/workflows/`
* **Target Files:**
  * `ci-java.yml` (backend compilation, formatting check, unit tests)
  * `ci-python.yml` (data-engine dependency syncing, ruff check, pytest)
  * `ci-frontend.yml` (dependency installation, formatting, eslint, compilation)

#### Requirements
1. **Automation Pipeline Configurations:**
   * Enforce dependency caching to optimize execution times.
   * Set file path filters preventing backend changes from triggering frontend pipelines (and vice-versa).
   * Configure artifacts upload capturing test reports and compilation logs when pipelines fail.

#### Acceptance Criteria
* Creating a PR triggers only the build checks associated with modified code paths.
* Test failures block merge checks on GitHub.

---

### TASK S0-14: Cloud Dev Infrastructure Terraform Base (5 pts)
* **Goal:** Construct the foundational Terraform modules for AWS networking.
* **Working Directory:** `infra/terraform/`
* **Target Files:**
  * `modules/vpc/main.tf`
  * `envs/dev/main.tf`
  * `envs/dev/backend.tf`

#### Requirements
1. **Network Infrastructure:**
   * Define VPC architecture covering public/private subnets across multiple availability zones.
   * Configure Internet and NAT Gateways.
2. **State Storage Configuration:**
   * Configure backend cloud storage (S3 + DynamoDB locking) for state management.
   * Deploy infrastructure within target region `af-south-1`.

#### Acceptance Criteria
* Running `terraform init` and `terraform plan` completes without syntax or target region errors.
* No compute or database instances are created yet (these are deferred to Sprint 2).
