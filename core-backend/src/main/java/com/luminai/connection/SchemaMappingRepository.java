package com.luminai.connection;

import com.luminai.connection.model.SchemaMapping;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Spring Data JPA repository for {@link SchemaMapping}.
 *
 * <p>All query methods include {@code tenantId} to enforce strict multi-tenant data isolation at
 * the database query level.
 */
@Repository
public interface SchemaMappingRepository extends JpaRepository<SchemaMapping, UUID> {

  /** Find all schema mappings belonging to a specific tenant. */
  List<SchemaMapping> findAllByTenantId(UUID tenantId);

  /** Find a single schema mapping by ID, scoped to a tenant. */
  Optional<SchemaMapping> findByIdAndTenantId(UUID id, UUID tenantId);

  /** Find all schema mappings for a specific connector within a tenant. */
  List<SchemaMapping> findAllByConnectorIdAndTenantId(UUID connectorId, UUID tenantId);

  /**
   * Delete a schema mapping by ID, scoped to a tenant. Returns the count of deleted rows (0 or 1).
   */
  long deleteByIdAndTenantId(UUID id, UUID tenantId);
}
