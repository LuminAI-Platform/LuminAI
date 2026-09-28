package com.luminai.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.luminai.auth.controller.ApiKeyController;
import com.luminai.auth.dto.ApiKeyDto;
import com.luminai.auth.dto.ApiKeyRotateResponse;
import com.luminai.auth.service.ApiKeyService;
import com.luminai.common.tenant.TenantContext;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

class ApiKeyControllerTest {

  private ApiKeyService apiKeyService;
  private ApiKeyController apiKeyController;
  private UUID tenantId;

  @BeforeEach
  void setUp() {
    apiKeyService = mock(ApiKeyService.class);
    apiKeyController = new ApiKeyController(apiKeyService);
    tenantId = UUID.randomUUID();
    TenantContext.setTenant(tenantId, "test-corp");
  }

  @AfterEach
  void tearDown() {
    TenantContext.clear();
  }

  @Test
  @DisplayName("GET /api/v1/settings/api-keys returns active key metadata")
  void getActiveApiKeySuccess() {
    ApiKeyDto mockDto =
        new ApiKeyDto(
            UUID.randomUUID(), "Production Key", "lum_live_12345678", Instant.now(), null, true);
    when(apiKeyService.getActiveApiKey(tenantId)).thenReturn(Optional.of(mockDto));

    ResponseEntity<?> response = apiKeyController.getActiveApiKey();
    assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();

    @SuppressWarnings("unchecked")
    Map<String, Object> body = (Map<String, Object>) response.getBody();
    assertThat(body).isNotNull();
    assertThat(body.get("hasKey")).isEqualTo(true);
    assertThat(body.get("key")).isEqualTo(mockDto);
  }

  @Test
  @DisplayName("POST /api/v1/settings/api-keys/rotate rotates key and returns token")
  void rotateApiKeySuccess() {
    ApiKeyRotateResponse mockRotate =
        new ApiKeyRotateResponse(
            UUID.randomUUID(),
            "lum_live_abcd1234efgh5678ijkl9012mnop3456",
            "lum_live_abcd1234",
            "Production Key",
            Instant.now());
    when(apiKeyService.rotateApiKey(eq(tenantId), any())).thenReturn(mockRotate);

    ResponseEntity<ApiKeyRotateResponse> response =
        apiKeyController.rotateApiKey(Map.of("name", "Production Key"));

    assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
    assertThat(response.getBody()).isNotNull();
    assertThat(response.getBody().apiKey()).startsWith("lum_live_");
    assertThat(response.getBody().keyPrefix()).isEqualTo("lum_live_abcd1234");
  }
}
