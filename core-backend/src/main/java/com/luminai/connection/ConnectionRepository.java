package com.luminai.connection;

import com.luminai.connection.model.Connection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Spring Data JPA repository for {@link Connection}.
 *
 * <p>All query methods include {@code tenantId} to enforce strict multi-tenant data isolation at
 * the database query level.
 */
@Repository
public interface ConnectionRepository extends JpaRepository<Connection, UUID> {

  /** Find all connection entries belonging to a specific tenant. */
  List<Connection> findAllByTenantId(UUID tenantId);

  /** Find a single connection by ID, scoped to a specific tenant. */
  Optional<Connection> findByIdAndTenantId(UUID id, UUID tenantId);

  /** Delete a connection by ID, scoped to a specific tenant. Returns count of deleted rows. */
  long deleteByIdAndTenantId(UUID id, UUID tenantId);
}
