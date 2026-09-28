-- =====================================================================
-- LuminAI — V999: Seed Demo Data for Default Tenant (MVP-07)
-- =====================================================================
-- Populates 3 entity types (Person, Organization, Dataset),
-- 2 relationship types, and 5 golden records for developer testing and demos.
-- =====================================================================

DO $$
DECLARE
    default_tenant_id UUID;
    person_type_id UUID := '11111111-1111-1111-1111-111111111111';
    org_type_id    UUID := '22222222-2222-2222-2222-222222222222';
    dataset_type_id UUID := '33333333-3333-3333-3333-333333333333';
BEGIN
    -- Obtain default tenant UUID
    SELECT id INTO default_tenant_id FROM public.tenants WHERE slug = 'default' LIMIT 1;
    IF default_tenant_id IS NULL THEN
        default_tenant_id := '00000000-0000-0000-0000-000000000001';
    END IF;

    -- Ensure search path is set to tenant_default
    PERFORM set_config('search_path', 'tenant_default', true);

    -- 1. Seed 3 Entity Types
    INSERT INTO entity_types (id, tenant_id, name, label, description, color, icon, properties_schema)
    VALUES
        (person_type_id, default_tenant_id, 'Person', 'Individual', 'A human person profile', '#3b82f6', 'user', '{"type": "object", "properties": {"email": {"type": "string"}, "title": {"type": "string"}}}'::jsonb),
        (org_type_id, default_tenant_id, 'Organization', 'Company / Org', 'A commercial or governmental organization', '#10b981', 'building', '{"type": "object", "properties": {"domain": {"type": "string"}, "industry": {"type": "string"}}}'::jsonb),
        (dataset_type_id, default_tenant_id, 'Dataset', 'Data Asset', 'An ingested data store or flat file', '#8b5cf6', 'database', '{"type": "object", "properties": {"format": {"type": "string"}, "size": {"type": "string"}}}'::jsonb)
    ON CONFLICT (id) DO UPDATE SET
        label = EXCLUDED.label,
        color = EXCLUDED.color,
        icon = EXCLUDED.icon;

    -- 2. Seed 2 Relationship Types
    INSERT INTO relationship_types (id, tenant_id, name, description, source_entity_type_id, target_entity_type_id, cardinality, properties_schema)
    VALUES
        ('44444444-4444-4444-4444-444444444444', default_tenant_id, 'EMPLOYED_AT', 'Affiliation with employer organization', person_type_id, org_type_id, 'MANY_TO_ONE', '{}'::jsonb),
        ('55555555-5555-5555-5555-555555555555', default_tenant_id, 'OWNS_DATASET', 'Organization ownership of data assets', org_type_id, dataset_type_id, 'ONE_TO_MANY', '{}'::jsonb)
    ON CONFLICT (id) DO NOTHING;

    -- 3. Seed 5 Golden Records
    INSERT INTO golden_records (id, tenant_id, entity_type, canonical_name, properties, confidence_score, source_count, version)
    VALUES
        ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', default_tenant_id, 'Person', 'Alice Mensah', '{"email": "alice@corp.io", "title": "VP of Engineering", "country": "GH", "status": "active"}'::jsonb, 0.9850, 3, 1),
        ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', default_tenant_id, 'Person', 'Kwame Boateng', '{"email": "kwame.b@innov.com", "title": "Lead Data Architect", "country": "GH", "status": "active"}'::jsonb, 0.9620, 2, 1),
        ('cccccccc-cccc-cccc-cccc-cccccccccccc', default_tenant_id, 'Organization', 'Acme Corp', '{"domain": "acme.com", "industry": "Enterprise Software", "tier": "Enterprise", "employees": 450}'::jsonb, 0.9910, 4, 1),
        ('dddddddd-dddd-dddd-dddd-dddddddddddd', default_tenant_id, 'Organization', 'Apex Innovations', '{"domain": "apex.org", "industry": "Financial Technology", "tier": "Growth", "employees": 120}'::jsonb, 0.9740, 2, 1),
        ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', default_tenant_id, 'Dataset', 'Global Telemetry 2026', '{"format": "Parquet", "records": "5200000", "size": "450MB", "classification": "Internal"}'::jsonb, 0.9990, 1, 1)
    ON CONFLICT (id) DO UPDATE SET
        canonical_name = EXCLUDED.canonical_name,
        properties = EXCLUDED.properties;

END $$;
