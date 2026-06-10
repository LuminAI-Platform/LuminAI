-- =====================================================================
-- LuminAI — V2: Tenant Template Schema
-- =====================================================================
-- This schema is created ONCE in a "template_tenant" schema.
-- When a new tenant is provisioned, this template is cloned to
-- tenant_{slug} (e.g., tenant_acme) via pg_dump / pg_restore.
--
-- Source: docs/03-data-model.md Section 8 (Relational Schema — Key Tables)
-- =====================================================================

-- Create the template schema namespace
CREATE SCHEMA IF NOT EXISTS tenant_template;

-- Set search path for this migration block
SET search_path TO tenant_template;

-- ------------------------------------------------------------------
-- Ontology metadata
-- Tracks versioned ontology schemas per tenant.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ontology_versions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version     VARCHAR(20) NOT NULL,
    tenant_id   UUID NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'draft',   -- draft | published | deprecated
    changelog   TEXT,
    created_by  UUID,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------
-- Entity type definitions
-- Stores the JSON Schema for each entity type (Person, Org, etc.)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS entity_types (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ontology_id       UUID NOT NULL REFERENCES ontology_versions(id) ON DELETE CASCADE,
    name              VARCHAR(100) NOT NULL,
    description       TEXT,
    properties_schema JSONB NOT NULL,   -- JSON Schema for property validation
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_types_ontology ON entity_types(ontology_id);

-- ------------------------------------------------------------------
-- Entity instances (golden records + source records)
-- The core table for all data. is_golden=true = merged golden record.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS entities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    entity_type     VARCHAR(100) NOT NULL,
    schema_version  INTEGER NOT NULL DEFAULT 1,
    is_golden       BOOLEAN NOT NULL DEFAULT false,
    properties      JSONB NOT NULL,
    source_refs     JSONB,              -- provenance links to source records
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entities_tenant ON entities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_entities_props ON entities USING GIN (properties);
CREATE INDEX IF NOT EXISTS idx_entities_golden ON entities(is_golden) WHERE is_golden = true;

-- ------------------------------------------------------------------
-- Relationship instances
-- Directional typed edges between entity instances.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS relationships (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL,
    relationship_type     VARCHAR(100) NOT NULL,
    source_entity_id      UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    target_entity_id      UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    properties            JSONB,
    confidence            FLOAT NOT NULL DEFAULT 1.0,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_relationships_tenant ON relationships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_entity_id);
CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(relationship_type);

-- ------------------------------------------------------------------
-- Source records (immutable raw ingested data)
-- Original records are NEVER modified after ingestion.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS source_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    source_name     VARCHAR(255) NOT NULL,    -- e.g. "hr_db", "kyc_api"
    entity_type     VARCHAR(100) NOT NULL,
    raw_data        JSONB NOT NULL,
    ingested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    golden_id       UUID REFERENCES entities(id)   -- null until resolved
);

CREATE INDEX IF NOT EXISTS idx_source_records_tenant ON source_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_source_records_golden ON source_records(golden_id);

-- ------------------------------------------------------------------
-- Audit log (per-tenant)
-- Records all user actions for compliance and forensic traceability.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    user_id         UUID NOT NULL,
    action          VARCHAR(100) NOT NULL,   -- e.g. CREATE_ENTITY, MERGE_ENTITIES
    resource_type   VARCHAR(100),
    resource_id     UUID,
    changes         JSONB,
    ip_address      VARCHAR(45),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log(resource_type, resource_id);

-- Reset search path
RESET search_path;
