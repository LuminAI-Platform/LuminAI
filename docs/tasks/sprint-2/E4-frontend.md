## Sprint 2 — Pipeline + Entity Resolution

- **Role:** Frontend Developer
- **Primary Focus:** Pipeline Monitoring Dashboard, Entity Merge Review UI (side-by-side golden record comparison, confidence scores, accept/reject actions), and real-time SSE progress integration.
- **Working Directory:** `frontend/`
- **Language:** TypeScript 5 + React 19 + Vite + Tailwind CSS v4
- **Total Load:** 13 SP (2 major features)

---

## 🚫 Dev Rules & Restrictions
* **DO NOT** modify `core-backend/` or `data-engine/` code.
* Style exclusively using Tailwind CSS v4 and Radix UI primitives.
* Ensure all network calls use `apiFetch` (JWT injected automatically).

---

## 📋 Assigned Tasks

---

### TASK S1-15 (S2-15): Pipeline Monitoring UI (5 pts)
* **Goal:** Build the Pipeline Monitoring view displaying active cleaning jobs, status indicators, progress bars, record processing throughput (records/sec), and error logs.
* **Branch:** `feature/S2-15-pipeline-monitoring-ui`
* **Target Files:**
  * `src/features/connections/components/PipelineMonitor.tsx`
  * `src/features/connections/components/PipelineJobCard.tsx`
  * `src/pages/connections/PipelinePage.tsx`

#### Requirements

1. **Dashboard Widgets:**
   * **Active Pipeline Status Card:** Displays running pipelines, active record count, throughput speed gauge.
   * **Job Progress List:** Table of historical and active pipeline runs showing connector name, status badge (`RUNNING`, `CLEANED`, `COMPLETED`, `FAILED`), progress bar (0-100%), records input/output/failed, start time, and duration.
   * **Real-time Updates:** Connect to `/api/v1/pipelines/stream` (SSE) or poll every 3 seconds to update progress bars dynamically.

2. **User Actions:**
   * Filter by status (`ALL`, `RUNNING`, `COMPLETED`, `FAILED`).
   * Click job row to expand error log accordion.

#### Acceptance Criteria
- [ ] Pipeline progress bar animates as job runs.
- [ ] Status badges correctly reflect pipeline state (`RUNNING` blue, `COMPLETED` green, `FAILED` red).
- [ ] Error accordion opens smoothly showing detailed error message.
- [ ] `npm run format:check` and `npm run build` pass without warnings.

---

### TASK S1-16 (S2-16): Entity Merge Review UI (8 pts)
* **Goal:** Build the Entity Resolution Merge Review screen allowing data analysts to inspect candidate duplicate record pairs side-by-side, view match confidence scores, review field provenance, and execute Accept (Merge), Reject (False Positive), or Split actions.
* **Branch:** `feature/S2-16-entity-merge-review-ui`
* **Target Files:**
  * `src/features/er/components/MergeReviewList.tsx`
  * `src/features/er/components/SideBySideComparison.tsx`
  * `src/features/er/components/ConfidenceScoreBadge.tsx`
  * `src/pages/er/MergeReviewPage.tsx`

#### Requirements

1. **Candidate List View:**
   * Displays pending candidate pairs (`GET /api/v1/er/candidates?status=PENDING`).
   * Shows Record A name vs Record B name, entity type, matching strategy (e.g. *Phonetic Jaro-Winkler*), and Confidence Score percentage badge (e.g. `94.5%` Green, `78.2%` Yellow).

2. **Side-by-Side Comparison Panel:**
   * Displays property-by-property comparison table:
     - Left Column: **Record A Properties** (Source: Postgres DB)
     - Middle Column: **Property Name** (e.g., `Full Name`, `Date of Birth`, `Email`, `Tax ID`)
     - Right Column: **Record B Properties** (Source: CSV Upload)
   * Highlight matching fields in subtle green tint; highlight conflicting fields in subtle amber tint.

3. **Decision Controls:**
   * **Accept Merge Button:** Calls `POST /api/v1/er/candidates/{id}/accept`, removes candidate from list, shows success toast.
   * **Reject Match Button:** Calls `POST /api/v1/er/candidates/{id}/reject`, marks as false positive.
   * **Split Golden Record Button:** Calls `POST /api/v1/er/golden-records/{id}/split`.

#### Acceptance Criteria
- [ ] Candidate pairs load from `GET /api/v1/er/candidates`.
- [ ] Side-by-side comparison table highlights matching vs conflicting fields.
- [ ] Clicking Accept sends `POST /accept` and updates UI state instantly.
- [ ] Clicking Reject sends `POST /reject` and removes candidate from pending list.
- [ ] `npm run format:check` and `npm run build` pass cleanly.
