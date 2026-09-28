package com.luminai.auth.controller;

import com.luminai.auth.dto.ApiKeyDto;
import com.luminai.auth.dto.ApiKeyRotateResponse;
import com.luminai.auth.service.ApiKeyService;
import com.luminai.common.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Controller for tenant API key management and rotation. */
@RestController
@RequestMapping("/api/v1/settings/api-keys")
@Tag(name = "Settings", description = "Tenant system settings and API key management")
public class ApiKeyController {

  private final ApiKeyService apiKeyService;

  public ApiKeyController(ApiKeyService apiKeyService) {
    this.apiKeyService = apiKeyService;
  }

  @Operation(
      summary = "Get Active API Key",
      description =
          "Retrieves the active API key metadata (prefix, creation date) for the current tenant.")
  @GetMapping
  public ResponseEntity<?> getActiveApiKey() {
    UUID tenantId = TenantContext.getTenantUuid();
    Optional<ApiKeyDto> activeKey = apiKeyService.getActiveApiKey(tenantId);
    if (activeKey.isEmpty()) {
      return ResponseEntity.ok(Map.of("hasKey", false));
    }
    return ResponseEntity.ok(Map.of("hasKey", true, "key", activeKey.get()));
  }

  @Operation(
      summary = "Rotate API Key",
      description =
          "Generates a new cryptographically secure API key and revokes existing keys for the tenant.")
  @PostMapping("/rotate")
  public ResponseEntity<ApiKeyRotateResponse> rotateApiKey(
      @RequestBody(required = false) Map<String, String> body) {
    UUID tenantId = TenantContext.getTenantUuid();
    String keyName = (body != null) ? body.get("name") : "Production Live Key";
    ApiKeyRotateResponse response = apiKeyService.rotateApiKey(tenantId, keyName);
    return ResponseEntity.ok(response);
  }
}
