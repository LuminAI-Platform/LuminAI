package com.luminai.common.tenant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.luminai.auth.model.Tenant;
import com.luminai.auth.model.User;
import com.luminai.auth.repository.UserRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TenantResolutionServiceTest {

  @Mock private UserRepository userRepository;

  @Test
  @DisplayName("resolves tenant slug and id for an active user with an active tenant")
  void resolvesActiveUserAndTenant() {
    TenantResolutionService svc = new TenantResolutionService(userRepository);
    UUID tenantId = UUID.randomUUID();
    Tenant tenant = new Tenant(tenantId, "Acme Corporation", "acme", "active");
    User user =
        new User(UUID.randomUUID(), "kc-123", "a@acme.com", "A User", tenant, "ADMIN", true);
    when(userRepository.findByKeycloakId("kc-123")).thenReturn(Optional.of(user));

    Optional<TenantResolutionService.ResolvedTenant> result = svc.resolveForKeycloakUser("kc-123");

    assertThat(result).isPresent();
    assertThat(result.get().tenantId()).isEqualTo(tenantId);
    assertThat(result.get().slug()).isEqualTo("acme");
  }

  @Test
  @DisplayName("rejects (does not default) when no user matches the keycloak subject")
  void rejectsWhenNoUserFound() {
    TenantResolutionService svc = new TenantResolutionService(userRepository);
    when(userRepository.findByKeycloakId("unknown-sub")).thenReturn(Optional.empty());

    Optional<TenantResolutionService.ResolvedTenant> result =
        svc.resolveForKeycloakUser("unknown-sub");

    assertThat(result).isEmpty();
  }

  @Test
  @DisplayName("rejects when the matched user is deactivated")
  void rejectsWhenUserDeactivated() {
    TenantResolutionService svc = new TenantResolutionService(userRepository);
    Tenant tenant = new Tenant(UUID.randomUUID(), "Acme Corporation", "acme", "active");
    User inactiveUser =
        new User(UUID.randomUUID(), "kc-123", "a@acme.com", "A User", tenant, "VIEWER", false);
    when(userRepository.findByKeycloakId("kc-123")).thenReturn(Optional.of(inactiveUser));

    Optional<TenantResolutionService.ResolvedTenant> result = svc.resolveForKeycloakUser("kc-123");

    assertThat(result).isEmpty();
  }

  @Test
  @DisplayName("rejects when the user's tenant is not active")
  void rejectsWhenTenantNotActive() {
    TenantResolutionService svc = new TenantResolutionService(userRepository);
    Tenant suspendedTenant =
        new Tenant(UUID.randomUUID(), "Suspended Co", "suspended-co", "suspended");
    User user =
        new User(
            UUID.randomUUID(), "kc-123", "a@x.com", "A User", suspendedTenant, "VIEWER", true);
    when(userRepository.findByKeycloakId("kc-123")).thenReturn(Optional.of(user));

    Optional<TenantResolutionService.ResolvedTenant> result = svc.resolveForKeycloakUser("kc-123");

    assertThat(result).isEmpty();
  }

  @Test
  @DisplayName("rejects a blank subject without querying the repository")
  void rejectsBlankSubjectWithoutQuerying() {
    TenantResolutionService svc = new TenantResolutionService(userRepository);

    assertThat(svc.resolveForKeycloakUser("")).isEmpty();
    assertThat(svc.resolveForKeycloakUser(null)).isEmpty();
    verifyNoInteractions(userRepository);
  }

  @Test
  @DisplayName("queries by exactly the JWT subject, never a claim-derived tenant id")
  void queriesByKeycloakSubject() {
    TenantResolutionService svc = new TenantResolutionService(userRepository);
    when(userRepository.findByKeycloakId("some-sub")).thenReturn(Optional.empty());

    svc.resolveForKeycloakUser("some-sub");

    verify(userRepository).findByKeycloakId("some-sub");
  }
}

