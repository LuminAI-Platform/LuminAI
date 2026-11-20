package com.luminai.dataset.repository;

import com.luminai.dataset.model.MlModel;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MlModelRepository extends JpaRepository<MlModel, UUID> {
  List<MlModel> findAllByTenantIdOrderByUpdatedAtDesc(UUID tenantId);

  List<MlModel> findAllByTenantIdAndStatus(UUID tenantId, String status);

  Optional<MlModel> findByIdAndTenantId(UUID id, UUID tenantId);
}
