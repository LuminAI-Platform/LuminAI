package com.luminai.auth;

import com.luminai.common.security.JwtClaimsExtractor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Auth endpoints. Primary use: E3 (React frontend) calls GET /api/v1/auth/me
 * after login to retrieve the current user's profile from the JWT.
 */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final JwtClaimsExtractor claimsExtractor;

    public AuthController(JwtClaimsExtractor claimsExtractor) {
        this.claimsExtractor = claimsExtractor;
    }

    @GetMapping("/me")
    public Map<String, Object> getCurrentUser(@AuthenticationPrincipal Jwt jwt) {
        return Map.of(
            "userId",   jwt.getClaimAsString("sub"),
            "email",    jwt.getClaimAsString("email"),
            "name",     jwt.getClaimAsString("preferred_username"),
            "tenantId", jwt.getClaimAsString("tenant_id"),
            "roles",    jwt.getClaimAsMap("realm_access")
        );
    }
}
