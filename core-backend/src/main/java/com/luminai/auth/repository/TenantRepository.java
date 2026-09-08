package com.luminai.auth.repository;

import com.luminai.auth.model.Tenant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** Spring Data JPA repository for {@link Tenant} (maps to {@code public.tenants}). */
@Repository
public interface TenantRepository extends JpaRepository<Tenant, UUID> {

  /** Finds a tenant by its URL-safe slug (schema suffix). */
  Optional<Tenant> findBySlug(String slug);
}
