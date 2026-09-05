package com.luminai.common.tenant;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.security.SecurityProperties;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Resolves the tenant for every authenticated request and populates {@link TenantContext} for the
 * duration of that request.
 **/
@Component
@Order(SecurityProperties.DEFAULT_FILTER_ORDER + 1)
public class TenantFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(TenantFilter.class);

    /**
     * Paths that do not require tenant resolution (health checks, public auth endpoints, etc.).
     * Requests to these paths pass through without setting tenant context.
     */
    private static final String[] BYPASS_PATHS = {
            "/actuator/health",
            "/actuator/info",
            "/v3/api-docs",
            "/swagger-ui",
            "/swagger-ui.html",
            "/api/v1/auth/login",
            "/api/v1/auth/refresh",
            "/api/v1/public/"
    };

    private final TenantResolutionService tenantResolutionService;

    public TenantFilter(TenantResolutionService tenantResolutionService) {
        this.tenantResolutionService = tenantResolutionService;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        for (String bypassPath : BYPASS_PATHS) {
            if (path.startsWith(bypassPath)) {
                log.trace("Bypassing tenant filter for path: {}", path);
                return true;
            }
        }
        return false;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        try {
            Optional<Jwt> jwt = currentJwt();
            if (jwt.isEmpty()) {
                // Spring Security already rejects unauthenticated requests to protected paths before this
                // filter runs, so reaching here with no JWT principal indicates a misconfiguration rather
                // than a normal auth failure. Fail closed either way.
                log.warn(
                        "Tenant resolution reached with no authenticated JWT principal for {} {}",
                        request.getMethod(),
                        request.getRequestURI());
                sendError(response, HttpStatus.UNAUTHORIZED, "Authentication required");
                return;
            }

            String keycloakId = jwt.get().getSubject();
            Optional<TenantResolutionService.ResolvedTenant> resolved =
                    tenantResolutionService.resolveForKeycloakUser(keycloakId);

            if (resolved.isEmpty()) {
                log.warn(
                        "No active tenant found for authenticated user (sub={}) on {} {}",
                        keycloakId,
                        request.getMethod(),
                        request.getRequestURI());
                sendError(response, HttpStatus.FORBIDDEN, "User is not associated with an active tenant");
                return;
            }

            TenantContext.setTenant(resolved.get().tenantId(), resolved.get().slug());
            log.debug(
                    "Tenant context resolved to slug='{}' (id={}) for {} {}",
                    resolved.get().slug(),
                    resolved.get().tenantId(),
                    request.getMethod(),
                    request.getRequestURI());

            filterChain.doFilter(request, response);

        } finally {
            // CRITICAL: Always clear tenant context after the request completes.
            // Application servers reuse threads — without this, the next request
            // served by this thread would inherit the previous request's tenant.
            TenantContext.clear();
        }
    }

    /** Reads the authenticated {@link Jwt} principal set by Spring Security's resource server. */
    private Optional<Jwt> currentJwt() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof Jwt jwt) {
            return Optional.of(jwt);
        }
        return Optional.empty();
    }

    /** Writes a JSON error response and sets the appropriate HTTP status. */
    private void sendError(HttpServletResponse response, HttpStatus status, String message)
            throws IOException {
        response.setStatus(status.value());
        response.setContentType("application/json;charset=UTF-8");
        response
                .getWriter()
                .write(String.format("{\"error\":\"%s\",\"status\":%d}", message, status.value()));
    }
}