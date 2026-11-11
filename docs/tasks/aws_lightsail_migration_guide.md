# 🚀 LuminAI Platform — 3-Night AWS Lightsail Production Migration Master Guide

> **Target Platform:** AWS Lightsail (Ubuntu 24.04 LTS · 8 GB RAM · 2 vCPUs · 160 GB SSD)  
> **Budget Profile:** GHS 10,000 Annual Fund (~$660–$700 USD) + $120 AWS Credits  
> **Target Run Cost:** $40.00/month (Months 1–3 free via credits; Months 4–12 = $360 total)  
> **Safety Reserve Left:** ~GHS 4,200+ reserved in company bank account  
> **Engineers:** Project Lead & DevOps Engineer (E5)  

---

## 📋 Architectural Scope: What Stays, What Changes

| Component | Technology | AWS Lightsail Deployment Method | Role |
|---|---|---|---|
| **`core-backend`** | Java 21 / Spring Boot 3.5 | Docker container on port `8080` (Internal) | Modular Monolith REST API & business logic |
| **`data-engine`** | Python 3.12 / FastAPI | Docker container on port `8000` (Internal) | Ingestion pipelines & entity resolution |
| **`frontend`** | React 19 / Vite / Nginx | Docker container on port `3000` (Internal) | SPA Web UI (Cytoscape.js & ECharts) |
| **`postgres`** | PostgreSQL 16 Alpine | Docker container on port `5432` (Internal) | Multi-tenant relational store (`public` + `tenant_*`) |
| **`neo4j`** | Neo4j 5 Community | Docker container on ports `7474`, `7687` (Internal) | **Knowledge Graph database** for entity relationships |
| **`keycloak`** | Keycloak 24.0 (Quarkus) | Docker container on port `8180` (Internal) | Identity Provider, RBAC & JWT issuer |
| **`kafka` + `zk`** | Confluent Kafka 7.6 | Docker container on ports `9092`, `29092` (Internal) | Event streaming & asynchronous ingestion |
| **`redis`** | Redis 7 Alpine | Docker container on port `6379` (Internal) | Query & session caching |
| **Edge Router** | Caddy Server | Native Host Service on ports `80`, `443` (Public) | Reverse proxy & **Automated Let's Encrypt SSL** |
| **Object Storage**| Amazon S3 (`luminai-prod-storage`)| AWS Cloud Native Storage (Replaces MinIO container) | Raw CSV/JSON uploads & automated database backups |

> [!NOTE]
> **Bloat Removed:** OpenSearch (2 GB RAM) and Dagster standalone daemons (1 GB RAM) are excluded. Codebase analysis verified that `core-backend` searches PostgreSQL directly, and `data-engine` runs Dagster pipelines in-process via `dagster.materialize`.

---

## 🛠️ STAGE 0: Pre-Flight Code Fixes (Do This on GitHub First)

Before touching the AWS server, apply these 2 code fixes to your GitHub repository on a new branch and merge to `main`. This guarantees that when you run `git clone` on AWS, everything compiles cleanly.

### Fix 1: Update `frontend/Dockerfile`
Vite compiles environment variables into static JS at build time. Without build arguments, it bakes in the old Render URL.

