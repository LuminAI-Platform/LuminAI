-- =====================================================================
-- LuminAI — V1006: Cleanup Legacy Synthetic Golden & Staging Records
-- =====================================================================
-- Older synthetic ER fallback rows persisted into golden_records may not
-- have properties->'_source_record_ids' populated, and synthetic test rows
-- may also reside in staging_records. Clean them across public and all
-- tenant_* schemas whenever no real _connection_id exists.
-- =====================================================================

DO $$
DECLARE
    schema_rec   RECORD;
    has_gr_props BOOLEAN;
    has_staging  BOOLEAN;
BEGIN
    FOR schema_rec IN
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name = 'public'
           OR (schema_name LIKE 'tenant\_%' ESCAPE '\' AND schema_name <> 'tenant_template')
    LOOP
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = schema_rec.schema_name
              AND table_name = 'golden_records'
              AND column_name = 'properties'
        ) INTO has_gr_props;

        IF has_gr_props THEN
            EXECUTE format(
                'DELETE FROM %I.golden_records
                 WHERE NOT (COALESCE(properties, ''{}''::jsonb) ? ''_connection_id'')
                   AND (
                       COALESCE(properties->''_source_record_ids'', ''[]''::jsonb) ?| ARRAY[
                           ''rec-001'', ''rec-002'', ''rec-003'', ''rec-004'', ''rec-005'',
                           ''rec-006'', ''rec-007'', ''rec-008'', ''rec-009'', ''rec-010''
                       ]
                       OR LOWER(COALESCE(properties->>''email'', '''')) IN (
                           ''alice@example.com'',
                           ''bob.jones@corp.com'',
                           ''carol.white@acme.org'',
                           ''carol@example.com'',
                           ''bob@example.com'',
                           ''bobby@example.com''
                       )
                   );',
                schema_rec.schema_name
            );
        END IF;

        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = schema_rec.schema_name
              AND table_name = 'staging_records'
              AND column_name = 'data'
        ) INTO has_staging;

        IF has_staging THEN
            EXECUTE format(
                'DELETE FROM %I.staging_records
                 WHERE strpos(COALESCE(data, ''''), ''"_connection_id"'') = 0
                   AND (
                       raw_id IN (
                           ''rec-001'', ''rec-002'', ''rec-003'', ''rec-004'', ''rec-005'',
                           ''rec-006'', ''rec-007'', ''rec-008'', ''rec-009'', ''rec-010''
                       )
                       OR strpos(LOWER(COALESCE(data, '''')), ''alice@example.com'') > 0
                       OR strpos(LOWER(COALESCE(data, '''')), ''bob.jones@corp.com'') > 0
                       OR strpos(LOWER(COALESCE(data, '''')), ''carol.white@acme.org'') > 0
                       OR strpos(LOWER(COALESCE(data, '''')), ''carol@example.com'') > 0
                   );',
                schema_rec.schema_name
            );
        END IF;
    END LOOP;
END $$;
