## Sprint 3 — Ontology + Graph + Explorer

- **Role:** DevOps Engineer
- **Primary Focus:** Helm charts for Kubernetes services and ArgoCD GitOps deployment pipeline setup.
- **Working Directory:** `infra/`
- **Total Load:** 5 SP (1 task)

---

## 📋 Assigned Tasks

---

### TASK S3-15: Helm Charts & ArgoCD Setup (5 pts)
* **Goal:** Author modular Helm chart templates for `core-backend`, `data-engine`, and `keycloak`, and configure ArgoCD application manifests for automated Kubernetes deployments.
* **Branch:** `feature/S3-15-helm-argocd-setup`
* **Target Files:**
  * `infra/helm/luminai-platform/Chart.yaml`
  * `infra/helm/luminai-platform/values.yaml`
  * `infra/helm/luminai-platform/templates/`
  * `infra/argocd/application.yaml`

#### Acceptance Criteria
- [ ] `helm template` dry run completes without errors.
- [ ] ArgoCD application manifest validates cleanly.
