package com.luminai.auth.security;

import com.luminai.auth.model.ApiKey;
import com.luminai.auth.model.Tenant;
import com.luminai.auth.service.ApiKeyService;
import com.luminai.common.tenant.TenantContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Optional;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Filter that inspects requests for an enterprise API key (X-API-Key header or Authorization:
 * ApiKey). When present and valid, authenticates the request and populates TenantContext.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 50)
public class ApiKeyAuthenticationFilter extends OncePerRequestFilter {

  private final ApiKeyService apiKeyService;

  public ApiKeyAuthenticationFilter(ApiKeyService apiKeyService) {
    this.apiKeyService = apiKeyService;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {

    String apiKey = extractApiKey(request);
    if (apiKey != null && apiKey.startsWith("lum_live_")) {
      Optional<ApiKey> validKey = apiKeyService.validateAndTouch(apiKey);
      if (validKey.isPresent()) {
        ApiKey key = validKey.get();
        Tenant tenant = key.getTenant();

        // Populate SecurityContext
        UsernamePasswordAuthenticationToken auth =
            new UsernamePasswordAuthenticationToken(
                "apikey:" + key.getKeyPrefix(),
                null,
                List.of(
                    new SimpleGrantedAuthority("ROLE_ADMIN"),
                    new SimpleGrantedAuthority("ROLE_USER")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        // Populate TenantContext
        TenantContext.setTenant(tenant.getId(), tenant.getSlug());
        try {
          filterChain.doFilter(request, response);
        } finally {
          TenantContext.clear();
        }
        return;
      }
    }

    filterChain.doFilter(request, response);
  }

  private String extractApiKey(HttpServletRequest request) {
    String header = request.getHeader("X-API-Key");
    if (header != null && !header.isBlank()) {
      return header.trim();
    }
    String auth = request.getHeader("Authorization");
    if (auth != null) {
      if (auth.startsWith("ApiKey ")) {
        return auth.substring(7).trim();
      }
      if (auth.startsWith("Bearer lum_live_")) {
        return auth.substring(7).trim();
      }
    }
    return null;
  }
}
