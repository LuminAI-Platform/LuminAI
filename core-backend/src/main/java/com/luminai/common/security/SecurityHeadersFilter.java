package com.luminai.common.security;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Servlet filter that injects standard HTTP security headers and enforces CORS origin restriction.
 * Registered with HIGHEST_PRECEDENCE to run before Spring Security and other request-handling
 * logic.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class SecurityHeadersFilter implements Filter {

  private static final List<String> DEFAULT_ALLOWED_PATTERNS =
      List.of(
          "http://localhost:*",
          "http://localhost",
          "http://127.0.0.1:*",
          "http://127.0.0.1",
          "https://*.vercel.app",
          "https://*.onrender.com",
          "https://*.luminai.com",
          "https://*.luminai.dev");

  @Override
  public void init(FilterConfig filterConfig) throws ServletException {
    // No initialization needed
  }

  @Override
  public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
      throws IOException, ServletException {

    if (!(request instanceof HttpServletRequest req)
        || !(response instanceof HttpServletResponse res)) {
      chain.doFilter(request, response);
      return;
    }

    // Inject Standard HTTP Security Headers
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-XSS-Protection", "0");
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

    // CORS Origin Check & Header Injection
    String origin = req.getHeader("Origin");
    if (origin != null) {
      if (isAllowedOrigin(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "*");
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Access-Control-Max-Age", "3600");
      } else {
        // Cross-origin request from a non-allowed origin: return 403 Forbidden
        res.setStatus(HttpServletResponse.SC_FORBIDDEN);
        res.setContentType("application/json");
        res.getWriter()
            .write("{\"error\": \"Forbidden\", \"message\": \"CORS Policy: Origin not allowed.\"}");
        return;
      }
    }

    // Handle OPTIONS preflight requests directly
    if ("OPTIONS".equalsIgnoreCase(req.getMethod())) {
      res.setStatus(HttpServletResponse.SC_OK);
      return;
    }

    chain.doFilter(request, response);
  }

  boolean isAllowedOrigin(String origin) {
    if (origin == null || origin.isBlank()) {
      return false;
    }

    String envOrigins = System.getenv("CORS_ALLOWED_ORIGINS");
    if (envOrigins != null && !envOrigins.isBlank()) {
      for (String allowed : envOrigins.split(",")) {
        String trimmed = allowed.trim();
        if (trimmed.equals("*") || matchesPattern(origin, trimmed)) {
          return true;
        }
      }
    }

    for (String pattern : DEFAULT_ALLOWED_PATTERNS) {
      if (matchesPattern(origin, pattern)) {
        return true;
      }
    }

    return false;
  }

  private boolean matchesPattern(String origin, String pattern) {
    if (pattern.equalsIgnoreCase(origin)) {
      return true;
    }
    if (pattern.contains("*")) {
      String regex = "\\Q" + pattern.replace("*", "\\E.*\\Q") + "\\E";
      return origin.matches("(?i)" + regex);
    }
    return false;
  }

  @Override
  public void destroy() {
    // No cleanup needed
  }
}
