-- LuminAI — V6: Dynamic Ontology Management & Versioning Tables
SET search_path TO tenant_template;

-- 1. Enhance entity_types in tenant_template
ALTER TABLE entity_types ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE entity_types ADD COLUMN IF NOT EXISTS label VARCHAR(100);
ALTER TABLE entity_types ADD COLUMN IF NOT EXISTS color VARCHAR(30) DEFAULT '#3b82f6';
ALTER TABLE entity_types ADD COLUMN IF NOT EXISTS icon VARCHAR(50) DEFAULT 'package';
ALTER TABLE entity_types ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE entity_types ALTER COLUMN ontology_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_entity_types_tenant ON entity_types(tenant_id);
CREATE INDEX IF NOT EXISTS idx_entity_types_name ON entity_types(name);

-- 2. Create relationship_types in tenant_template
CREATE TABLE IF NOT EXISTS relationship_types (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID         NOT NULL,
    ontology_id           UUID         REFERENCES ontology_versions(id) ON DELETE SET NULL,
    name                  VARCHAR(100) NOT NULL,
    description           TEXT,
    source_entity_type_id UUID         NOT NULL REFERENCES entity_types(id) ON DELETE CASCADE,
    target_entity_type_id UUID         NOT NULL REFERENCES entity_types(id) ON DELETE CASCADE,
    cardinality           VARCHAR(30)  NOT NULL DEFAULT 'MANY_TO_MANY',
    properties_schema     JSONB        NOT NULL DEFAULT '{}',
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rel_types_tenant ON relationship_types(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rel_types_name ON relationship_types(name);
CREATE INDEX IF NOT EXISTS idx_rel_types_source ON relationship_types(source_entity_type_id);
CREATE INDEX IF NOT EXISTS idx_rel_types_target ON relationship_types(target_entity_type_id);

-- 3. Enhance ontology_versions in tenant_template
ALTER TABLE ontology_versions ADD COLUMN IF NOT EXISTS schema_snapshot JSONB DEFAULT '{}';
ALTER TABLE ontology_versions ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- 4. Apply changes to tenant_default
SET search_path TO tenant_default;

ALTER TABLE entity_types ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE entity_types ADD COLUMN IF NOT EXISTS label VARCHAR(100);
ALTER TABLE entity_types ADD COLUMN IF NOT EXISTS color VARCHAR(30) DEFAULT '#3b82f6';
ALTER TABLE entity_types ADD COLUMN IF NOT EXISTS icon VARCHAR(50) DEFAULT 'package';
ALTER TABLE entity_types ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE entity_types ALTER COLUMN ontology_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS relationship_types (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID         NOT NULL,
    ontology_id           UUID         REFERENCES ontology_versions(id) ON DELETE SET NULL,
    name                  VARCHAR(100) NOT NULL,
    description           TEXT,
    source_entity_type_id UUID         NOT NULL REFERENCES entity_types(id) ON DELETE CASCADE,
    target_entity_type_id UUID         NOT NULL REFERENCES entity_types(id) ON DELETE CASCADE,
    cardinality           VARCHAR(30)  NOT NULL DEFAULT 'MANY_TO_MANY',
    properties_schema     JSONB        NOT NULL DEFAULT '{}',
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE ontology_versions ADD COLUMN IF NOT EXISTS schema_snapshot JSONB DEFAULT '{}';
ALTER TABLE ontology_versions ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Reset search path
RESET search_path;
