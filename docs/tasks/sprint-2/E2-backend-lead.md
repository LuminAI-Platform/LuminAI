## Sprint 2 — Pipeline + Entity Resolution

- **Role:** Backend Lead
- **Primary Focus:** Manual Merge Review REST API (pending merge candidates, accept/reject/split operations), entity resolution resolution endpoints, and integration with Postgres storage.
- **Working Directory:** `core-backend/`
- **Language:** Java 21 + Spring Boot 3.5
- **Total Load:** 10 SP (2 tasks)

---

## 🚫 Dev Rules & Restrictions
* **DO NOT** modify `data-engine/` or `frontend/` code.
* **DO NOT** push directly to `main`. Always push to a feature branch and open a PR.
* Validate all inputs using Jakarta `@Valid` annotations.
* Enforce schema-level tenant isolation on every database query.

---

## 📋 Assigned Tasks

---

### TASK S2-14: Manual Merge Review API (5 pts)
* **Goal:** Create REST endpoints for reviewing proposed entity resolution matches. Analysts use these endpoints to inspect candidate pairs flagged by the ER engine and explicitly accept (merge), reject (false positive), or split them.
* **Branch:** `feature/S2-14-manual-review-api`
* **Target Files:**
  * `src/main/java/com/luminai/connection/model/ErCandidate.java`
  * `src/main/java/com/luminai/connection/model/GoldenRecord.java`
  * `src/main/java/com/luminai/connection/dto/MergeReviewDto.java`
  * `src/main/java/com/luminai/connection/MergeReviewController.java`
  * `src/main/java/com/luminai/connection/MergeReviewService.java`
  * `src/main/java/com/luminai/connection/ErCandidateRepository.java`
  * `src/main/java/com/luminai/connection/GoldenRecordRepository.java`

#### Requirements

1. **REST Endpoints:**
   | Method | Path | Description |
   |---|---|---|
   | `GET` | `/api/v1/er/candidates` | List pending entity resolution candidates (supports status filter: `PENDING`, `ACCEPTED`, `REJECTED`) with pagination |
   | `GET` | `/api/v1/er/candidates/{id}` | Get detailed comparison between record A and record B (properties, similarity score, match rationale) |
   | `POST` | `/api/v1/er/candidates/{id}/accept` | Accept candidate match — triggers Golden Record merge / property update |
   | `POST` | `/api/v1/er/candidates/{id}/reject` | Reject candidate match — marks candidate as false positive |
   | `POST` | `/api/v1/er/golden-records/{id}/split` | Split a golden record back into separate distinct entities |

2. **Business Logic:**
   * **Accept Match (`/accept`):** Updates candidate status to `ACCEPTED`. Merges non-conflicting properties from Record B into Record A's Golden Record. Updates provenance records. Publishes `entity.updated` Kafka event.
   * **Reject Match (`/reject`):** Updates candidate status to `REJECTED`. Preserves candidates so the ER engine does not re-suggest the same match on future pipeline runs.
   * **Split Golden Record (`/split`):** Extracts a record from a golden cluster, creating a new standalone golden record.

3. **Tenant Security:**
   * Filter all candidate and golden record queries by the active `TenantContext`.

#### Acceptance Criteria
- [ ] Candidate list endpoint supports filtering by status (`PENDING`) and pagination (`page`, `size`).
- [ ] Accepting a candidate match updates its status to `ACCEPTED` and updates the golden record.
- [ ] Rejecting a candidate match marks it `REJECTED`.
- [ ] Swagger UI lists all 5 endpoints with sample payloads.
- [ ] `./gradlew spotlessCheck build -x test` passes cleanly.

---

### TASK S2-19: Pipeline Status & Monitoring API (5 pts)
* **Goal:** Build REST endpoints for querying active pipeline runs, execution history, records processed/failed metrics, and status logs.
* **Branch:** `feature/S2-19-pipeline-status-api`
* **Target Files:**
  * `src/main/java/com/luminai/connection/model/PipelineRun.java`
  * `src/main/java/com/luminai/connection/dto/PipelineRunDto.java`
  * `src/main/java/com/luminai/connection/PipelineMonitoringController.java`
  * `src/main/java/com/luminai/connection/PipelineMonitoringService.java`
  * `src/main/java/com/luminai/connection/PipelineRunRepository.java`

#### Requirements

1. **REST Endpoints:**
   | Method | Path | Description |
   |---|---|---|
   | `GET` | `/api/v1/pipelines/runs` | List recent pipeline execution runs across connectors |
   | `GET` | `/api/v1/pipelines/runs/{id}` | Get detailed metrics for a specific pipeline run |
   | `GET` | `/api/v1/pipelines/metrics` | Summary metrics: total records cleaned, total entities resolved, active jobs count |

#### Acceptance Criteria
- [ ] Endpoints return active and completed pipeline runs sorted by start time.
- [ ] Summary metrics endpoint aggregates total cleaned records and total resolved entities.
- [ ] Tenant boundaries are strictly enforced.