Update `frontend/Dockerfile` to:
```dockerfile
# ---- Stage 1: Build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Accept build arguments from docker-compose
ARG VITE_API_URL
ARG VITE_AUTH_URL
ARG VITE_AUTH_CLIENT_ID

# Expose them to the Vite build engine
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_AUTH_URL=$VITE_AUTH_URL
ENV VITE_AUTH_CLIENT_ID=$VITE_AUTH_CLIENT_ID

RUN npm run build

# ---- Stage 2: Serve ----
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### Fix 2: Update `docker-compose.prod.yml`
Replace the contents of `docker-compose.prod.yml` in the repository root with this clean, production-tuned specification:

```yaml
# ==============================================================================
# LUMINAI PRODUCTION OVERRIDES (AWS UNIFIED LIGHTSAIL)
# ==============================================================================
services:
  postgres:
    ports: []
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-luminai}
      POSTGRES_USER: ${POSTGRES_USER:-luminai_admin}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    deploy:
      resources:
        limits:
          memory: 768m
          cpus: "0.75"

  neo4j:
    image: neo4j:5-community
    container_name: luminai-neo4j
    restart: unless-stopped
    ports: []
    environment:
      NEO4J_AUTH: ${NEO4J_AUTH:-neo4j/luminai_dev_password}
      NEO4J_server_memory_heap_initial__size: 256m
      NEO4J_server_memory_heap_max__size: 512m
      NEO4J_server_memory_pagecache_size: 256m
    volumes:
      - neo4j_data:/data
    deploy:
      resources:
        limits:
          memory: 768m
          cpus: "0.5"

  keycloak:
    ports: []
    environment:
      KEYCLOAK_ADMIN: ${KEYCLOAK_ADMIN:-admin}
      KEYCLOAK_ADMIN_PASSWORD: ${KEYCLOAK_ADMIN_PASSWORD}
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://postgres:5432/${POSTGRES_DB:-luminai}
      KC_DB_USERNAME: ${POSTGRES_USER:-luminai_admin}
      KC_DB_PASSWORD: ${POSTGRES_PASSWORD}
      KC_HTTP_PORT: 8180
      JAVA_OPTS_APPEND: "-Xms256m -Xmx512m"
    deploy:
      resources:
        limits:
          memory: 768m
          cpus: "0.75"

  redis:
    ports: []
    deploy:
      resources:
        limits:
          memory: 128m
          cpus: "0.25"

  zookeeper:
    ports: []
    deploy:
      resources:
        limits:
          memory: 256m
          cpus: "0.25"

  kafka:
    ports: []
    deploy:
      resources:
        limits:
          memory: 512m
          cpus: "0.5"

  core-backend:
    ports:
      - "127.0.0.1:8080:8080"
    environment:
      SPRING_PROFILES_ACTIVE: prod
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/${POSTGRES_DB:-luminai}
      SPRING_DATASOURCE_USERNAME: ${POSTGRES_USER:-luminai_admin}
      SPRING_DATASOURCE_PASSWORD: ${POSTGRES_PASSWORD}
      SPRING_FLYWAY_URL: jdbc:postgresql://postgres:5432/${POSTGRES_DB:-luminai}
      SPRING_FLYWAY_USER: ${POSTGRES_USER:-luminai_admin}
      SPRING_FLYWAY_PASSWORD: ${POSTGRES_PASSWORD}
      SPRING_DATA_REDIS_HOST: redis
      SPRING_DATA_REDIS_PORT: 6379
      SPRING_DATA_REDIS_SSL_ENABLED: "false"
      KAFKA_BOOTSTRAP_SERVERS: kafka:29092
      # Neo4j Knowledge Graph parameters
      NEO4J_URI: bolt://neo4j:7687
      NEO4J_USERNAME: neo4j
      NEO4J_PASSWORD: ${NEO4J_PASSWORD:-luminai_dev_password}
      # Keycloak OIDC Authentication & Admin REST
      KEYCLOAK_ISSUER_URI: https://auth.${DOMAIN_NAME}/realms/${KEYCLOAK_REALM:-luminai}
      KEYCLOAK_JWK_SET_URI: https://auth.${DOMAIN_NAME}/realms/${KEYCLOAK_REALM:-luminai}/protocol/openid-connect/certs
      KEYCLOAK_BASE_URL: http://keycloak:8180
      KEYCLOAK_REALM: ${KEYCLOAK_REALM:-luminai}
      KEYCLOAK_ADMIN_CLIENT_ID: ${KEYCLOAK_ADMIN_CLIENT_ID:-luminai-admin-cli}
      KEYCLOAK_ADMIN_CLIENT_SECRET: ${KEYCLOAK_ADMIN_CLIENT_SECRET:-}
      VAULT_ENCRYPTION_KEY: ${VAULT_ENCRYPTION_KEY:-01234567890123456789012345678901}
      DATA_ENGINE_URL: http://data-engine:8000
      DATA_ENGINE_API_KEY: ${DATA_ENGINE_API_KEY:-luminai-internal-secret-key}
      MINIO_ENDPOINT: ${MINIO_ENDPOINT}
      MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY}
      MINIO_SECRET_KEY: ${MINIO_SECRET_KEY}
      MINIO_BUCKET: ${MINIO_BUCKET_RAW:-luminai-raw}
      MINIO_REGION: ${MINIO_REGION:-us-east-1}
      CORS_ALLOWED_ORIGINS: https://app.${DOMAIN_NAME},http://localhost:5173
    deploy:
      resources:
        limits:
          memory: 1200m
          cpus: "1.0"

  data-engine:
    ports:
      - "127.0.0.1:8000:8000"
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:-luminai_admin}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-luminai}
      REDIS_URL: redis://redis:6379
      KAFKA_BOOTSTRAP_SERVERS: kafka:29092
      KAFKA_ENABLED: "true"
      NEO4J_URI: bolt://neo4j:7687
      NEO4J_USERNAME: neo4j
      NEO4J_PASSWORD: ${NEO4J_PASSWORD:-luminai_dev_password}
      MINIO_ENDPOINT: ${MINIO_ENDPOINT}
      MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY}
      MINIO_SECRET_KEY: ${MINIO_SECRET_KEY}
      MINIO_SECURE: ${MINIO_SECURE:-true}
      MINIO_BUCKET_RAW: ${MINIO_BUCKET_RAW:-luminai-raw}
      MINIO_REGION: ${MINIO_REGION:-us-east-1}
      APP_FRONTEND_URL: https://app.${DOMAIN_NAME}
      API_KEY: ${DATA_ENGINE_API_KEY:-luminai-internal-secret-key}
      KEYCLOAK_URL: http://keycloak:8180
      KEYCLOAK_REALM: ${KEYCLOAK_REALM:-luminai}
      AI_INSIGHTS_PROVIDER: ${AI_INSIGHTS_PROVIDER:-auto}
      GEMINI_API_KEY: ${GEMINI_API_KEY:-}
      OPENAI_API_KEY: ${OPENAI_API_KEY:-}
    deploy:
      resources:
        limits:
          memory: 768m
          cpus: "0.75"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        VITE_API_URL: https://api.${DOMAIN_NAME}
        VITE_AUTH_URL: https://auth.${DOMAIN_NAME}/realms/${KEYCLOAK_REALM:-luminai}
        VITE_AUTH_CLIENT_ID: luminai-spa
    ports:
      - "127.0.0.1:3000:80"
    deploy:
      resources:
        limits:
          memory: 128m
          cpus: "0.25"

  # ---------------------------------------------------------------------------
  # Disable RAM-heavy non-production services from base compose
  # ---------------------------------------------------------------------------
  opensearch:
    profiles: ["disabled"]
    deploy:
      replicas: 0

  dagster-webserver:
    profiles: ["disabled"]
    deploy:
      replicas: 0

  dagster-daemon:
    profiles: ["disabled"]
    deploy:
      replicas: 0
