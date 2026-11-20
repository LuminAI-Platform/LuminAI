package com.luminai.dataset.repository;

import com.luminai.dataset.model.DatasetLineage;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DatasetLineageRepository extends JpaRepository<DatasetLineage, UUID> {
  List<DatasetLineage> findAllByTenantId(UUID tenantId);

  List<DatasetLineage> findAllByTenantIdAndSourceDatasetId(UUID tenantId, UUID sourceDatasetId);

  List<DatasetLineage> findAllByTenantIdAndTargetDatasetId(UUID tenantId, UUID targetDatasetId);
}
