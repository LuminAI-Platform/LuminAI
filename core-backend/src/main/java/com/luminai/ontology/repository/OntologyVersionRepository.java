package com.luminai.ontology.repository;

import com.luminai.ontology.model.OntologyVersion;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface OntologyVersionRepository extends JpaRepository<OntologyVersion, UUID> {

  List<OntologyVersion> findAllByTenantIdOrderByCreatedAtDesc(UUID tenantId);

  Optional<OntologyVersion> findByIdAndTenantId(UUID id, UUID tenantId);

  Optional<OntologyVersion> findByTenantIdAndVersion(UUID tenantId, String version);

  Optional<OntologyVersion> findFirstByTenantIdAndStatusOrderByPublishedAtDesc(
      UUID tenantId, OntologyVersion.Status status);
}
