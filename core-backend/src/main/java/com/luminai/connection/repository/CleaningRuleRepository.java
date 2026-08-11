package com.luminai.connection.repository;

import com.luminai.connection.model.CleaningRule;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Spring Data JPA repository for {@link CleaningRule}. All query methods include {@code tenantId}
 * to enforce strict multi-tenant data isolation at the database query level.
 */
@Repository
public interface CleaningRuleRepository extends JpaRepository<CleaningRule, UUID> {

  /** Find all cleaning rules for a specific connector within a tenant, ordered by priority. */
  List<CleaningRule> findAllByConnectionIdAndTenantIdOrderByPriorityAsc(
      UUID connectionId, UUID tenantId);

  /** Find a single cleaning rule by ID, scoped to a tenant. */
  Optional<CleaningRule> findByIdAndTenantId(UUID id, UUID tenantId);

  /**
   * Delete a cleaning rule by ID, scoped to a tenant. Returns the count of deleted rows (0 or 1).
   */
  long deleteByIdAndTenantId(UUID id, UUID tenantId);
}
