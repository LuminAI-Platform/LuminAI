-- =====================================================================
-- LuminAI — V8: Golden Record Version & Candidate Compatibility Columns
-- =====================================================================
-- Hibernate entity compatibility columns:
-- - GoldenRecord @Version column
-- - ErCandidate JPA entity fields (snapshots, rationale, comparison)
-- Applied to both tenant_default and tenant_template.
-- =====================================================================

SET search_path TO tenant_default;

-- ── Hibernate entity compatibility columns ──────────────────────────
-- GoldenRecord @Version column
ALTER TABLE golden_records ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;

-- ErCandidate JPA entity fields (snapshots, rationale, comparison)
ALTER TABLE er_candidates ADD COLUMN IF NOT EXISTS record_a_snapshot TEXT;
ALTER TABLE er_candidates ADD COLUMN IF NOT EXISTS record_b_snapshot TEXT;
ALTER TABLE er_candidates ADD COLUMN IF NOT EXISTS match_rationale VARCHAR(2000) DEFAULT '';
ALTER TABLE er_candidates ADD COLUMN IF NOT EXISTS comparison_details TEXT;
ALTER TABLE er_candidates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE er_candidates ALTER COLUMN pipeline_run_id DROP NOT NULL;
ALTER TABLE er_candidates ALTER COLUMN match_method DROP NOT NULL;

-- ── Also apply to tenant_template for future provisioned tenants ────

SET search_path TO tenant_template;

ALTER TABLE golden_records ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE er_candidates ADD COLUMN IF NOT EXISTS record_a_snapshot TEXT;
ALTER TABLE er_candidates ADD COLUMN IF NOT EXISTS record_b_snapshot TEXT;
ALTER TABLE er_candidates ADD COLUMN IF NOT EXISTS match_rationale VARCHAR(2000) DEFAULT '';
ALTER TABLE er_candidates ADD COLUMN IF NOT EXISTS comparison_details TEXT;
ALTER TABLE er_candidates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE er_candidates ALTER COLUMN pipeline_run_id DROP NOT NULL;
ALTER TABLE er_candidates ALTER COLUMN match_method DROP NOT NULL;

-- Reset search path
RESET search_path;
