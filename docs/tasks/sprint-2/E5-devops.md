## Sprint 2 — Pipeline + Entity Resolution

- **Role:** DevOps Engineer
- **Primary Focus:** Staging environment setup on Render/AWS, Aiven Kafka topic configuration, and CI/CD enhancements.
- **Working Directory:** `infra/`
- **Total Load:** 8 SP (1 task)

---

## 🚫 Dev Rules & Restrictions
* **DO NOT** commit secrets or private keys to git repositories.
* Use environment variables for all cloud platform endpoint URLs.

---

## 📋 Assigned Tasks

---

### TASK S2-18: Staging Environment Infrastructure Setup (8 pts)
* **Goal:** Provision and configure the staging environment resources on cloud services (Render, Vercel, Neon PG, Aiven Kafka, Upstash Redis, Cloudflare R2).
* **Branch:** `feature/S2-18-staging-infra`
* **Target Files:**
  * `infra/terraform/` *(Terraform manifests)*
  * `docs/tasks/devops_sprint2_deploy.md` *(Deployment Guide)*

#### Requirements
1. Configure Render environment variables for `luminai-api` and `luminai-data` services.
2. Verify SSL/TLS connections to Neon PG (`sslmode=require`), Aiven Kafka (`SASL_SSL`), and Upstash Redis (`rediss://`).
3. Document deployment instructions in `docs/tasks/devops_sprint2_deploy.md`.

#### Acceptance Criteria
- [ ] Staging services deployed and health checks returning `200 OK`.
- [ ] Cross-service communication (Frontend -> Backend -> Data Engine -> Kafka/Redis/PG/R2) verified.
