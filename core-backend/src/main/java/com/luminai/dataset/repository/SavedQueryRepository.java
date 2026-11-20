package com.luminai.dataset.repository;

import com.luminai.dataset.model.SavedQuery;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SavedQueryRepository extends JpaRepository<SavedQuery, UUID> {
  List<SavedQuery> findAllByTenantIdOrderByUpdatedAtDesc(UUID tenantId);
  List<SavedQuery> findAllByTenantIdAndDatasetId(UUID tenantId, UUID datasetId);
  Optional<SavedQuery> findByIdAndTenantId(UUID id, UUID tenantId);
  void deleteByIdAndTenantId(UUID id, UUID tenantId);
}
