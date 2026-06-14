# 🚀 DevOps Sprint 1 — Deployment Task Sheet

> **Engineer:** E5 (DevOps)
> **Sprint:** 1 — Data Connection (Weeks 3–4)
> **Platforms:** Vercel (Frontend) + Render (Backend Services) + Neon (PostgreSQL) + Upstash (Redis & Kafka)
> **Budget:** $0 — All free tiers. This is a dev preview, NOT production.

---

## 📐 Deployment Architecture

```
                    ┌─────────────────────────────────┐
                    │         VERCEL (Free)            │
                    │   luminai.vercel.app             │
                    │   React/Vite Frontend            │
                    │   Auto-deploy from main          │
                    └──────────┬──────────────────────┘
                               │ API calls
                               ▼
              ┌────────────────────────────────────┐
              │      RENDER (Free Tier)            │
              │                                    │
              │  ┌──────────────┐ ┌──────────────┐ │
              │  │ Core Backend │ │ Data Engine   │ │
              │  │ Spring Boot  │ │ FastAPI       │ │
              │  │ (Docker)     │ │ (Docker)      │ │
              │  └──────────────┘ └──────────────┘ │
              │                                    │
              │  ┌──────────────┐                  │
              │  │  Keycloak    │                  │
              │  │  (Docker)    │                  │
              │  └──────────────┘                  │
              └────────────────────────────────────┘

    MANAGED FREE TIERS
    ┌────────────┐ ┌────────────┐ ┌────────────┐
    │ Neon       │ │ Upstash    │ │ Upstash    │
    │ PostgreSQL │ │ Redis      │ │ Kafka      │
    │ (Free)     │ │ (Free)     │ │ (Free)     │
    └────────────┘ └────────────┘ └────────────┘
```

---

## ✅ What Gets Deployed

| Service | Platform | Free Tier Limits | URL Pattern |
|---|---|---|---|
| **React Frontend** | Vercel | 100GB bandwidth/mo | `luminai.vercel.app` |
| **Core Backend** (Java) | Render | 750 hrs/mo, spins down after 15 min inactivity | `luminai-api.onrender.com` |
| **Data Engine** (Python) | Render | Same as above | `luminai-data.onrender.com` |
| **Keycloak** | Render | Same as above | `luminai-auth.onrender.com` |
| **PostgreSQL** | Neon | 0.5 GB storage, auto-suspend after 5 min | Connection string from Neon dashboard |
| **Redis** | Upstash | 10K commands/day, 256MB | Connection string from Upstash dashboard |

> **Total cost: $0/month**

> [!WARNING]
> **Cold starts:** Render free tier services spin down after 15 minutes of inactivity. First request after sleep takes 30–60 seconds (longer for Java/Keycloak). Neon also auto-suspends after 5 minutes — first query takes ~1 second to wake. This is fine for dev preview, just warn the team.

---

## ⏸️ What Is NOT Deployed Yet

| Service | When Needed | Free Alternative |
|---|---|---|
| **Kafka** | Sprint 1 (S1-06) | **Upstash Kafka** — free tier, 10K messages/day. Set up when E2 reaches S1-06. |
| **Neo4j** | Sprint 3 (S3-05) | **Neo4j Aura Free** — 200K nodes, 400K relationships. `neo4j.com/cloud/aura-free` |
| **OpenSearch** | Sprint 3 (S3-08) | Defer until AWS staging in Sprint 2–3 |
| **MinIO** | Sprint 1 (S1-02) | **Cloudflare R2** — free 10GB/mo, S3-compatible API. Or **AWS S3** free tier (5GB) |
| **Dagster** | Sprint 2 | Data engineer runs locally only |
| **PgBouncer** | N/A | Not needed — Neon has built-in connection pooling |

---

## 📋 Tasks

---

### TASK S1-D1: Vercel Frontend Deployment (2 SP)

**Priority:** 🔴 Day 1

