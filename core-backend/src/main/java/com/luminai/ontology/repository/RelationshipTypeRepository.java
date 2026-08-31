package com.luminai.ontology.repository;

import com.luminai.ontology.model.RelationshipType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RelationshipTypeRepository extends JpaRepository<RelationshipType, UUID> {

  List<RelationshipType> findAllByTenantIdOrderByNameAsc(UUID tenantId);

  Optional<RelationshipType> findByIdAndTenantId(UUID id, UUID tenantId);

  Optional<RelationshipType> findByNameIgnoreCaseAndTenantId(String name, UUID tenantId);

  boolean existsByNameIgnoreCaseAndTenantId(String name, UUID tenantId);

  long deleteByIdAndTenantId(UUID id, UUID tenantId);

  List<RelationshipType> findAllByTenantIdAndSourceEntityTypeIdOrTenantIdAndTargetEntityTypeId(
      UUID tenantId1, UUID sourceId, UUID tenantId2, UUID targetId);
}
