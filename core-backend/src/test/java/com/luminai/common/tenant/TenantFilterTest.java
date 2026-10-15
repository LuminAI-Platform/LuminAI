package com.luminai.common.tenant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import java.io.IOException;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

class TenantFilterTest {

  private TenantResolutionService tenantResolutionService;
  private TenantFilter tenantFilter;

  @BeforeEach
  void setUp() {
    tenantResolutionService = mock(TenantResolutionService.class);
    tenantFilter = new TenantFilter(tenantResolutionService);
    TenantContext.clear();
    SecurityContextHolder.clearContext();
  }

  @AfterEach
  void tearDown() {
    TenantContext.clear();
    SecurityContextHolder.clearContext();
  }

  @Test
  @DisplayName("bypasses health and error endpoints without tenant resolution")
  void bypassesPublicEndpoints() throws ServletException, IOException {
    MockHttpServletRequest request = new MockHttpServletRequest("GET", "/actuator/health");
    MockHttpServletResponse response = new MockHttpServletResponse();
    FilterChain filterChain = mock(FilterChain.class);

    tenantFilter.doFilter(request, response, filterChain);

    verify(filterChain).doFilter(request, response);
    verifyNoInteractions(tenantResolutionService);
    assertThat(TenantContext.hasTenant()).isFalse();
  }

  @Test
  @DisplayName("resolves tenant from JWT principal and clears context in finally")
  void resolvesTenantSuccessfully() throws ServletException, IOException {
    MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/entities");
    MockHttpServletResponse response = new MockHttpServletResponse();

    UUID tenantId = UUID.randomUUID();
    when(tenantResolutionService.resolveForKeycloakUser("user-sub-123"))
        .thenReturn(Optional.of(new TenantResolutionService.ResolvedTenant(tenantId, "acme")));

    Jwt jwt =
        Jwt.withTokenValue("mock-token")
            .header("alg", "none")
            .subject("user-sub-123")
            .build();
    SecurityContextHolder.getContext()
        .setAuthentication(
            new JwtAuthenticationToken(
                jwt,
                java.util.List.of(
                    new org.springframework.security.core.authority.SimpleGrantedAuthority(
                        "ROLE_USER"))));

    FilterChain filterChain =
        (req, res) -> {
          // Inside the filter chain, tenant context must be actively set
          assertThat(TenantContext.hasTenant()).isTrue();
          assertThat(TenantContext.getTenantSlug()).isEqualTo("acme");
          assertThat(TenantContext.getTenantUuid()).isEqualTo(tenantId);
        };

    tenantFilter.doFilter(request, response, filterChain);

    // After the filter finishes, tenant context must be cleared to prevent thread leakage
    assertThat(TenantContext.hasTenant()).isFalse();
    assertThat(response.getStatus()).isEqualTo(200);
  }

  @Test
  @DisplayName("returns 401 when no authenticated principal is found on protected path")
  void returns401WhenUnauthenticated() throws ServletException, IOException {
    MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/entities");
    MockHttpServletResponse response = new MockHttpServletResponse();
    FilterChain filterChain = mock(FilterChain.class);

    tenantFilter.doFilter(request, response, filterChain);

    assertThat(response.getStatus()).isEqualTo(401);
    assertThat(response.getContentAsString()).contains("Authentication required");
    assertThat(TenantContext.hasTenant()).isFalse();
  }

  @Test
  @DisplayName("returns 403 when user has no active tenant associated")
  void returns403WhenNoTenantAssociated() throws ServletException, IOException {
    MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/entities");
    MockHttpServletResponse response = new MockHttpServletResponse();
    FilterChain filterChain = mock(FilterChain.class);

    when(tenantResolutionService.resolveForKeycloakUser("unknown-sub"))
        .thenReturn(Optional.empty());

    Jwt jwt =
        Jwt.withTokenValue("mock-token")
            .header("alg", "none")
            .subject("unknown-sub")
            .build();
    SecurityContextHolder.getContext()
        .setAuthentication(
            new JwtAuthenticationToken(
                jwt,
                java.util.List.of(
                    new org.springframework.security.core.authority.SimpleGrantedAuthority(
                        "ROLE_USER"))));

    tenantFilter.doFilter(request, response, filterChain);

    assertThat(response.getStatus()).isEqualTo(403);
    assertThat(response.getContentAsString()).contains("User is not associated with an active tenant");
    assertThat(TenantContext.hasTenant()).isFalse();
  }

  @Test
  @DisplayName("passes through when TenantContext is already populated (e.g. by API key)")
  void passesThroughWhenAlreadyPopulated() throws ServletException, IOException {
    MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/entities");
    MockHttpServletResponse response = new MockHttpServletResponse();
    FilterChain filterChain = mock(FilterChain.class);

    UUID tenantId = UUID.randomUUID();
    TenantContext.setTenant(tenantId, "api-tenant");

    tenantFilter.doFilter(request, response, filterChain);

    verify(filterChain).doFilter(request, response);
    verifyNoInteractions(tenantResolutionService);
  }
}
