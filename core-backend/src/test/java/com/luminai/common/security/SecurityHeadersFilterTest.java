package com.luminai.common.security;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.PrintWriter;
import java.io.StringWriter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SecurityHeadersFilterTest {

  private SecurityHeadersFilter filter;
  private HttpServletRequest request;
  private HttpServletResponse response;
  private FilterChain chain;

  @BeforeEach
  void setUp() {
    filter = new SecurityHeadersFilter();
    request = mock(HttpServletRequest.class);
    response = mock(HttpServletResponse.class);
    chain = mock(FilterChain.class);
  }

  @Test
  void testSecurityHeadersInjected() throws Exception {
    filter.doFilter(request, response, chain);

    verify(response).setHeader("X-Content-Type-Options", "nosniff");
    verify(response).setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    verify(response).setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    verify(response).setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    verify(chain).doFilter(request, response);
  }

  @Test
  void testAllowedCorsOrigin() throws Exception {
    when(request.getHeader("Origin")).thenReturn("http://localhost:5173");

    filter.doFilter(request, response, chain);

    verify(response).setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
    verify(response).setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    verify(response).setHeader("Access-Control-Allow-Credentials", "true");
    verify(chain).doFilter(request, response);
  }

  @Test
  void testForbiddenCorsOrigin() throws Exception {
    when(request.getHeader("Origin")).thenReturn("http://malicious.com");
    StringWriter out = new StringWriter();
    PrintWriter writer = new PrintWriter(out);
    when(response.getWriter()).thenReturn(writer);

    filter.doFilter(request, response, chain);

    verify(response).setStatus(HttpServletResponse.SC_FORBIDDEN);
    verify(chain, never()).doFilter(request, response);
    assertTrue(out.toString().contains("Origin not allowed"));
  }

  @Test
  void testOptionsRequestShortCircuit() throws Exception {
    when(request.getMethod()).thenReturn("OPTIONS");

    filter.doFilter(request, response, chain);

    verify(response).setStatus(HttpServletResponse.SC_OK);
    verify(chain, never()).doFilter(request, response);
  }
}
