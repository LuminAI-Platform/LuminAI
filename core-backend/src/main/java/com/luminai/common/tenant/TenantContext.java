package com.luminai.common.tenant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * ThreadLocal holder for the current tenant ID. Set by {@link TenantFilter} on each incoming
 * request. Read by Hibernate's {@link TenantIdentifierResolver} to route queries to the correct
 * tenant schema.
 *
 * <p><strong>Important:</strong> Always call {@link #clear()} in a finally block or via the
 * filter's afterCompletion to prevent tenant leakage between requests.
 */
public final class TenantContext {

  private static final Logger log = LoggerFactory.getLogger(TenantContext.class);

  /** Schema prefix applied to every tenant identifier. */
  public static final String SCHEMA_PREFIX = "tenant_";

  /** Fallback schema used for system-level or unauthenticated operations. */
  public static final String DEFAULT_TENANT = "public";

  private static final ThreadLocal<String> CURRENT_TENANT = new ThreadLocal<>();

  private TenantContext() {}


  //Sets the current tenant identifier for this thread.
  public static void setTenantId(String tenantId) {
    if (tenantId == null || tenantId.isBlank()) {
      throw new IllegalArgumentException("Tenant ID must not be null or blank");
    }
    log.debug("Setting tenant context: {}", tenantId);
    CURRENT_TENANT.set(tenantId.trim());
  }
  // Get the current tenant identifier
  public static String getTenantId() {
    return CURRENT_TENANT.get();
  }

  // Returns the fully-qualified schema name for the current tenant
  public static String getCurrentSchema() {
    String tenantId = CURRENT_TENANT.get();
    return (tenantId != null) ? SCHEMA_PREFIX + tenantId : DEFAULT_TENANT;
  }

  //Returns {@code true} if a tenant has been set on this thread
  public static boolean hasTenant() {
    return CURRENT_TENANT.get() != null;
  }

  // Clear the tenant from this current thread's {@link ThreadLocal}
  public static void clear() {
    String previous = CURRENT_TENANT.get();
    CURRENT_TENANT.remove();
    if (previous != null) {
      log.debug("Cleared tenant context (was: {})", previous);
    }
  }
}
