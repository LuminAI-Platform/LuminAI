-- =====================================================================
-- LuminAI — V8: Seed Sandbox/Dev Admin User
-- =====================================================================
-- Tenant resolution now always goes through:
--     JWT.sub -> public.users.keycloak_id -> public.users.tenant_id
--            -> public.tenants.id -> public.tenants.slug
-- (see TenantFilter / TenantResolutionService). There is no more
-- automatic "default" tenant fallback for authenticated requests.
--
-- SecurityConfig's sandbox/dev JwtDecoder issues mock tokens with
-- sub = 'sandbox-admin-id' so that local/preview environments can
-- authenticate without a real Keycloak instance. For those requests to
-- resolve a tenant the same way a real Keycloak-issued token does, a
-- matching row must exist in public.users, tied to the bootstrap
-- 'default' tenant created in V4.
-- =====================================================================

INSERT INTO users (keycloak_id, email, full_name, tenant_id, role, is_active)
SELECT 'sandbox-admin-id',
       'admin@luminai.dev',
       'Sandbox Admin',
       t.id,
       'ADMIN',
       true
FROM tenants t
WHERE t.slug = 'default'
ON CONFLICT (keycloak_id) DO NOTHING;