package com.luminai.common.security;

import com.luminai.common.tenant.TenantContext;
import java.util.Optional;
import java.util.UUID;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

/**
 * Utility component to extract common claims from the current JWT in the Spring Security context.
 * Inject this wherever you need the authenticated user's identity without passing the JWT
 * manually.
 *
 * <p><strong>Tenant resolution is not done here.</strong> The JWT is never asked for a {@code
 * tenant_id} claim — Keycloak identifies the user, and {@code TenantFilter} (via {@code
 * TenantResolutionService}) is solely responsible for resolving that user's tenant from {@code
 * public.users} / {@code public.tenants} and populating {@link TenantContext}. {@link
 * #getCurrentTenantId()} below just reads that already-resolved value.
 */
@Component
public class JwtClaimsExtractor {

  public static final String DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";

  public Optional<Jwt> getCurrentJwt() {
    var auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
      return Optional.of(jwt);
    }
    return Optional.empty();
  }

  public String getCurrentUserId() {
    return getCurrentJwt()
            .map(jwt -> jwt.getClaimAsString("sub"))
            .filter(sub -> sub != null && !sub.isBlank())
            .orElse(DEFAULT_USER_ID);
  }

  /**
   * Returns the current request's tenant ID ({@code public.tenants.id}), as resolved by {@code
   * TenantFilter} for the authenticated user. There is no fallback: if a service calls this
   * outside of a request that {@code TenantFilter} has processed (or tenant resolution failed and
   * the request should have already been rejected), that is a bug, and this throws rather than
   * silently attributing the call to some default tenant.
   *
   * @throws IllegalStateException if no tenant has been resolved for the current thread.
   */
  public String getCurrentTenantId() {
    UUID tenantId = TenantContext.getTenantUuid();
    if (tenantId == null) {
      throw new IllegalStateException(
              "No tenant has been resolved for the current request. TenantFilter should have "
                      + "resolved and set a tenant, or rejected the request, before reaching this point.");
    }
    return tenantId.toString();
  }

  public String getCurrentEmail() {
    return getCurrentJwt()
            .map(jwt -> jwt.getClaimAsString("email"))
            .filter(e -> e != null && !e.isBlank())
            .orElse("user@luminai.io");
  }
}
