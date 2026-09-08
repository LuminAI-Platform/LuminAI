package com.luminai.auth.controller;

import com.luminai.auth.dto.UserDto.CreateUserRequest;
import com.luminai.auth.dto.UserDto.CreateUserResponse;
import com.luminai.auth.service.UserProvisioningService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Internal, staff-only endpoint for provisioning a new user against an existing tenant.
 *
 * <p>This is <strong>not</strong> a public sign-up endpoint. LuminAI's business model handles
 * payment/contracting out-of-band; by the time this is called, that has already happened, and a
 * member of the LuminAI team is entering the customer's details to create their account. The caller
 * must hold the {@code PLATFORM_ADMIN} realm role in Keycloak — an internal-staff role, distinct
 * from any customer-facing {@code TENANT_ADMIN} role.
 *
 * <p>Deliberately routed under {@code /api/v1/internal/} and excluded from {@code TenantFilter}'s
 * tenant resolution (see its {@code BYPASS_PATHS}): this operation targets an arbitrary,
 * explicitly-named tenant, and the caller (LuminAI staff) has no customer tenant of their own to
 * resolve.
 */
@RestController
@RequestMapping("/api/v1/internal/users")
public class UserAdminController {

  private static final Logger log = LoggerFactory.getLogger(UserAdminController.class);

  private final UserProvisioningService userProvisioningService;

  public UserAdminController(UserProvisioningService userProvisioningService) {
    this.userProvisioningService = userProvisioningService;
  }

  @PostMapping
  @PreAuthorize("hasRole('PLATFORM_ADMIN')")
  public ResponseEntity<CreateUserResponse> createUser(
      @Valid @RequestBody CreateUserRequest request) {
    log.info(
        "Internal user provisioning request: tenantSlug='{}', email='{}'",
        request.tenantSlug(),
        request.email());

    CreateUserResponse response = userProvisioningService.provisionUser(request);
    return ResponseEntity.status(HttpStatus.CREATED).body(response);
  }
}
