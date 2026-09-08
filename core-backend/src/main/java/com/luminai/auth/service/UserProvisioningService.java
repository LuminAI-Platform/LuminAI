package com.luminai.auth.service;

import com.luminai.auth.dto.UserDto.CreateUserRequest;
import com.luminai.auth.dto.UserDto.CreateUserResponse;
import com.luminai.auth.keycloak.KeycloakAdminClient;
import com.luminai.auth.model.Tenant;
import com.luminai.auth.model.User;
import com.luminai.auth.repository.TenantRepository;
import com.luminai.auth.repository.UserRepository;
import com.luminai.common.exception.ConflictException;
import com.luminai.common.exception.ResourceNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Provisions a brand-new LuminAI user for an existing tenant: creates their Keycloak account, then
 * links it to the tenant in {@code public.users}.
 *
 * <p>This is an internal, staff-triggered operation (see {@code InternalUserAdminController}) — it
 * assumes payment/contracting already happened out-of-band, and that the target tenant already
 * exists. It is the write-side counterpart to tenant resolution: where {@code
 * TenantResolutionService} reads the {@code users -> tenants} relationship to find out who someone
 * is, this service is what creates that relationship in the first place.
 */
@Service
public class UserProvisioningService {

  private static final Logger log = LoggerFactory.getLogger(UserProvisioningService.class);

  private final TenantRepository tenantRepository;
  private final UserRepository userRepository;
  private final KeycloakAdminClient keycloakAdminClient;

  public UserProvisioningService(
      TenantRepository tenantRepository,
      UserRepository userRepository,
      KeycloakAdminClient keycloakAdminClient) {
    this.tenantRepository = tenantRepository;
    this.userRepository = userRepository;
    this.keycloakAdminClient = keycloakAdminClient;
  }

  /**
   * Creates the Keycloak account and the {@code public.users} row for a new user of an existing
   * tenant, and triggers Keycloak's "set your password" email.
   *
   * @throws ResourceNotFoundException if no active tenant matches {@code request.tenantSlug()}.
   * @throws ConflictException if a user with this email already exists for the tenant, or if
   *     Keycloak already has an account with this email/username.
   */
  @Transactional
  public CreateUserResponse provisionUser(CreateUserRequest request) {
    Tenant tenant =
        tenantRepository
            .findBySlug(request.tenantSlug())
            .filter(Tenant::isActive)
            .orElseThrow(
                () -> new ResourceNotFoundException("Active tenant", "slug", request.tenantSlug()));

    if (userRepository.existsByTenantAndEmailIgnoreCase(tenant, request.email())) {
      throw new ConflictException(
          "A user with email '"
              + request.email()
              + "' already exists for tenant '"
              + request.tenantSlug()
              + "'");
    }

    // Keycloak is the source of truth for the identity; create it there first so we never
    // persist a public.users row that doesn't have a corresponding, real Keycloak account.
    String keycloakId = keycloakAdminClient.createUser(request.email(), request.fullName());

    User user =
        new User(
            null, keycloakId, request.email(), request.fullName(), tenant, request.role(), true);
    User saved = userRepository.save(user);

    log.info(
        "Provisioned user '{}' (keycloak_id={}) for tenant '{}' with role '{}'",
        saved.getEmail(),
        saved.getKeycloakId(),
        tenant.getSlug(),
        saved.getRole());

    // Best-effort: the account already exists and is usable even if this fails (see
    // KeycloakAdminClient#sendSetPasswordEmail for why this doesn't roll back the transaction).
    keycloakAdminClient.sendSetPasswordEmail(keycloakId);

    return new CreateUserResponse(
        saved.getId(),
        tenant.getId(),
        tenant.getSlug(),
        saved.getKeycloakId(),
        saved.getEmail(),
        saved.getRole(),
        "User created. They will receive an email to set their password and sign in.");
  }
}
