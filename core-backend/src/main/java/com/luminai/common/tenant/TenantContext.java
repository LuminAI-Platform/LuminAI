package com.luminai.common.tenant;

/**
 * ThreadLocal holder for the current tenant ID.
 * Set by {@link TenantFilter} on each incoming request.
 * Read by Hibernate's {@link TenantIdentifierResolver} to route queries
 * to the correct tenant schema.
 *
 * <p><strong>Important:</strong> Always call {@link #clear()} in a finally block
 * or via the filter's afterCompletion to prevent tenant leakage between requests.
 */
public final class TenantContext {

    private static final ThreadLocal<String> CURRENT_TENANT = new ThreadLocal<>();

    private TenantContext() {}

    public static String getCurrentTenant() {
        return CURRENT_TENANT.get();
    }

    public static void setCurrentTenant(String tenantId) {
        CURRENT_TENANT.set(tenantId);
    }

    public static void clear() {
        CURRENT_TENANT.remove();
    }
}
