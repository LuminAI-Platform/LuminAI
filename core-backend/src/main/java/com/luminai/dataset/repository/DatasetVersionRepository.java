package com.luminai.dataset.repository;

import com.luminai.dataset.model.DatasetVersion;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DatasetVersionRepository extends JpaRepository<DatasetVersion, UUID> {
  List<DatasetVersion> findAllByDatasetIdAndTenantIdOrderByVersionDesc(
      UUID datasetId, UUID tenantId);

  Optional<DatasetVersion> findByDatasetIdAndVersionAndTenantId(
      UUID datasetId, int version, UUID tenantId);

  void deleteByDatasetIdAndTenantId(UUID datasetId, UUID tenantId);
}
