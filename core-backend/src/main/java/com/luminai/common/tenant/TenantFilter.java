package com.luminai.common.tenant;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(1)
public class TenantFilter extends OncePerRequestFilter {

  private static final Logger log = LoggerFactory.getLogger(TenantFilter.class);

  private static final String BEARER_PREFIX = "Bearer ";
  private static final String TENANT_CLAIM = "\"tenant_id\"";

  /**
   * Paths that do not require tenant resolution (health checks, public auth endpoints, etc.).
   * Requests to these paths pass through without setting tenant context.
   */
  private static final String[] BYPASS_PATHS = {
    "/actuator/health",
    "/actuator/info",
    "/api/v1/auth/login",
    "/api/v1/auth/refresh",
    "/api/v1/public/"
  };

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
      String tenantId = resolveTenantId(request);

      if (tenantId == null || tenantId.isBlank()) {
        log.warn(
            "Missing or unresolvable tenant_id for request: {} {}",
            request.getMethod(),
            request.getRequestURI());
        sendError(response, HttpStatus.UNAUTHORIZED, "Missing tenant_id claim in token");
        return;
      }

      TenantContext.setTenantId(tenantId);
      log.debug(
          "Tenant context set to '{}' for {} {}",
          tenantId,
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

  /**
   * Extracts the {@code tenant_id} claim from the {@code Authorization: Bearer <token>} header.
   *
   * @param request the incoming HTTP request.
   * @return the tenant ID string, or {@code null} if absent or unparseable.
   */
  private String resolveTenantId(HttpServletRequest request) {
    String authHeader = request.getHeader(HttpHeaders.AUTHORIZATION);

    if (!StringUtils.hasText(authHeader) || !authHeader.startsWith(BEARER_PREFIX)) {
      log.debug("No Bearer token found in Authorization header");
      return null;
    }

    String token = authHeader.substring(BEARER_PREFIX.length()).trim();
    return extractClaimFromJwt(token, TENANT_CLAIM);
  }

  /**
   * Lightweight JWT payload decoder — Base64-decodes the second segment of the token and extracts
   * the given claim key without a full JWT library dependency.
   */
  private String extractClaimFromJwt(String jwt, String claimKey) {
    try {
      String[] parts = jwt.split("\\.");
      if (parts.length < 2) {
        log.warn("Malformed JWT — expected at least 2 segments, got {}", parts.length);
        return null;
      }

      // Base64url decode the payload (second segment)
      byte[] payloadBytes = Base64.getUrlDecoder().decode(padBase64(parts[1]));
      String payload = new String(payloadBytes, StandardCharsets.UTF_8);
      log.trace("JWT payload decoded: {}", payload);

      return extractJsonStringValue(payload, claimKey);

    } catch (IllegalArgumentException e) {
      log.warn("Failed to Base64-decode JWT payload: {}", e.getMessage());
      return null;
    } catch (Exception e) {
      log.error("Unexpected error parsing JWT payload", e);
      return null;
    }
  }

  /**
   * Extracts a JSON string value for the given key from a raw JSON payload string. Handles standard
   * {@code "key": "value"} patterns without a full JSON parser.
   */
  private String extractJsonStringValue(String json, String claimKey) {
    int keyIndex = json.indexOf(claimKey);
    if (keyIndex == -1) {
      return null;
    }

    // Move past the key and the colon separator
    int colonIndex = json.indexOf(':', keyIndex + claimKey.length());
    if (colonIndex == -1) {
      return null;
    }

    // Find the opening quote of the value
    int valueStart = json.indexOf('"', colonIndex + 1);
    if (valueStart == -1) {
      return null;
    }

    // Find the closing quote, skipping escaped quotes
    int valueEnd = json.indexOf('"', valueStart + 1);
    if (valueEnd == -1) {
      return null;
    }

    return json.substring(valueStart + 1, valueEnd);
  }

  /** Pads a Base64url string to a multiple of 4 characters, as required by the decoder. */
  private String padBase64(String base64) {
    int remainder = base64.length() % 4;
    if (remainder == 0) return base64;
    return base64 + "=".repeat(4 - remainder);
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
