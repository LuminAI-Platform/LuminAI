-- =====================================================================
-- LuminAI — V3: Connectors, Sync Jobs & Schema Mappings
-- =====================================================================
-- Sprint 1 migration adding data-connection infrastructure tables
-- to the tenant template schema.
--
-- Source: jira_board_tasks_sprint1.md — Task S1-09
-- =====================================================================

SET search_path TO tenant_template;

-- ------------------------------------------------------------------
-- Connector registry
-- Stores metadata for each configured data source (file, database,
-- API) along with a reference to encrypted credentials in the vault.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS connectors (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    name            VARCHAR(255) NOT NULL,
    type            VARCHAR(50)  NOT NULL,          -- FILE, POSTGRESQL, MYSQL, MSSQL, API
    config          JSONB        NOT NULL DEFAULT '{}',  -- host, port, database, options
    credentials_ref VARCHAR(255),                   -- vault secret reference (never plaintext)
    status          VARCHAR(20)  NOT NULL DEFAULT 'active',  -- active, inactive, error
    last_sync_at    TIMESTAMPTZ,
    created_by      UUID,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_connectors_tenant   ON connectors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_connectors_type     ON connectors(type);
CREATE INDEX IF NOT EXISTS idx_connectors_status   ON connectors(status);

-- ------------------------------------------------------------------
-- Synchronisation jobs
-- Tracks individual sync runs for each connector, including progress
-- counters and error diagnostics.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID         NOT NULL,
    connector_id    UUID         NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING',  -- PENDING, RUNNING, COMPLETED, FAILED
    rows_processed  BIGINT       NOT NULL DEFAULT 0,
    rows_failed     BIGINT       NOT NULL DEFAULT 0,
    error_message   TEXT,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_tenant    ON sync_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_connector ON sync_jobs(connector_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status    ON sync_jobs(status);

-- ------------------------------------------------------------------
-- Schema mappings
-- Maps raw source dataset columns to target ontology properties,
-- enabling configurable data transformation during ingestion.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_mappings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID         NOT NULL,
    connector_id        UUID         NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    source_column       VARCHAR(255) NOT NULL,
    target_entity_type  VARCHAR(100) NOT NULL,
    target_property     VARCHAR(100) NOT NULL,
    transformation      VARCHAR(50)  NOT NULL DEFAULT 'NONE',  -- NONE, UPPERCASE, LOWERCASE, TRIM, DATE_PARSE
    is_active           BOOLEAN      NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schema_mappings_tenant    ON schema_mappings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_schema_mappings_connector ON schema_mappings(connector_id);
CREATE INDEX IF NOT EXISTS idx_schema_mappings_active    ON schema_mappings(is_active) WHERE is_active = true;

-- Reset search path
RESET search_path;
