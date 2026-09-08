package com.luminai.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.luminai.auth.dto.UserDto.CreateUserRequest;
import com.luminai.auth.dto.UserDto.CreateUserResponse;
import com.luminai.auth.keycloak.KeycloakAdminClient;
import com.luminai.auth.model.Tenant;
import com.luminai.auth.model.User;
import com.luminai.auth.repository.TenantRepository;
import com.luminai.auth.repository.UserRepository;
import com.luminai.common.exception.ConflictException;
import com.luminai.common.exception.ResourceNotFoundException;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class UserProvisioningServiceTest {

  @Mock private TenantRepository tenantRepository;
  @Mock private UserRepository userRepository;
  @Mock private KeycloakAdminClient keycloakAdminClient;

  private UserProvisioningService service;

  private Tenant activeTenant() {
    return new Tenant(UUID.randomUUID(), "Acme Corporation", "acme", "active");
  }

  @Test
  @DisplayName("creates the Keycloak account first, then links it to the tenant in public.users")
  void provisionsUserAgainstExistingTenant() {
    service = new UserProvisioningService(tenantRepository, userRepository, keycloakAdminClient);

    Tenant tenant = activeTenant();
    when(tenantRepository.findBySlug("acme")).thenReturn(Optional.of(tenant));
    when(userRepository.existsByTenantAndEmailIgnoreCase(tenant, "new.hire@acme.com"))
        .thenReturn(false);
    when(keycloakAdminClient.createUser("new.hire@acme.com", "New Hire")).thenReturn("kc-999");
    when(userRepository.save(any(User.class)))
        .thenAnswer(
            invocation -> {
              User u = invocation.getArgument(0);
              return new User(
                  UUID.randomUUID(),
                  u.getKeycloakId(),
                  u.getEmail(),
                  u.getFullName(),
                  u.getTenant(),
                  u.getRole(),
                  u.isActive());
            });

    CreateUserRequest request =
        new CreateUserRequest("acme", "new.hire@acme.com", "New Hire", "ADMIN");

    CreateUserResponse response = service.provisionUser(request);

    assertThat(response.tenantSlug()).isEqualTo("acme");
    assertThat(response.keycloakId()).isEqualTo("kc-999");
    assertThat(response.email()).isEqualTo("new.hire@acme.com");
    assertThat(response.role()).isEqualTo("ADMIN");

    verify(keycloakAdminClient).createUser("new.hire@acme.com", "New Hire");
    verify(keycloakAdminClient).sendSetPasswordEmail("kc-999");
  }

  @Test
  @DisplayName("rejects with ResourceNotFoundException when the tenant slug doesn't resolve")
  void rejectsUnknownTenant() {
    service = new UserProvisioningService(tenantRepository, userRepository, keycloakAdminClient);

    when(tenantRepository.findBySlug("ghost")).thenReturn(Optional.empty());

    CreateUserRequest request = new CreateUserRequest("ghost", "a@b.com", "A B", "VIEWER");

    assertThatThrownBy(() -> service.provisionUser(request))
        .isInstanceOf(ResourceNotFoundException.class);

    verify(keycloakAdminClient, never()).createUser(any(), any());
  }

  @Test
  @DisplayName("rejects with ResourceNotFoundException when the tenant is not active")
  void rejectsInactiveTenant() {
    service = new UserProvisioningService(tenantRepository, userRepository, keycloakAdminClient);

    Tenant suspended = new Tenant(UUID.randomUUID(), "Suspended Co", "suspended", "suspended");
    when(tenantRepository.findBySlug("suspended")).thenReturn(Optional.of(suspended));

    CreateUserRequest request = new CreateUserRequest("suspended", "a@b.com", "A B", "VIEWER");

    assertThatThrownBy(() -> service.provisionUser(request))
        .isInstanceOf(ResourceNotFoundException.class);

    verify(keycloakAdminClient, never()).createUser(any(), any());
  }

  @Test
  @DisplayName(
      "rejects with ConflictException without calling Keycloak when email is already used in-tenant")
  void rejectsDuplicateEmailInTenant() {
    service = new UserProvisioningService(tenantRepository, userRepository, keycloakAdminClient);

    Tenant tenant = activeTenant();
    when(tenantRepository.findBySlug("acme")).thenReturn(Optional.of(tenant));
    when(userRepository.existsByTenantAndEmailIgnoreCase(tenant, "dup@acme.com")).thenReturn(true);

    CreateUserRequest request = new CreateUserRequest("acme", "dup@acme.com", "Dup User", "VIEWER");

    assertThatThrownBy(() -> service.provisionUser(request)).isInstanceOf(ConflictException.class);

    verify(keycloakAdminClient, never()).createUser(any(), any());
    verify(userRepository, never()).save(any());
  }
}