#### Steps:
1. Go to [vercel.com](https://vercel.com) → Sign up with GitHub → Import the `LuminAI-Platform/LuminAI` repo
2. Configure the project:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Set environment variables in Vercel dashboard:
   ```
   VITE_API_URL=https://luminai-api.onrender.com
   VITE_AUTH_URL=https://luminai-auth.onrender.com/realms/luminai
   VITE_AUTH_CLIENT_ID=luminai-spa
   ```
4. Enable **auto-deploy on push to `main`**
5. Enable **Preview Deployments** for PRs (every PR gets its own preview URL for free)

#### Acceptance Criteria:
- [ ] Pushing to `main` triggers auto-deploy
- [ ] Frontend is accessible at the Vercel URL
- [ ] PRs generate preview deployment URLs for team to review

---

### TASK S1-D2: Neon PostgreSQL Setup (1 SP)

**Priority:** 🔴 Day 1

#### Steps:
1. Go to [neon.tech](https://neon.tech) → Sign up → Create project
2. Project settings:
   - **Project Name:** `luminai`
   - **Database Name:** `luminai_db`
   - **Role:** `luminai_user`
   - **Region:** closest to team
3. Copy the connection string — it will look like:
   ```
   postgresql://luminai_user:PASSWORD@ep-xxxxx.region.aws.neon.tech/luminai_db?sslmode=require
   ```
4. Enable **Connection Pooling** in Neon dashboard (gives you a pooled connection string on port 6543)
5. Save both the **direct** and **pooled** connection strings — backend uses pooled, Flyway migrations use direct

> [!IMPORTANT]
> Neon requires `?sslmode=require` in the connection string. Make sure this is included in the Spring Boot config.

#### Acceptance Criteria:
- [ ] Neon database created and accessible
- [ ] Both direct and pooled connection strings saved for backend configuration

---

### TASK S1-D3: Upstash Redis Setup (1 SP)

**Priority:** 🔴 Day 1

#### Steps:
1. Go to [upstash.com](https://upstash.com) → Sign up → Create Redis database
2. Settings:
   - **Name:** `luminai-redis`
   - **Region:** same region as Neon
   - **TLS:** Enabled
3. Copy the connection details:
   ```
   Host: xxxxx.upstash.io
   Port: 6379
   Password: <TOKEN>
   ```

#### Acceptance Criteria:
- [ ] Redis instance created and accessible
- [ ] Connection details saved for backend configuration

---

### TASK S1-D4: Render Backend Services Deployment (5 SP)

**Priority:** 🔴 Day 1–2

#### Step 1 — Deploy Keycloak
1. Render dashboard → **New → Web Service**
2. Select **Deploy an existing image from a registry**
3. Image URL: `quay.io/keycloak/keycloak:26.0`
4. Settings:
   - **Name:** `luminai-auth`
   - **Region:** same as Neon
   - **Instance Type:** Free
   - **Docker Command:** `start --hostname-strict=false --proxy-headers=xforwarded --http-enabled=true`
5. Environment variables:
   ```
   KC_DB=postgres
   KC_DB_URL=jdbc:postgresql://<NEON_HOST>/luminai_db?sslmode=require
   KC_DB_USERNAME=luminai_user
   KC_DB_PASSWORD=<NEON_PASSWORD>
   KEYCLOAK_ADMIN=admin
   KEYCLOAK_ADMIN_PASSWORD=<CHOOSE_SECURE_PASSWORD>
   ```
6. After deployment is live:
   - Go to `https://luminai-auth.onrender.com/admin`
   - Log in with admin credentials
   - Import realm from `infra/keycloak/luminai-realm.json`
   - Update the `luminai-spa` client:
     - **Valid Redirect URIs:** `https://luminai.vercel.app/*` and `http://localhost:5173/*`
     - **Web Origins:** `https://luminai.vercel.app` and `http://localhost:5173`

> [!WARNING]
> Keycloak is memory-hungry (~512MB). On Render's free tier (512MB RAM limit) it may be tight. If it keeps crashing, consider using **cloud-iam.com** (free managed Keycloak for up to 100 users) as a fallback.

#### Step 2 — Deploy Core Backend (Spring Boot)
1. **New → Web Service → Connect GitHub repo** (`LuminAI-Platform/LuminAI`)
2. Settings:
   - **Name:** `luminai-api`
   - **Root Directory:** `core-backend`
   - **Runtime:** Docker
   - **Instance Type:** Free
   - **Health Check Path:** `/actuator/health`
3. Environment variables:
   ```
   SPRING_PROFILES_ACTIVE=dev
   SPRING_DATASOURCE_URL=jdbc:postgresql://<NEON_POOLED_HOST>:6543/luminai_db?sslmode=require
   SPRING_DATASOURCE_USERNAME=luminai_user
   SPRING_DATASOURCE_PASSWORD=<NEON_PASSWORD>
   SPRING_FLYWAY_URL=jdbc:postgresql://<NEON_DIRECT_HOST>/luminai_db?sslmode=require
   SPRING_FLYWAY_USER=luminai_user
   SPRING_FLYWAY_PASSWORD=<NEON_PASSWORD>
   SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI=https://luminai-auth.onrender.com/realms/luminai
   SPRING_DATA_REDIS_HOST=<UPSTASH_HOST>
   SPRING_DATA_REDIS_PORT=6379
   SPRING_DATA_REDIS_PASSWORD=<UPSTASH_TOKEN>
   SPRING_DATA_REDIS_SSL_ENABLED=true
   ```
4. Enable auto-deploy from `main`

> [!IMPORTANT]
> Flyway uses the **direct** Neon connection (not pooled) because migration transactions don't work well with connection poolers. The app itself uses the **pooled** connection.

#### Step 3 — Deploy Data Engine (FastAPI)
1. **New → Web Service → Connect GitHub repo**
2. Settings:
   - **Name:** `luminai-data`
   - **Root Directory:** `data-engine`
   - **Runtime:** Docker
   - **Instance Type:** Free
   - **Health Check Path:** `/health`
3. Environment variables:
   ```
   DATABASE_URL=postgresql://<NEON_POOLED_HOST>:6543/luminai_db?sslmode=require
   REDIS_URL=rediss://<UPSTASH_TOKEN>@<UPSTASH_HOST>:6379
   ```
4. Enable auto-deploy from `main`

#### Acceptance Criteria:
- [ ] `https://luminai-auth.onrender.com` shows Keycloak login page
- [ ] `https://luminai-api.onrender.com/actuator/health` returns `{"status":"UP"}`
- [ ] `https://luminai-data.onrender.com/health` returns JSON status
- [ ] `https://luminai-data.onrender.com/docs` shows FastAPI Swagger
- [ ] Flyway migrations run on backend startup (tables exist in Neon)

---

### TASK S1-D5: Wire Services Together (2 SP)

**Priority:** 🟠 Day 2–3

Once all services are deployed, wire them together:

#### Connection Map:

```
Frontend (Vercel)
  ├──→ Core Backend (Render) via VITE_API_URL
  └──→ Keycloak (Render) via VITE_AUTH_URL for OIDC login

Core Backend (Render)
  ├──→ PostgreSQL (Neon) for data persistence
  ├──→ Redis (Upstash) for caching
  └──→ Keycloak (Render) for JWT validation

Data Engine (Render)
  ├──→ PostgreSQL (Neon) for data queries
  └──→ Redis (Upstash) for caching
```

#### Steps:

1. **CORS Update:** Ask E1 (Tech Lead) to make CORS origins configurable via env var in `SecurityConfig.java`. Then set:
   ```
   CORS_ALLOWED_ORIGINS=https://luminai.vercel.app,http://localhost:5173
   ```

2. **Keycloak Realm Config:** Verify the `luminai-spa` client has:
   - Vercel URL in Valid Redirect URIs
   - Vercel URL in Web Origins
   - localhost URLs still present for local dev

3. **Verify End-to-End:**
   - Open Vercel URL → App should load
   - Click login → Should redirect to Keycloak on Render
   - After login → Should return to app with user info
   - API calls → Should hit Render backend, which reads from Neon

4. **Share URLs with team** in Slack/Discord:
   ```
   🔗 LuminAI Dev Environment
   ─────────────────────────
   Frontend:  https://luminai.vercel.app
   API Docs:  https://luminai-api.onrender.com/swagger-ui.html
   Data API:  https://luminai-data.onrender.com/docs
   Auth:      https://luminai-auth.onrender.com
   
   ⚠️ Services may take 30-60s to wake up on first request (free tier)
   ```

#### Acceptance Criteria:
- [ ] No CORS errors when frontend calls backend
- [ ] Keycloak login flow works from Vercel URL
- [ ] All team members can access the URLs
- [ ] Backend reads/writes to Neon PostgreSQL successfully

---

### TASK S1-15: Basic Helm Chart Templates (3 SP)

**Priority:** 🟡 Week 2

*(Original Sprint 1 task — unchanged. For future K8s/AWS migration.)*

#### Acceptance Criteria:
- [ ] Helm charts exist for core-backend, data-engine, frontend
- [ ] `helm template` renders valid K8s manifests

---

## 📊 Sprint 1 Summary for DevOps

| Task | SP | Priority | Timeline |
|---|---|---|---|
| S1-D1: Vercel frontend deploy | 2 | 🔴 Day 1 | 1–2 hours |
| S1-D2: Neon PostgreSQL setup | 1 | 🔴 Day 1 | 30 min |
| S1-D3: Upstash Redis setup | 1 | 🔴 Day 1 | 30 min |
| S1-D4: Render services deploy | 5 | 🔴 Day 1–2 | 1 day |
| S1-D5: Wire services together | 2 | 🟠 Day 2–3 | Half day |
| S1-15: Helm chart templates | 3 | 🟡 Week 2 | 1–2 days |
| **Total** | **14** | | |

---

## 🔗 What Everyone Gets After Deployment

| URL | What | Who Uses It |
|---|---|---|
| `https://luminai.vercel.app` | Live app UI | 👥 Everyone |
| `https://luminai-api.onrender.com/swagger-ui.html` | Backend API playground | 🔧 Backend devs (E1, E2, E3) |
| `https://luminai-data.onrender.com/docs` | Data Engine API playground | 📊 Data engineer (E6) |
| `https://luminai-auth.onrender.com/admin` | Keycloak admin console | 🔐 Tech Lead + DevOps |

---

## 💰 Cost Breakdown

| Service | Provider | Plan | Monthly Cost |
|---|---|---|---|
| Frontend | Vercel | Free | $0 |
| Core Backend | Render | Free | $0 |
| Data Engine | Render | Free | $0 |
| Keycloak | Render | Free | $0 |
| PostgreSQL | Neon | Free (0.5GB) | $0 |
| Redis | Upstash | Free (10K cmd/day) | $0 |
| **Total** | | | **$0** |

