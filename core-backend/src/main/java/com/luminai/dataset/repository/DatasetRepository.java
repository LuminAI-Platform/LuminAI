package com.luminai.dataset.repository;

import com.luminai.dataset.model.Dataset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DatasetRepository extends JpaRepository<Dataset, UUID> {
  List<Dataset> findAllByTenantIdOrderByUpdatedAtDesc(UUID tenantId);

  List<Dataset> findAllByTenantIdAndLayerOrderByUpdatedAtDesc(UUID tenantId, Dataset.Layer layer);

  List<Dataset> findAllByTenantIdAndProjectTypeOrderByUpdatedAtDesc(
      UUID tenantId, Dataset.ProjectType projectType);

  Optional<Dataset> findByIdAndTenantId(UUID id, UUID tenantId);

  Optional<Dataset> findByNameAndTenantId(String name, UUID tenantId);

  Optional<Dataset> findBySourceConnectionIdAndNameAndTenantId(
      UUID sourceConnectionId, String name, UUID tenantId);

  Optional<Dataset> findBySourceConnectionIdAndTenantId(UUID sourceConnectionId, UUID tenantId);

  boolean existsByNameAndTenantId(String name, UUID tenantId);

  void deleteByIdAndTenantId(UUID id, UUID tenantId);
}
