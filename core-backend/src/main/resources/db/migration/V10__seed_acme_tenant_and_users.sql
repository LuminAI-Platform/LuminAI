-- =====================================================================
-- LuminAI — V10: Seed Acme Corporation Tenant & Users (Multi-Tenancy)
-- =====================================================================
-- Provisions the canonical 'acme' tenant and schema alongside 'default'.
-- This guarantees that when a user or automated test authenticates
-- targeting the Acme tenant, TenantResolutionService resolves:
--     JWT.sub -> public.users.keycloak_id -> public.users.tenant_id
--            -> public.tenants (slug='acme')
-- and MultiTenantConnectionProvider routes to 'tenant_acme'.
-- =====================================================================

-- 1. Register Acme tenant in public registry
INSERT INTO public.tenants (name, slug, status)
VALUES ('Acme Corporation', 'acme', 'active')
ON CONFLICT (slug) DO NOTHING;

-- 2. Create tenant_acme isolated schema
CREATE SCHEMA IF NOT EXISTS tenant_acme;

SET search_path TO tenant_acme;

CREATE TABLE IF NOT EXISTS ontology_versions           (LIKE tenant_template.ontology_versions           INCLUDING ALL);
CREATE TABLE IF NOT EXISTS entity_types                 (LIKE tenant_template.entity_types                 INCLUDING ALL);
CREATE TABLE IF NOT EXISTS relationship_types           (LIKE tenant_template.relationship_types           INCLUDING ALL);
CREATE TABLE IF NOT EXISTS entities                     (LIKE tenant_template.entities                     INCLUDING ALL);
CREATE TABLE IF NOT EXISTS relationships                (LIKE tenant_template.relationships                INCLUDING ALL);
CREATE TABLE IF NOT EXISTS source_records               (LIKE tenant_template.source_records               INCLUDING ALL);
CREATE TABLE IF NOT EXISTS audit_log                    (LIKE tenant_template.audit_log                    INCLUDING ALL);
CREATE TABLE IF NOT EXISTS connectors                   (LIKE tenant_template.connectors                   INCLUDING ALL);
CREATE TABLE IF NOT EXISTS sync_jobs                    (LIKE tenant_template.sync_jobs                    INCLUDING ALL);
CREATE TABLE IF NOT EXISTS schema_mappings              (LIKE tenant_template.schema_mappings              INCLUDING ALL);
CREATE TABLE IF NOT EXISTS cleaning_rules               (LIKE tenant_template.cleaning_rules               INCLUDING ALL);
CREATE TABLE IF NOT EXISTS pipeline_runs                (LIKE tenant_template.pipeline_runs                INCLUDING ALL);
CREATE TABLE IF NOT EXISTS golden_records               (LIKE tenant_template.golden_records               INCLUDING ALL);
CREATE TABLE IF NOT EXISTS er_candidates                (LIKE tenant_template.er_candidates                INCLUDING ALL);
CREATE TABLE IF NOT EXISTS provenance                   (LIKE tenant_template.provenance                   INCLUDING ALL);
CREATE TABLE IF NOT EXISTS golden_records_source_ids    (LIKE tenant_template.golden_records_source_ids    INCLUDING ALL);
CREATE TABLE IF NOT EXISTS golden_records_provenance    (LIKE tenant_template.golden_records_provenance    INCLUDING ALL);

-- Re-add cross-table foreign keys for tenant_acme
ALTER TABLE entity_types
    ADD CONSTRAINT fk_acme_entity_types_ontology
    FOREIGN KEY (ontology_id) REFERENCES tenant_acme.ontology_versions(id) ON DELETE CASCADE;

ALTER TABLE relationship_types
    ADD CONSTRAINT fk_acme_rel_types_source
    FOREIGN KEY (source_entity_type_id) REFERENCES tenant_acme.entity_types(id) ON DELETE CASCADE;

ALTER TABLE relationship_types
    ADD CONSTRAINT fk_acme_rel_types_target
    FOREIGN KEY (target_entity_type_id) REFERENCES tenant_acme.entity_types(id) ON DELETE CASCADE;

