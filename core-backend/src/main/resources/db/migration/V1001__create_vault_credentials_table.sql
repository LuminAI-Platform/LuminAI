-- =====================================================================
-- LuminAI — V1001: Create Vault Credentials Table in Public Schema
-- =====================================================================
-- Persists encrypted credentials (AES-256-GCM) for data source connectors.
-- Ensures credentials survive pod restarts and multi-replica horizontal scaling.
-- =====================================================================

CREATE TABLE IF NOT EXISTS vault_credentials (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    connector_id    UUID NOT NULL,
    encrypted_data  TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_vault_credentials_tenant_connector UNIQUE (tenant_id, connector_id)
);

CREATE INDEX IF NOT EXISTS idx_vault_credentials_tenant_connector ON vault_credentials(tenant_id, connector_id);
