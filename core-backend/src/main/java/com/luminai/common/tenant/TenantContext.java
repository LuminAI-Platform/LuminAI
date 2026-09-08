package com.luminai.common.tenant;

import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * ThreadLocal holder for the current tenant. Populated by {@link TenantFilter} once per request,
 * <strong>after</strong> the caller's identity has been resolved to a tenant via {@code
 * public.users} / {@code public.tenants} (see {@link TenantResolutionService}) — never from a raw
 * JWT claim.
 *
 * <p><strong>Important:</strong> Always call {@link #clear()} in a finally block or via the
 * filter's afterCompletion to prevent tenant leakage between requests (threads are reused by the
 * application server's thread pool).
 */
public final class TenantContext {

  private static final Logger log = LoggerFactory.getLogger(TenantContext.class);

  /** Schema prefix applied to every tenant identifier. */
  public static final String SCHEMA_PREFIX = "tenant_";

  /**
   * Fallback schema name used only for Hibernate's bootstrap connection (schema validation at
   * startup) and connection release, before any request-scoped tenant has been resolved. This is
   * NOT a fallback tenant for authenticated application requests — see {@link TenantFilter}, which
   * rejects requests it cannot resolve a real tenant for.
   */
  public static final String DEFAULT_SCHEMA = "tenant_default";

  private static final ThreadLocal<String> CURRENT_TENANT_SLUG = new ThreadLocal<>();
  private static final ThreadLocal<UUID> CURRENT_TENANT_UUID = new ThreadLocal<>();

  private TenantContext() {}

  /**
   * Sets the resolved tenant for this thread: both its schema slug and its {@code
   * public.tenants.id} primary key. This is the only way application request handling should
   * populate tenant context — always as the result of a {@code public.users} lookup, never parsed
   * directly out of a JWT claim.
   */
  public static void setTenant(UUID tenantId, String slug) {
    if (tenantId == null) {
      throw new IllegalArgumentException("Tenant ID must not be null");
    }
    if (slug == null || slug.isBlank()) {
      throw new IllegalArgumentException("Tenant slug must not be null or blank");
    }
    log.debug("Setting tenant context: slug='{}', id={}", slug, tenantId);
    CURRENT_TENANT_UUID.set(tenantId);
    CURRENT_TENANT_SLUG.set(slug.trim());
  }

  /**
   * Sets only the schema slug for this thread, leaving the tenant UUID unset. Intended for
   * lightweight test setup and for call sites that only ever need schema routing. Application
   * request handling should use {@link #setTenant(UUID, String)} instead.
   */
  public static void setTenantId(String slug) {
    if (slug == null || slug.isBlank()) {
      throw new IllegalArgumentException("Tenant slug must not be null or blank");
    }
    CURRENT_TENANT_UUID.remove();
    CURRENT_TENANT_SLUG.set(slug.trim());
  }

  /**
   * Returns the current tenant's schema slug (e.g. {@code "acme"}), or {@code null} if unset.
   *
   * @deprecated kept for existing callers that only need the schema slug; prefer {@link
   *     #getTenantSlug()} for new code (same value, clearer name) or {@link #getTenantUuid()} for
   *     row-level tenant scoping.
   */
  @Deprecated
  public static String getTenantId() {
    return CURRENT_TENANT_SLUG.get();
  }

  /** Returns the current tenant's schema slug (e.g. {@code "acme"}), or {@code null} if unset. */
  public static String getTenantSlug() {
    return CURRENT_TENANT_SLUG.get();
  }

  /**
   * Returns the current tenant's {@code public.tenants.id} primary key, or {@code null} if unset.
   * Use this — not {@link #getTenantId()} — for row-level tenant scoping in tenant-schema tables.
   */
  public static UUID getTenantUuid() {
    return CURRENT_TENANT_UUID.get();
  }

  // Returns the fully-qualified schema name for the current tenant
  public static String getCurrentSchema() {
    String slug = CURRENT_TENANT_SLUG.get();
    return (slug != null && !slug.isBlank()) ? SCHEMA_PREFIX + slug : DEFAULT_SCHEMA;
  }

  // Returns {@code true} if a tenant has been set on this thread
  public static boolean hasTenant() {
    return CURRENT_TENANT_SLUG.get() != null;
  }

  // Clear the tenant from this current thread's {@link ThreadLocal}s
  public static void clear() {
    String previous = CURRENT_TENANT_SLUG.get();
    CURRENT_TENANT_SLUG.remove();
    CURRENT_TENANT_UUID.remove();
    if (previous != null) {
      log.debug("Cleared tenant context (was: {})", previous);
    }
  }
}
