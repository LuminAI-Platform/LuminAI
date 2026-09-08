package com.luminai.auth.repository;

import com.luminai.auth.model.Tenant;
import com.luminai.auth.model.User;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** Spring Data JPA repository for {@link User} (maps to {@code public.users}). */
@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

  /**
   * Finds the LuminAI user linked to a given Keycloak identity ({@code sub} claim). This is the
   * entry point for tenant resolution: Keycloak identifies the user, this lookup identifies their
   * tenant.
   */
  Optional<User> findByKeycloakId(String keycloakId);

  /** Used by provisioning to avoid creating a second user with the same email in one tenant. */
  boolean existsByTenantAndEmailIgnoreCase(Tenant tenant, String email);
}
