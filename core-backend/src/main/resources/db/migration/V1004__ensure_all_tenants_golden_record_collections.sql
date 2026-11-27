-- =====================================================================
-- LuminAI — V1004: Ensure All Tenant Schemas Have GoldenRecord Tables
-- =====================================================================
-- Guarantees that every existing tenant_* schema (and tenant_template)
-- contains golden_records (with version), golden_records_source_ids, and
-- golden_records_provenance so Explorer queries and @ElementCollection
-- joins never fail or fall back to public.golden_records.
-- =====================================================================

DO $$
DECLARE
    schema_rec RECORD;
BEGIN
    -- Ensure template schema has the collection tables and version column first
    CREATE TABLE IF NOT EXISTS tenant_template.golden_records_source_ids (
        golden_record_id  UUID NOT NULL REFERENCES tenant_template.golden_records(id) ON DELETE CASCADE,
        source_record_id  UUID NOT NULL,
        PRIMARY KEY (golden_record_id, source_record_id)
    );

    CREATE TABLE IF NOT EXISTS tenant_template.golden_records_provenance (
        golden_record_id  UUID NOT NULL REFERENCES tenant_template.golden_records(id) ON DELETE CASCADE,
        source_record_id  UUID,
        field_name        VARCHAR(255),
        candidate_id      UUID,
        occurred_at       TIMESTAMPTZ,
        action            VARCHAR(255)
    );

    CREATE INDEX IF NOT EXISTS idx_gr_provenance_golden
        ON tenant_template.golden_records_provenance(golden_record_id);

    ALTER TABLE IF EXISTS tenant_template.golden_records
        ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;

    FOR schema_rec IN
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name LIKE 'tenant\_%' ESCAPE '\'
          AND schema_name <> 'tenant_template'
    LOOP
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I.golden_records (LIKE tenant_template.golden_records INCLUDING ALL);',
            schema_rec.schema_name
        );

        EXECUTE format(
            'ALTER TABLE IF EXISTS %I.golden_records ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;',
            schema_rec.schema_name
        );

        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I.golden_records_source_ids (
                golden_record_id  UUID NOT NULL REFERENCES %I.golden_records(id) ON DELETE CASCADE,
                source_record_id  UUID NOT NULL,
                PRIMARY KEY (golden_record_id, source_record_id)
            );',
            schema_rec.schema_name,
            schema_rec.schema_name
        );

        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I.golden_records_provenance (
                golden_record_id  UUID NOT NULL REFERENCES %I.golden_records(id) ON DELETE CASCADE,
                source_record_id  UUID,
                field_name        VARCHAR(255),
                candidate_id      UUID,
                occurred_at       TIMESTAMPTZ,
                action            VARCHAR(255)
            );',
            schema_rec.schema_name,
            schema_rec.schema_name
        );

        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS idx_gr_provenance_golden ON %I.golden_records_provenance(golden_record_id);',
            schema_rec.schema_name
        );
    END LOOP;
END $$;
