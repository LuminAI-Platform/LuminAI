package com.luminai.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.luminai.auth.controller.AuthController;
import com.luminai.common.tenant.TenantContext;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

class AuthControllerTest {

  private AuthController authController;
  private UUID tenantId;

  @BeforeEach
  void setUp() {
    authController = new AuthController();
    tenantId = UUID.randomUUID();
    TenantContext.setTenant(tenantId, "test-corp");
  }

  @AfterEach
  void tearDown() {
    TenantContext.clear();
  }

  @Test
  @DisplayName("GET /api/v1/auth/me returns mapped user profile, claims, and tenant context")
  void getCurrentUserSuccess() {
    Jwt mockJwt = mock(Jwt.class);
    when(mockJwt.getSubject()).thenReturn("usr_test_123");
    when(mockJwt.getClaimAsString("email")).thenReturn("operator@corp.io");
    when(mockJwt.getClaimAsString("preferred_username")).thenReturn("operator_one");
    when(mockJwt.getClaimAsMap("realm_access"))
        .thenReturn(Map.of("roles", java.util.List.of("ADMIN")));

    Map<String, Object> result = authController.getCurrentUser(mockJwt);

    assertThat(result).isNotNull();
    assertThat(result.get("userId")).isEqualTo("usr_test_123");
    assertThat(result.get("email")).isEqualTo("operator@corp.io");
    assertThat(result.get("name")).isEqualTo("operator_one");
    assertThat(result.get("tenantId")).isEqualTo(tenantId.toString());
    assertThat(result.get("tenantSlug")).isEqualTo("test-corp");
  }
}