```

### Fix 3: Git Commit and Push
```bash
git checkout -b chore/lightsail-migration-prep
git add frontend/Dockerfile docker-compose.prod.yml
git commit -m "chore: optimize docker-compose and frontend build for unified AWS Lightsail deployment"
git push origin chore/lightsail-migration-prep
```
*Merge this pull request into `main` on GitHub before starting Night 1.*

---

## 🌙 NIGHT 1: Host Provisioning, Swap Memory, Git Connection & Build

> **Objective:** Launch the AWS host, configure safety memory, connect GitHub, and build all containers.  
> **Downtime / Risk:** **0% Risk** — Existing live preview on Vercel/Render remains 100% active.

### Step 1.1: Launch Lightsail Instance (Project Lead)
1. Open the [AWS Lightsail Console](https://lightsail.aws.amazon.com/).
2. Click **Create instance**:
   * **Location:** Choose region closest to your client (e.g. Frankfurt `eu-central-1` or Cape Town `af-south-1`).
   * **Platform:** Linux/Unix.
   * **Blueprint:** OS Only → **Ubuntu 24.04 LTS**.
   * **Instance Plan:** **$40 USD/month** (8 GB RAM, 2 vCPUs, 160 GB SSD, 5 TB Transfer).
   * **Identify your instance:** `luminai-production`.
3. Click **Create instance**.
4. Go to the **Networking** tab of your instance:
   * Click **Create static IP** → Attach it to `luminai-production`. Note this IP: `YOUR_STATIC_IP`.
   * Under **IPv4 Firewall**, ensure only ports **22 (SSH)**, **80 (HTTP)**, and **443 (HTTPS)** are open.

### Step 1.2: Host Configuration & 4GB Swap File (DevOps E5)
Connect via SSH:
```bash
ssh -i your-lightsail-key.pem ubuntu@YOUR_STATIC_IP
```

Run the initial server hardening and memory configuration:
```bash
# 1. Update OS packages
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git htop docker.io docker-compose-plugin

