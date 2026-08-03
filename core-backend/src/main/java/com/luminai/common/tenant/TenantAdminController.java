package com.luminai.common.tenant;

import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Admin endpoint for provisioning new tenant schemas. Requires authentication. */
@RestController
@RequestMapping("/api/v1/admin/tenants")
public class TenantAdminController {

  private static final Logger log = LoggerFactory.getLogger(TenantAdminController.class);

  private final TenantProvisioningService provisioningService;

  public TenantAdminController(TenantProvisioningService provisioningService) {
    this.provisioningService = provisioningService;
  }

  @PostMapping
  public ResponseEntity<?> provisionTenant(@RequestBody TenantRequest request) {
    log.info("Tenant provisioning request: name='{}', slug='{}'", request.name(), request.slug());

    if (request.name() == null || request.name().isBlank()) {
      return ResponseEntity.badRequest().body(Map.of("error", "Tenant name is required"));
    }
    if (request.slug() == null || request.slug().isBlank()) {
      return ResponseEntity.badRequest().body(Map.of("error", "Tenant slug is required"));
    }

    // Check if already provisioned
    if (provisioningService.schemaExists(request.slug())) {
      return ResponseEntity.status(HttpStatus.CONFLICT)
          .body(Map.of("error", "Tenant schema already exists for slug: " + request.slug()));
    }

    try {
      UUID tenantId = provisioningService.provisionTenant(request.name(), request.slug());
      return ResponseEntity.status(HttpStatus.CREATED)
          .body(
              Map.of(
                  "id", tenantId.toString(),
                  "name", request.name(),
                  "slug", request.slug(),
                  "schema", TenantContext.SCHEMA_PREFIX + request.slug(),
                  "status", "active"));
    } catch (IllegalArgumentException e) {
      return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    } catch (TenantProvisioningService.TenantProvisioningException e) {
      log.error("Tenant provisioning failed", e);
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body(Map.of("error", "Tenant provisioning failed: " + e.getMessage()));
    }
  }

  /** Request body for tenant provisioning. */
  public record TenantRequest(String name, String slug) {}
}
