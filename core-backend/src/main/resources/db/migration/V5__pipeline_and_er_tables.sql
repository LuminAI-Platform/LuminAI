-- LuminAI — V5: Pipeline, Cleaning Rules & Entity Resolution Tables
SET search_path TO tenant_template;

-- Cleaning rules
-- Per-connector configurable data transformation rules consumed by the
-- Data Engine cleaning pipeline (Polars) during ingestion.
CREATE TABLE IF NOT EXISTS cleaning_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID         NOT NULL,
    connection_id   UUID         NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
    column_name     VARCHAR(255) NOT NULL,
    rule_type       VARCHAR(50)  NOT NULL,
    rule_config     JSONB        NOT NULL DEFAULT '{}',
    priority        INT          NOT NULL DEFAULT 0,
    enabled         BOOLEAN      NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cleaning_rules_connection ON cleaning_rules(connection_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_rules_tenant     ON cleaning_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_rules_enabled    ON cleaning_rules(enabled) WHERE enabled = true;

-- Pipeline runs
-- Tracks individual pipeline execution runs (cleaning, normalisation,
-- entity resolution) including progress counters and error diagnostics.
CREATE TABLE IF NOT EXISTS pipeline_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID         NOT NULL,
    connection_id   UUID         NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
    pipeline_type   VARCHAR(50)  NOT NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    records_input   BIGINT       NOT NULL DEFAULT 0,
    records_output  BIGINT       NOT NULL DEFAULT 0,
    records_failed  BIGINT       NOT NULL DEFAULT 0,
    error_message   TEXT,
    metadata        JSONB        NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_tenant     ON pipeline_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_connection ON pipeline_runs(connection_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status     ON pipeline_runs(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_type       ON pipeline_runs(pipeline_type);

-- Golden records
-- Unified, deduplicated entity records produced by the Entity
-- Resolution engine after clustering and merging duplicate records.
CREATE TABLE IF NOT EXISTS golden_records (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID         NOT NULL,
    entity_type      VARCHAR(100) NOT NULL,
    canonical_name   VARCHAR(500) NOT NULL,
    properties       JSONB        NOT NULL DEFAULT '{}',
    confidence_score DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
    source_count     INT          NOT NULL DEFAULT 1,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_golden_records_tenant     ON golden_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_golden_records_type       ON golden_records(entity_type);
CREATE INDEX IF NOT EXISTS idx_golden_records_name       ON golden_records(canonical_name);

-- Entity resolution candidates
-- Candidate duplicate record pairs flagged by the ER engine for
-- automatic merging or manual analyst review based on similarity score.
CREATE TABLE IF NOT EXISTS er_candidates (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID         NOT NULL,
    pipeline_run_id  UUID         NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
    record_a_id      UUID         NOT NULL,
    record_b_id      UUID         NOT NULL,
    similarity_score DECIMAL(5,4) NOT NULL DEFAULT 0.0000, 
    match_method     VARCHAR(100) NOT NULL,
    status           VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    golden_record_id UUID         REFERENCES golden_records(id) ON DELETE SET NULL,
    reviewed_by      UUID,
    reviewed_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_er_candidates_tenant       ON er_candidates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_er_candidates_pipeline_run ON er_candidates(pipeline_run_id);
CREATE INDEX IF NOT EXISTS idx_er_candidates_status       ON er_candidates(status);
CREATE INDEX IF NOT EXISTS idx_er_candidates_golden       ON er_candidates(golden_record_id);

-- Provenance tracking
-- Records which raw source dataset and connector contributed each
-- property on a Golden Record, enabling full data lineage.
CREATE TABLE IF NOT EXISTS provenance (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID         NOT NULL,
    golden_record_id     UUID         NOT NULL REFERENCES golden_records(id) ON DELETE CASCADE,
    property_name        VARCHAR(255) NOT NULL,
    source_connection_id UUID         NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
    source_record_id     UUID         NOT NULL,
    contributed_value    TEXT,
    contributed_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provenance_tenant  ON provenance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_provenance_golden  ON provenance(golden_record_id);
CREATE INDEX IF NOT EXISTS idx_provenance_source  ON provenance(source_connection_id);

-- Reset search path
RESET search_path;
