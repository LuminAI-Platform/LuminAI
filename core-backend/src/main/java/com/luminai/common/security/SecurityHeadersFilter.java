package com.luminai.common.security;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Servlet filter that injects standard HTTP security headers and enforces CORS origin restriction.
 * Registered with HIGHEST_PRECEDENCE to run before Spring Security and other request-handling logic.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class SecurityHeadersFilter implements Filter {

  private static final String ALLOWED_ORIGIN = "http://localhost:5173";

  @Override
  public void init(FilterConfig filterConfig) throws ServletException {
    // No initialization needed
  }

  @Override
  public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
      throws IOException, ServletException {

    if (!(request instanceof HttpServletRequest req) || !(response instanceof HttpServletResponse res)) {
      chain.doFilter(request, response);
      return;
    }

    // 1. Inject Standard HTTP Security Headers
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

    // 2. CORS Origin Check & Header Injection
    String origin = req.getHeader("Origin");
    if (origin != null) {
      if (ALLOWED_ORIGIN.equals(origin)) {
        res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "*");
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Access-Control-Max-Age", "3600");
      } else {
        // Cross-origin request from a non-allowed origin: return 403 Forbidden
        res.setStatus(HttpServletResponse.SC_FORBIDDEN);
        res.setContentType("application/json");
        res.getWriter().write("{\"error\": \"Forbidden\", \"message\": \"CORS Policy: Origin not allowed.\"}");
        return;
      }
    }

    // 3. Handle OPTIONS preflight requests directly
    if ("OPTIONS".equalsIgnoreCase(req.getMethod())) {
      res.setStatus(HttpServletResponse.SC_OK);
      return;
    }

    chain.doFilter(request, response);
  }

  @Override
  public void destroy() {
    // No cleanup needed
  }
}
