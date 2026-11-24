package com.luminai.connection.repository;

import com.luminai.connection.model.PipelineRun;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Access to {@link PipelineRun} entities. Schema-based multi-tenancy is handled via TenantContext &
 * Hibernate schema routing.
 */
public interface PipelineRunRepository
    extends JpaRepository<PipelineRun, UUID>, JpaSpecificationExecutor<PipelineRun> {

  List<PipelineRun> findByConnectionId(UUID connectionId);

  Page<PipelineRun> findByStatus(PipelineRun.PipelineRunStatus status, Pageable pageable);

  Page<PipelineRun> findAllByOrderByStartedAtDesc(Pageable pageable);

  long countByStatus(PipelineRun.PipelineRunStatus status);

  @Query("select coalesce(sum(p.recordsOutput), 0) from PipelineRun p")
  long sumRecordsOutput();

  @Query("select coalesce(sum(p.recordsFailed), 0) from PipelineRun p")
  long sumRecordsFailed();

  @Query("select count(p) from PipelineRun p where p.startedAt >= :start and p.startedAt < :end")
  long countByStartedAtBetween(
      @Param("start") java.time.Instant start, @Param("end") java.time.Instant end);

  @Query("select p.startedAt from PipelineRun p where p.startedAt >= :start")
  List<java.time.Instant> findStartedAtSince(@Param("start") java.time.Instant start);

  @Query(
      "select p.startedAt from PipelineRun p where p.startedAt >= :start and (:connectionId is null or p.connectionId = :connectionId)")
  List<java.time.Instant> findStartedAtSinceAndConnectionId(
      @Param("start") java.time.Instant start, @Param("connectionId") UUID connectionId);
}
