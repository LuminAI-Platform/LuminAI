package com.luminai.common.tenant;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Servlet filter that extracts the {@code tenant_id} claim from the current JWT and stores it in
 * {@link TenantContext} for Hibernate to use during the request.
 *
 * <p>Always clears the context in a finally block to prevent tenant leakage between requests on
 * pooled threads.
 *
 * <p>Returns 403 if the JWT is present but contains no {@code tenant_id} claim.
 */
@Component
public class TenantFilter extends OncePerRequestFilter {

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {

    try {
      var authentication = SecurityContextHolder.getContext().getAuthentication();

      if (authentication != null && authentication.getPrincipal() instanceof Jwt jwt) {
        String tenantId = jwt.getClaimAsString("tenant_id");

        if (tenantId == null || tenantId.isBlank()) {
          response.sendError(HttpServletResponse.SC_FORBIDDEN, "Missing tenant_id in JWT");
          return;
        }

        TenantContext.setCurrentTenant(tenantId);
      }

      filterChain.doFilter(request, response);

    } finally {
      // Always clear to prevent tenant leakage on pooled threads
      TenantContext.clear();
    }
  }
}
