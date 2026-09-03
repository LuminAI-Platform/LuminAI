-- =====================================================================
-- LuminAI — V7: Clone V5 Pipeline/ER Tables into tenant_default
-- =====================================================================
-- V5 added cleaning_rules, pipeline_runs, golden_records, er_candidates,
-- and provenance to tenant_template but forgot to clone them into
-- tenant_default. This migration fixes that gap.
--
-- Also creates the Hibernate @ElementCollection tables for GoldenRecord:
--   - golden_records_source_ids
--   - golden_records_provenance
--
-- And creates the Hibernate @ElementCollection tables for ErCandidate
-- (er_candidates is already a standalone table from V5).
-- =====================================================================

SET search_path TO tenant_default;

-- ── Clone V5 tables from tenant_template ────────────────────────────

CREATE TABLE IF NOT EXISTS cleaning_rules   (LIKE tenant_template.cleaning_rules   INCLUDING ALL);
CREATE TABLE IF NOT EXISTS pipeline_runs    (LIKE tenant_template.pipeline_runs    INCLUDING ALL);
CREATE TABLE IF NOT EXISTS golden_records   (LIKE tenant_template.golden_records   INCLUDING ALL);
CREATE TABLE IF NOT EXISTS er_candidates    (LIKE tenant_template.er_candidates    INCLUDING ALL);
CREATE TABLE IF NOT EXISTS provenance       (LIKE tenant_template.provenance       INCLUDING ALL);

-- ── Re-add cross-table FKs (LIKE INCLUDING ALL does not copy these) ─

ALTER TABLE cleaning_rules
    ADD CONSTRAINT fk_cleaning_rules_connector
    FOREIGN KEY (connection_id) REFERENCES tenant_default.connectors(id) ON DELETE CASCADE;

ALTER TABLE pipeline_runs
    ADD CONSTRAINT fk_pipeline_runs_connector
    FOREIGN KEY (connection_id) REFERENCES tenant_default.connectors(id) ON DELETE CASCADE;

ALTER TABLE er_candidates
    ADD CONSTRAINT fk_er_candidates_pipeline_run
    FOREIGN KEY (pipeline_run_id) REFERENCES tenant_default.pipeline_runs(id) ON DELETE CASCADE;

ALTER TABLE er_candidates
    ADD CONSTRAINT fk_er_candidates_golden_record
    FOREIGN KEY (golden_record_id) REFERENCES tenant_default.golden_records(id) ON DELETE SET NULL;

ALTER TABLE provenance
    ADD CONSTRAINT fk_provenance_golden_record
    FOREIGN KEY (golden_record_id) REFERENCES tenant_default.golden_records(id) ON DELETE CASCADE;

ALTER TABLE provenance
    ADD CONSTRAINT fk_provenance_source_connection
    FOREIGN KEY (source_connection_id) REFERENCES tenant_default.connectors(id) ON DELETE CASCADE;

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

-- ── Hibernate @ElementCollection tables for GoldenRecord ────────────
-- GoldenRecord.sourceRecordIds → golden_records_source_ids
-- GoldenRecord.provenance      → golden_records_provenance

CREATE TABLE IF NOT EXISTS golden_records_source_ids (
    golden_record_id  UUID NOT NULL REFERENCES tenant_default.golden_records(id) ON DELETE CASCADE,
    source_record_id  UUID NOT NULL,
    PRIMARY KEY (golden_record_id, source_record_id)
);

CREATE TABLE IF NOT EXISTS golden_records_provenance (
    golden_record_id  UUID NOT NULL REFERENCES tenant_default.golden_records(id) ON DELETE CASCADE,
    source_record_id  UUID,
    field_name        VARCHAR(255),
    candidate_id      UUID,
    occurred_at       TIMESTAMPTZ,
    action            VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_gr_provenance_golden
    ON golden_records_provenance(golden_record_id);

-- ── Also create @ElementCollection tables in tenant_template ────────
-- (so future tenant provisioning via LIKE INCLUDING ALL will carry them)

SET search_path TO tenant_template;

ALTER TABLE golden_records ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE er_candidates ADD COLUMN IF NOT EXISTS record_a_snapshot TEXT;
ALTER TABLE er_candidates ADD COLUMN IF NOT EXISTS record_b_snapshot TEXT;
ALTER TABLE er_candidates ADD COLUMN IF NOT EXISTS match_rationale VARCHAR(2000) DEFAULT '';
ALTER TABLE er_candidates ADD COLUMN IF NOT EXISTS comparison_details TEXT;
ALTER TABLE er_candidates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE er_candidates ALTER COLUMN pipeline_run_id DROP NOT NULL;
ALTER TABLE er_candidates ALTER COLUMN match_method DROP NOT NULL;

CREATE TABLE IF NOT EXISTS golden_records_source_ids (
    golden_record_id  UUID NOT NULL REFERENCES tenant_template.golden_records(id) ON DELETE CASCADE,
    source_record_id  UUID NOT NULL,
    PRIMARY KEY (golden_record_id, source_record_id)
);

CREATE TABLE IF NOT EXISTS golden_records_provenance (
    golden_record_id  UUID NOT NULL REFERENCES tenant_template.golden_records(id) ON DELETE CASCADE,
    source_record_id  UUID,
    field_name        VARCHAR(255),
    candidate_id      UUID,
    occurred_at       TIMESTAMPTZ,
    action            VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_gr_provenance_golden
    ON golden_records_provenance(golden_record_id);

-- Reset search path
RESET search_path;
