package com.luminai.auth.controller;

import com.luminai.common.tenant.TenantContext;
import java.util.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
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
  public Map<String, Object> getCurrentUser(
      @AuthenticationPrincipal Jwt jwt, Authentication authentication) {
    Map<String, Object> response = new LinkedHashMap<>();

    String userId =
        jwt != null
            ? jwt.getSubject()
            : (authentication != null ? authentication.getName() : "anonymous");
    String email = jwt != null ? jwt.getClaimAsString("email") : userId;
    String name =
        jwt != null
            ? jwt.getClaimAsString("preferred_username")
            : (authentication != null ? authentication.getName() : "User");

    UUID tenantUuid = TenantContext.getTenantUuid();
    String tenantSlug = TenantContext.getTenantSlug();

    response.put("userId", userId);
    response.put("email", email);
    response.put("name", name != null ? name : email);
    response.put("tenantId", tenantUuid != null ? tenantUuid.toString() : null);
    response.put("tenantSlug", tenantSlug != null ? tenantSlug : "acme");

    List<String> roles = new ArrayList<>();
    if (jwt != null) {
      Map<String, Object> realmAccess = jwt.getClaimAsMap("realm_access");
      if (realmAccess != null && realmAccess.get("roles") instanceof Collection<?> realmRoles) {
        for (Object r : realmRoles) {
          if (r != null) roles.add(String.valueOf(r));
        }
      }
    }
    if (roles.isEmpty() && authentication != null) {
      for (GrantedAuthority ga : authentication.getAuthorities()) {
        String auth = ga.getAuthority();
        if (auth.startsWith("ROLE_")) {
          roles.add(auth.substring(5));
        } else {
          roles.add(auth);
        }
      }
    }
    if (roles.isEmpty()) {
      roles.add("VIEWER");
    }

    response.put("roles", roles);
    return response;
  }
}
