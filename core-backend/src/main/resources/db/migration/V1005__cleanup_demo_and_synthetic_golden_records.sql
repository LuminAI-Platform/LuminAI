-- =====================================================================
-- LuminAI — V1005: Remove Demo Seed & Synthetic Fallback Golden Records
-- =====================================================================
-- Removes legacy hardcoded V999 seed rows (Alice Mensah, Kwame Boateng,
-- Acme Corp, Apex Innovations, Global Telemetry 2026) and any synthetic
-- Data Engine fallback records (rec-001..rec-010 without a real
-- _connection_id) across all tenant_* schemas so Entity Explorer
-- displays only live ingested/resolved tenant entities.
-- =====================================================================

DO $$
DECLARE
    schema_rec RECORD;
    has_gr     BOOLEAN;
BEGIN
    FOR schema_rec IN
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name LIKE 'tenant\_%' ESCAPE '\'
          AND schema_name <> 'tenant_template'
    LOOP
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = schema_rec.schema_name
              AND table_name = 'golden_records'
              AND column_name = 'properties'
        ) INTO has_gr;

        IF has_gr THEN
            EXECUTE format(
                'DELETE FROM %I.golden_records
                 WHERE id IN (
                     ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''::uuid,
                     ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb''::uuid,
                     ''cccccccc-cccc-cccc-cccc-cccccccccccc''::uuid,
                     ''dddddddd-dddd-dddd-dddd-dddddddddddd''::uuid,
                     ''eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee''::uuid
                 )
                 OR (
                     NOT (COALESCE(properties, ''{}''::jsonb) ? ''_connection_id'')
                     AND (
                         COALESCE(properties->''_source_record_ids'', ''[]''::jsonb) ?| ARRAY[''rec-001'', ''rec-002'', ''rec-003'', ''rec-004'', ''rec-005'', ''rec-006'', ''rec-007'', ''rec-008'', ''rec-009'', ''rec-010'']
                     )
                 );',
                schema_rec.schema_name
            );
        END IF;
    END LOOP;
END $$;
