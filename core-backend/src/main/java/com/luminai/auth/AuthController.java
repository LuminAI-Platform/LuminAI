package com.luminai.auth;

import com.luminai.common.tenant.TenantContext;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Auth endpoints. Primary use: E3 (React frontend) calls GET /api/v1/auth/me after login to
 * retrieve the current user's profile.
 */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

  @GetMapping("/me")
  public Map<String, Object> getCurrentUser(@AuthenticationPrincipal Jwt jwt) {
    return Map.of(
            "userId", jwt.getSubject(),
            "email", jwt.getClaimAsString("email"),
            "name", jwt.getClaimAsString("preferred_username"),
            "tenantId", TenantContext.getTenantUuid().toString(),
            "tenantSlug", TenantContext.getTenantSlug(),
            "roles", jwt.getClaimAsMap("realm_access"));
  }
}
