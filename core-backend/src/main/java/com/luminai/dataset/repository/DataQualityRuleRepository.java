package com.luminai.dataset.repository;

import com.luminai.dataset.model.DataQualityRule;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DataQualityRuleRepository extends JpaRepository<DataQualityRule, UUID> {
  List<DataQualityRule> findAllByTenantId(UUID tenantId);

  List<DataQualityRule> findAllByTenantIdAndDatasetId(UUID tenantId, UUID datasetId);

  Optional<DataQualityRule> findByIdAndTenantId(UUID id, UUID tenantId);

  void deleteByIdAndTenantId(UUID id, UUID tenantId);

  void deleteByDatasetIdAndTenantId(UUID datasetId, UUID tenantId);
}