# 2. Configure 4GB Swap file (Prevents JVM/Data-Engine memory spikes)
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# 3. Allow non-root Docker usage
sudo usermod -aG docker ubuntu
newgrp docker
```

*Expected Result:* Running `free -h` shows **~7.8Gi Total Memory** and **4.0Gi Swap**.

### Step 1.3: Connect GitHub to AWS (You & DevOps E5)
1. Generate an SSH Deploy Key on the server:
   ```bash
   ssh-keygen -t ed25519 -C "aws-lightsail-production" -N ""
   cat ~/.ssh/id_ed25519.pub
   ```
2. Copy the key output.
3. In GitHub: Navigate to `LuminAI-Platform/LuminAI` → **Settings** → **Deploy Keys** → **Add deploy key**:
   * **Title:** `AWS Lightsail Production`
   * **Key:** Paste the public key string.
   * Leave "Allow write access" **unchecked** → Click **Add key**.
4. Clone the repository onto Lightsail:
   ```bash
   cd /home/ubuntu
   git clone git@github.com:LuminAI-Platform/LuminAI.git
   cd LuminAI
   ```

### Step 1.4: Prepare `.env` & Run Test Build
1. Create the production `.env` file on the server:
   ```bash
   cp .env.example .env
   nano .env
   ```
2. Populate the required variables:
   ```dotenv
   # Domain & Security
   DOMAIN_NAME=yourdomain.com
   KEYCLOAK_REALM=luminai
   VAULT_ENCRYPTION_KEY=GenerateA32CharacterRandomString!

   # PostgreSQL
   POSTGRES_DB=luminai
   POSTGRES_USER=luminai_admin
   POSTGRES_PASSWORD=CreateAStrongPostgresPassword123!

   # Neo4j Graph Database
   NEO4J_PASSWORD=CreateAStrongNeo4jPassword123!
   NEO4J_AUTH=neo4j/CreateAStrongNeo4jPassword123!

   # Keycloak Admin
   KEYCLOAK_ADMIN=admin
   KEYCLOAK_ADMIN_PASSWORD=CreateAStrongKeycloakAdminPass123!

   # (Optional) AI Insights Engine (Gemini / OpenAI API)
   AI_INSIGHTS_PROVIDER=auto
   GEMINI_API_KEY=
   OPENAI_API_KEY=
   ```
3. Run the container test build:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml build
   ```

*Expected Result:* All images (`core-backend`, `data-engine`, `frontend`) build successfully and exit with code 0.  
**Night 1 is complete!**

---

## 🌙 NIGHT 2: Multi-Tenant Database, Neo4j, S3 & Service Verification

> **Objective:** Export Neon PostgreSQL (with all tenant schemas), restore to AWS Postgres, configure Neo4j graph store, wire Amazon S3, and verify system parity.  
> **Downtime / Risk:** **0% Risk** — Old system remains active.

