# 🧑‍💻 E5 — DevOps Engineer Sprint 1 Task Sheet

## Sprint 1 — Data Connection (Weeks 3–4)

- **Role:** Infrastructure & DevOps Engineer
- **Primary Focus:** Sandbox/Dev environment deployment, third-party managed database/redis setup, service connection, and basic K8s chart definitions.
- **Budget:** $0 — All free tiers. This is a dev preview, NOT production.

---

## 🚫 Dev Rules & Restrictions
* **DO NOT** modify frontend or backend source files.
* **DO NOT** commit raw credentials, environment files, or local state files.
* **DO NOT** push directly to `main` without a PR.

---

## 📐 Deployment Architecture
* **Frontend**: Vercel (Free tier, auto-deploy from `main`)
* **Core Backend (Spring Boot)**: Render (Free tier Web Service)
* **Data Engine (FastAPI)**: Render (Free tier Web Service)
* **Keycloak**: Render (Free tier Web Service) or managed fallback (e.g. Cloud-IAM)
* **PostgreSQL**: Neon Serverless Postgres (Free tier)
* **Redis**: Upstash Redis (Free tier)
* **Kafka**: Upstash Kafka (Free tier, set up when E2 reaches S1-06)

---

## 📋 Assigned Tasks

---

### TASK S1-D1: Vercel Frontend Deployment (2 SP)
* **Goal:** Set up continuous deployment for frontend using Vercel.
* **Steps:**
  1. Go to [vercel.com](https://vercel.com) → Sign up with GitHub → Import the `LuminAI-Platform/LuminAI` repo
  2. Configure project: Framework Preset `Vite`, Root Directory `frontend`, Build Command `npm run build`, Output Directory `dist`.
  3. Set environment variables in Vercel:
     ```
     VITE_API_URL=https://luminai-api.onrender.com
     VITE_AUTH_URL=https://luminai-auth.onrender.com/realms/luminai
     VITE_AUTH_CLIENT_ID=luminai-spa
     ```
  4. Enable auto-deploy on push to `main` and PR previews.

#### Acceptance Criteria
- [ ] Pushing to `main` triggers auto-deploy.
- [ ] Frontend is accessible at the Vercel URL.
- [ ] PRs generate preview deployment URLs.

---

### TASK S1-D2: Neon PostgreSQL Setup (1 SP)
* **Goal:** Set up a free-tier serverless PostgreSQL database on Neon.
* **Steps:**
  1. Go to [neon.tech](https://neon.tech) → Create project `luminai` and database `luminai_db`.
  2. Enable Connection Pooling in Neon dashboard (port 6543).
  3. Save both direct and pooled connection strings. (migrations use direct, backend uses pooled).

#### Acceptance Criteria
- [ ] Neon database created and accessible.
- [ ] Direct and pooled connection strings saved for config.

---

### TASK S1-D3: Upstash Redis Setup (1 SP)
* **Goal:** Set up a managed Redis cache instance on Upstash free tier.
* **Steps:**
  1. Go to [upstash.com](https://upstash.com) → Create Redis database `luminai-redis` with TLS enabled.
  2. Copy host, port, and token.

#### Acceptance Criteria
- [ ] Redis instance created and accessible.

---

### TASK S1-D4: Render Backend Services Deployment (5 SP)
* **Goal:** Deploy Spring Boot Backend, FastAPI Data Engine, and Keycloak on Render Free Web Services.

#### Step 1 — Deploy Keycloak
1. Render dashboard → New Web Service → Registry image: `quay.io/keycloak/keycloak:26.0`
2. Docker Command: `start --hostname-strict=false --proxy-headers=xforwarded --http-enabled=true`
3. Environment variables: `KC_DB=postgres`, `KC_DB_URL`, `KC_DB_USERNAME`, `KC_DB_PASSWORD`, `KEYCLOAK_ADMIN`, `KEYCLOAK_ADMIN_PASSWORD`.
4. After deploy: log in to admin, import realm from `infra/keycloak/luminai-realm.json`, update `luminai-spa` client redirect/origins to Vercel.

#### Step 2 — Deploy Core Backend (Spring Boot)
1. New Web Service → Connect GitHub repo → Root Directory `core-backend`, Runtime `Docker`, Instance `Free`.
2. Env variables: `SPRING_PROFILES_ACTIVE=dev`, `SPRING_DATASOURCE_URL` (pooled Neon), `SPRING_FLYWAY_URL` (direct Neon), `SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI`, `SPRING_DATA_REDIS_HOST`, etc.

#### Step 3 — Deploy Data Engine (FastAPI)
1. New Web Service → Connect GitHub repo → Root Directory `data-engine`, Runtime `Docker`, Instance `Free`.
2. Env variables: `DATABASE_URL` (pooled Neon), `REDIS_URL` (Upstash TLS URL).

#### Acceptance Criteria
- [ ] Keycloak shows realm login, Spring backend health check returns UP, FastAPI docs show Swagger.

---

### TASK S1-D5: Wire Services Together (2 SP)
* **Goal:** Connect all frontend, backend, database, cache, and auth services together.
* **Steps:**
  1. Set environment variable `CORS_ALLOWED_ORIGINS` to include Vercel URL.
  2. Verify Keycloak Redirect/Web Origins match Vercel URL.
  3. Verify end-to-end user login flow works from Vercel URL.

#### Acceptance Criteria
- [ ] End-to-end login flow works without CORS errors.

---

### TASK S1-15: Basic Helm Chart Templates (3 SP)
* **Goal:** Create base Helm chart directories for local K8s testing and eventual AWS EKS migration.
* **Target Files:**
  * `infra/helm/core-backend/templates/`
  * `infra/helm/data-engine/templates/`
  * `infra/helm/frontend/templates/`

#### Acceptance Criteria
- [ ] Helm charts exist and render valid manifests.
