package com.luminai.connection.repository;

import com.luminai.connection.model.PipelineRun;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Access to {@link PipelineRun} entities. Schema-based multi-tenancy is handled via TenantContext &
 * Hibernate schema routing.
 */
public interface PipelineRunRepository extends JpaRepository<PipelineRun, UUID> {

  List<PipelineRun> findByConnectionId(UUID connectionId);

  Page<PipelineRun> findByStatus(String status, Pageable pageable);

  List<PipelineRun> findTop50ByOrderByStartedAtDesc();

  long countByStatus(String status);
}