### Step 2.1: Provision Amazon S3 Bucket (Project Lead)
1. Go to AWS Console → Search **S3** → Click **Create bucket**.
2. **Bucket name:** `luminai-prod-storage` (Region: same as Lightsail).
3. Keep default settings ("Block all public access" checked).
4. Go to **IAM Console** → **Users** → **Create user**:
   * Name: `luminai-app-s3`
   * Attach policy directly: `AmazonS3FullAccess` (or scoped to `luminai-prod-storage`).
   * Create an **Access Key** (type: Application running outside AWS).
5. Add these credentials to `/home/ubuntu/LuminAI/.env` on the server:
   ```dotenv
   MINIO_ENDPOINT=https://s3.eu-central-1.amazonaws.com
   MINIO_ACCESS_KEY=YOUR_IAM_ACCESS_KEY
   MINIO_SECRET_KEY=YOUR_IAM_SECRET_KEY
   MINIO_SECURE=true
   MINIO_BUCKET_RAW=luminai-prod-storage
   ```

### Step 2.2: Export Complete Database from Neon (DevOps E5)
From your local terminal, dump all schemas (`public`, `tenant_template`, `tenant_*`):
```bash
pg_dump "postgresql://luminai_user:NEON_PASSWORD@ep-xxxx.region.aws.neon.tech/luminai_db?sslmode=require" \
  --clean --no-owner --no-privileges > luminai_neon_complete.sql
```
Upload the backup to the Lightsail server:
```bash
scp -i your-lightsail-key.pem luminai_neon_complete.sql ubuntu@YOUR_STATIC_IP:/home/ubuntu/
```

### Step 2.3: Restore Database into AWS PostgreSQL Container
On the Lightsail server:
```bash
cd /home/ubuntu/LuminAI

# 1. Start Postgres service first
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d postgres

# 2. Wait 10 seconds for initialisation, then restore the dump
docker exec -i luminai-postgres psql -U luminai_admin -d luminai < /home/ubuntu/luminai_neon_complete.sql

# 3. Verify all schemas and tenant tables were restored:
docker exec -it luminai-postgres psql -U luminai_admin -d luminai -c "\dn"
docker exec -it luminai-postgres psql -U luminai_admin -d luminai -c "SELECT id, name, slug FROM tenants;"
```

*Expected Result:* Terminal lists `public`, `tenant_template`, and tenant-specific schemas (`tenant_default`, `tenant_acme`), with existing tenants displayed.

### Step 2.4: Boot the Entire Unified Platform & Verify
Start all platform containers:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```
Monitor startup health:
```bash
docker ps
```
Run sanity checks on individual container ports:
```bash
# 1. Core Backend Health (Spring Boot)
curl -f http://localhost:8080/actuator/health

# 2. Data Engine Health (FastAPI)
curl -f http://localhost:8000/health

# 3. Keycloak Readiness
curl -f http://localhost:8180/health/ready

# 4. Neo4j HTTP Port
curl -I http://localhost:7474
```

### Step 2.5: Lower DNS TTL (Project Lead)
In your domain registrar dashboard (Cloudflare, Namecheap, Route 53):
* Locate your domain (`yourdomain.com`).
* Change the **TTL** (Time To Live) to **300 seconds (5 minutes)**.

**Night 2 is complete!**

---

## 🌙 NIGHT 3: Edge SSL Router, DNS Cutover, Smoke Tests & Backups

> **Objective:** Configure Caddy reverse proxy, update DNS records, verify automated Let's Encrypt SSL, execute live smoke tests, and enable nightly automated S3 backups.  
> **Downtime / Risk:** ~10-minute DNS propagation window.

### Step 3.1: Install & Configure Caddy Server (DevOps E5)
Caddy automatically provisions and auto-renews free Let's Encrypt SSL certificates for all subdomains.

On the Lightsail host:
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy -y
```

