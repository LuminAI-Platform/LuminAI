package com.luminai.common.security;

import com.luminai.common.tenant.TenantContext;
import java.util.Optional;
import java.util.UUID;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

/**
 * Utility component to extract common claims from the current JWT in the Spring Security context.
 * Inject this wherever you need the authenticated user's identity or tenant without passing the JWT
 * manually.
 */
@Component
public class JwtClaimsExtractor {

  public static final String DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";
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

  public String getCurrentTenantId() {
    // 1. Extract from JWT tenant_id claim if present and valid UUID
    Optional<String> fromJwt =
        getCurrentJwt()
            .map(jwt -> jwt.getClaimAsString("tenant_id"))
            .filter(t -> t != null && !t.isBlank());
    if (fromJwt.isPresent()) {
      try {
        UUID.fromString(fromJwt.get());
        return fromJwt.get();
      } catch (IllegalArgumentException ignored) {
        // Non-UUID claim string like "acme" or "default" — fallback below
      }
    }

    // 2. Fall back to current TenantContext if set to a valid UUID
    String contextTenant = TenantContext.getTenantId();
    if (contextTenant != null && !contextTenant.isBlank()) {
      try {
        UUID.fromString(contextTenant);
        return contextTenant;
      } catch (IllegalArgumentException ignored) {
        // "default" or "public" or non-UUID slug
      }
    }

    // 3. Fallback to default system tenant UUID
    return DEFAULT_TENANT_ID;
  }

  public String getCurrentEmail() {
    return getCurrentJwt()
        .map(jwt -> jwt.getClaimAsString("email"))
        .filter(e -> e != null && !e.isBlank())
        .orElse("user@luminai.io");
  }
}
