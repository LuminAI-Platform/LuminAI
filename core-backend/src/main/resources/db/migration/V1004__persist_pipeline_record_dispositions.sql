DO $$
DECLARE
    schema_rec RECORD;
BEGIN
    FOR schema_rec IN
        SELECT schemaname
        FROM pg_tables
        WHERE tablename = 'pipeline_runs'
          AND schemaname NOT IN ('pg_catalog', 'information_schema')
    LOOP
        EXECUTE format(
            'ALTER TABLE %I.pipeline_runs ADD COLUMN IF NOT EXISTS records_quarantined BIGINT NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS records_rejected BIGINT NOT NULL DEFAULT 0',
            schema_rec.schemaname
        );
    END LOOP;
END $$;
