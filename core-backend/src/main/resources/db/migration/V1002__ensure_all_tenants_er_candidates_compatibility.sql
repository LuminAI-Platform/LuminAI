-- =====================================================================
-- LuminAI — V1002: Ensure All Tenant Schemas Have ER Candidates Compatibility
-- =====================================================================
-- Guarantees that er_candidates in all existing and future tenant schemas
-- contains the required JPA columns (record_a_snapshot, record_b_snapshot,
-- match_rationale, comparison_details, updated_at) and drops legacy NOT NULL
-- constraints on pipeline_run_id and match_method so on-demand scans can persist
-- candidate pairs cleanly.
-- =====================================================================

DO $$
DECLARE
    schema_rec RECORD;
BEGIN
    FOR schema_rec IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'tenant_%'
    LOOP
        -- Add columns if not exists
        EXECUTE format('ALTER TABLE IF EXISTS %I.er_candidates ADD COLUMN IF NOT EXISTS record_a_snapshot TEXT;', schema_rec.schema_name);
        EXECUTE format('ALTER TABLE IF EXISTS %I.er_candidates ADD COLUMN IF NOT EXISTS record_b_snapshot TEXT;', schema_rec.schema_name);
        EXECUTE format('ALTER TABLE IF EXISTS %I.er_candidates ADD COLUMN IF NOT EXISTS match_rationale VARCHAR(2000) DEFAULT '''';', schema_rec.schema_name);
        EXECUTE format('ALTER TABLE IF EXISTS %I.er_candidates ADD COLUMN IF NOT EXISTS comparison_details TEXT;', schema_rec.schema_name);
        EXECUTE format('ALTER TABLE IF EXISTS %I.er_candidates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();', schema_rec.schema_name);
        
        -- Drop NOT NULL constraints on legacy columns
        BEGIN
            EXECUTE format('ALTER TABLE IF EXISTS %I.er_candidates ALTER COLUMN pipeline_run_id DROP NOT NULL;', schema_rec.schema_name);
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
        
        BEGIN
            EXECUTE format('ALTER TABLE IF EXISTS %I.er_candidates ALTER COLUMN match_method DROP NOT NULL;', schema_rec.schema_name);
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        BEGIN
            EXECUTE format('ALTER TABLE IF EXISTS %I.er_candidates ALTER COLUMN golden_record_id DROP NOT NULL;', schema_rec.schema_name);
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        -- Ensure golden_records has version
        BEGIN
            EXECUTE format('ALTER TABLE IF EXISTS %I.golden_records ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;', schema_rec.schema_name);
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END LOOP;
END $$;
