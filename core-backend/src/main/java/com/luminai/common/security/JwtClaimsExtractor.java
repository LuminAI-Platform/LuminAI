package com.luminai.common.security;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Utility component to extract common claims from the current JWT in the
 * Spring Security context. Inject this wherever you need the authenticated
 * user's identity or tenant without passing the JWT manually.
 */
@Component
public class JwtClaimsExtractor {

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
            .orElseThrow(() -> new IllegalStateException("No authenticated user"));
    }

    public String getCurrentTenantId() {
        return getCurrentJwt()
            .map(jwt -> jwt.getClaimAsString("tenant_id"))
            .orElseThrow(() -> new IllegalStateException("No tenant_id in JWT"));
    }

    public String getCurrentEmail() {
        return getCurrentJwt()
            .map(jwt -> jwt.getClaimAsString("email"))
            .orElse("unknown");
    }
}