Edit `/etc/caddy/Caddyfile`:
```bash
sudo nano /etc/caddy/Caddyfile
```
Paste this configuration (replace `yourdomain.com` with your actual domain):
```caddy
# Frontend React SPA
app.yourdomain.com {
    reverse_proxy localhost:3000
}

# Core Backend REST API
api.yourdomain.com {
    reverse_proxy localhost:8080
}

# Keycloak Identity Provider
auth.yourdomain.com {
    reverse_proxy localhost:8180
}
```
Reload Caddy:
```bash
sudo systemctl reload caddy
```

### Step 3.2: Switch DNS Records to Lightsail (Project Lead)
In your domain registrar DNS manager, add or update three **A Records**:

| Type | Name / Subdomain | Target IPv4 Address | TTL |
|---|---|---|---|
| **A** | `app` | `YOUR_STATIC_IP` | 300 |
| **A** | `api` | `YOUR_STATIC_IP` | 300 |
| **A** | `auth` | `YOUR_STATIC_IP` | 300 |

*Within 2 to 5 minutes, Caddy will obtain SSL certificates for all three addresses automatically.*

### Step 3.3: Keycloak Client Redirect Update (Together)
1. Open `https://auth.yourdomain.com/admin` in your browser.
2. Log in using `KEYCLOAK_ADMIN` and `KEYCLOAK_ADMIN_PASSWORD`.
3. Select the `luminai` (or `luminai-auth`) realm.
4. Go to **Clients** → Click `luminai-spa`:
   * Update **Valid Redirect URIs**: `https://app.yourdomain.com/*`
   * Update **Web Origins**: `https://app.yourdomain.com`
5. Click **Save**.

### Step 3.4: Live Smoke Test Verification Checklist
Open an incognito browser window and test the following:
* [ ] **SSL Verification:** Navigate to `https://app.yourdomain.com`. Verify the connection is secure (green padlock).
* [ ] **Authentication Flow:** Click "Login" → redirects to `auth.yourdomain.com` → enter credentials → returns to dashboard with user profile.
* [ ] **Zero Cold Start:** Click between Dashboard, Connection, and Explorer tabs. Verify pages load instantly without 45s sleep delays.
* [ ] **Knowledge Graph Explorer:** Open the **Knowledge Graph** tab. Verify Cytoscape.js renders entity nodes and edges fetched from Neo4j (`/api/v1/graph/neighbourhood`).
* [ ] **S3 Upload Pipeline:** In the Connection tab, upload a sample CSV/Excel dataset. Verify the file uploads successfully to the Amazon S3 bucket (`luminai-prod-storage`).

### Step 3.5: Set Up Automated Nightly S3 Backups (DevOps E5)
Create `/home/ubuntu/backup_to_s3.sh`:
```bash
#!/bin/bash
DATE=$(date +%Y-%m-%d_%H%M%S)
BACKUP_FILE="/tmp/luminai_backup_$DATE.sql.gz"

# 1. Dump all database schemas
docker exec luminai-postgres pg_dumpall -U luminai_admin | gzip > "$BACKUP_FILE"

# 2. Upload to Amazon S3
aws s3 cp "$BACKUP_FILE" s3://luminai-prod-storage/backups/

# 3. Clean up local temp file
rm -f "$BACKUP_FILE"
```
Make the script executable:
```bash
chmod +x /home/ubuntu/backup_to_s3.sh
```
Add to crontab to run every morning at 02:00 AM (`crontab -e`):
```cron
0 2 * * * /home/ubuntu/backup_to_s3.sh > /dev/null 2>&1
```

---

## 🚨 Troubleshooting & Rollback Safeguards

1. **Rollback Safety Net:** Do **NOT** delete your old Vercel or Neon accounts immediately. Keep them intact for 48–72 hours after go-live. If an unexpected blocker occurs on Night 3, simply switch the DNS records back to Vercel/Render.
2. **Keycloak CORS Error:** If the login page displays a CORS error, verify that `https://app.yourdomain.com` is present in `Web Origins` inside Keycloak admin console.
3. **Container Resource Check:** Run `docker stats` on the host to monitor RAM and CPU consumption. If any container approaches its memory ceiling, the 4 GB Linux swap file will prevent out-of-memory crashes.