ALTER TABLE relationships
    ADD CONSTRAINT fk_acme_relationships_source
    FOREIGN KEY (source_entity_id) REFERENCES tenant_acme.entities(id) ON DELETE CASCADE;

ALTER TABLE relationships
    ADD CONSTRAINT fk_acme_relationships_target
    FOREIGN KEY (target_entity_id) REFERENCES tenant_acme.entities(id) ON DELETE CASCADE;

ALTER TABLE source_records
    ADD CONSTRAINT fk_acme_source_records_golden
    FOREIGN KEY (golden_id) REFERENCES tenant_acme.entities(id);

ALTER TABLE sync_jobs
    ADD CONSTRAINT fk_acme_sync_jobs_connector
    FOREIGN KEY (connector_id) REFERENCES tenant_acme.connectors(id) ON DELETE CASCADE;

ALTER TABLE schema_mappings
    ADD CONSTRAINT fk_acme_schema_mappings_connector
    FOREIGN KEY (connector_id) REFERENCES tenant_acme.connectors(id) ON DELETE CASCADE;

ALTER TABLE cleaning_rules
    ADD CONSTRAINT fk_acme_cleaning_rules_connector
    FOREIGN KEY (connection_id) REFERENCES tenant_acme.connectors(id) ON DELETE CASCADE;

ALTER TABLE pipeline_runs
    ADD CONSTRAINT fk_acme_pipeline_runs_connector
    FOREIGN KEY (connection_id) REFERENCES tenant_acme.connectors(id) ON DELETE CASCADE;

ALTER TABLE er_candidates
    ADD CONSTRAINT fk_acme_er_candidates_pipeline_run
    FOREIGN KEY (pipeline_run_id) REFERENCES tenant_acme.pipeline_runs(id) ON DELETE CASCADE;

ALTER TABLE er_candidates
    ADD CONSTRAINT fk_acme_er_candidates_golden_record
    FOREIGN KEY (golden_record_id) REFERENCES tenant_acme.golden_records(id) ON DELETE SET NULL;

ALTER TABLE provenance
    ADD CONSTRAINT fk_acme_provenance_golden_record
    FOREIGN KEY (golden_record_id) REFERENCES tenant_acme.golden_records(id) ON DELETE CASCADE;

ALTER TABLE provenance
    ADD CONSTRAINT fk_acme_provenance_source_connection
    FOREIGN KEY (source_connection_id) REFERENCES tenant_acme.connectors(id) ON DELETE CASCADE;

ALTER TABLE golden_records_source_ids
    ADD CONSTRAINT fk_acme_gr_source_ids_golden
    FOREIGN KEY (golden_record_id) REFERENCES tenant_acme.golden_records(id) ON DELETE CASCADE;

ALTER TABLE golden_records_provenance
    ADD CONSTRAINT fk_acme_gr_provenance_golden
    FOREIGN KEY (golden_record_id) REFERENCES tenant_acme.golden_records(id) ON DELETE CASCADE;

RESET search_path;

-- 3. Seed Acme test users in public.users
INSERT INTO public.users (keycloak_id, email, full_name, tenant_id, role, is_active)
SELECT 'sandbox-acme-id',
       'alice@acme.com',
       'Alice Mensah',
       t.id,
       'ADMIN',
       true
FROM public.tenants t
WHERE t.slug = 'acme'
ON CONFLICT (keycloak_id) DO NOTHING;

INSERT INTO public.users (keycloak_id, email, full_name, tenant_id, role, is_active)
SELECT 'mock-sub-acme',
       'alice@acme.com',
       'Alice Mensah',
       t.id,
       'ADMIN',
       true
FROM public.tenants t
WHERE t.slug = 'acme'
ON CONFLICT (keycloak_id) DO NOTHING;

INSERT INTO public.users (keycloak_id, email, full_name, tenant_id, role, is_active)
SELECT 'kc-acme-alice',
       'alice@acme.com',
       'Alice Mensah',
       t.id,
       'ADMIN',
       true
FROM public.tenants t
WHERE t.slug = 'acme'
ON CONFLICT (keycloak_id) DO NOTHING;
