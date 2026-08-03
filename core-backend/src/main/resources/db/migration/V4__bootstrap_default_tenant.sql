-- =====================================================================
-- LuminAI — V4: Bootstrap Default Tenant Schema
-- =====================================================================
-- Clones tenant_template → tenant_default so the app can boot and
-- serve requests before tenants are provisioned via the admin API.
-- =====================================================================

INSERT INTO tenants (name, slug, status)
VALUES ('Default Tenant', 'default', 'active')
ON CONFLICT (slug) DO NOTHING;

CREATE SCHEMA IF NOT EXISTS tenant_default;

SET search_path TO tenant_default;

CREATE TABLE IF NOT EXISTS ontology_versions (LIKE tenant_template.ontology_versions INCLUDING ALL);
CREATE TABLE IF NOT EXISTS entity_types (LIKE tenant_template.entity_types INCLUDING ALL);
CREATE TABLE IF NOT EXISTS entities (LIKE tenant_template.entities INCLUDING ALL);
CREATE TABLE IF NOT EXISTS relationships (LIKE tenant_template.relationships INCLUDING ALL);
CREATE TABLE IF NOT EXISTS source_records (LIKE tenant_template.source_records INCLUDING ALL);
CREATE TABLE IF NOT EXISTS audit_log (LIKE tenant_template.audit_log INCLUDING ALL);
CREATE TABLE IF NOT EXISTS connectors (LIKE tenant_template.connectors INCLUDING ALL);
CREATE TABLE IF NOT EXISTS sync_jobs (LIKE tenant_template.sync_jobs INCLUDING ALL);
CREATE TABLE IF NOT EXISTS schema_mappings (LIKE tenant_template.schema_mappings INCLUDING ALL);

-- Re-add cross-table FKs (LIKE INCLUDING ALL does not copy these)

ALTER TABLE entity_types
    ADD CONSTRAINT fk_entity_types_ontology
    FOREIGN KEY (ontology_id) REFERENCES tenant_default.ontology_versions(id) ON DELETE CASCADE;

ALTER TABLE relationships
    ADD CONSTRAINT fk_relationships_source
    FOREIGN KEY (source_entity_id) REFERENCES tenant_default.entities(id) ON DELETE CASCADE;

ALTER TABLE relationships
    ADD CONSTRAINT fk_relationships_target
    FOREIGN KEY (target_entity_id) REFERENCES tenant_default.entities(id) ON DELETE CASCADE;

ALTER TABLE source_records
    ADD CONSTRAINT fk_source_records_golden
    FOREIGN KEY (golden_id) REFERENCES tenant_default.entities(id);

ALTER TABLE sync_jobs
    ADD CONSTRAINT fk_sync_jobs_connector
    FOREIGN KEY (connector_id) REFERENCES tenant_default.connectors(id) ON DELETE CASCADE;

ALTER TABLE schema_mappings
    ADD CONSTRAINT fk_schema_mappings_connector
    FOREIGN KEY (connector_id) REFERENCES tenant_default.connectors(id) ON DELETE CASCADE;

RESET search_path;
