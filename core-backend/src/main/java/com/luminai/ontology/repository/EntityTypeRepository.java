package com.luminai.ontology.repository;

import com.luminai.ontology.model.EntityType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface EntityTypeRepository extends JpaRepository<EntityType, UUID> {

  List<EntityType> findAllByTenantIdOrderByNameAsc(UUID tenantId);

  Optional<EntityType> findByIdAndTenantId(UUID id, UUID tenantId);

  Optional<EntityType> findByNameIgnoreCaseAndTenantId(String name, UUID tenantId);

  boolean existsByNameIgnoreCaseAndTenantId(String name, UUID tenantId);

  long deleteByIdAndTenantId(UUID id, UUID tenantId);
}
