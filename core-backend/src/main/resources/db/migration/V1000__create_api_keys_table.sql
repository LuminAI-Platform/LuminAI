-- =====================================================================
-- LuminAI — V1000: Create API Keys Table in Public Schema
-- =====================================================================
-- Supports enterprise API key rotation and authentication for tenants.
-- Full key strings (e.g. lum_live_...) are hashed using SHA-256 before storage.
-- Only the key prefix (first 16 chars) is stored in plaintext for identification.
-- =====================================================================

CREATE TABLE IF NOT EXISTS api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    key_prefix      VARCHAR(16) NOT NULL,
    key_hash        VARCHAR(128) NOT NULL UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    is_active       BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);
