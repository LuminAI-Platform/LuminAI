package com.luminai.connection.service;

import com.luminai.common.exception.ResourceNotFoundException;
import com.luminai.connection.dto.PipelineMetricsDto;
import com.luminai.connection.dto.PipelineRunDto;
import com.luminai.connection.model.ErCandidate.CandidateStatus;
import com.luminai.connection.model.Connection;
import com.luminai.connection.model.PipelineRun;
import com.luminai.connection.repository.ConnectionRepository;
import com.luminai.connection.repository.ErCandidateRepository;
import com.luminai.connection.repository.PipelineRunRepository;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Service for retrieving active and historical pipeline execution runs and summary metrics. */
@Service
@Transactional(readOnly = true)
public class PipelineMonitoringService {

  private final PipelineRunRepository pipelineRunRepository;
  private final ConnectionRepository connectionRepository;
  private final ErCandidateRepository erCandidateRepository;

  public PipelineMonitoringService(
          PipelineRunRepository pipelineRunRepository,
          ConnectionRepository connectionRepository,
          ErCandidateRepository erCandidateRepository) {
    this.pipelineRunRepository = pipelineRunRepository;
    this.connectionRepository = connectionRepository;
    this.erCandidateRepository = erCandidateRepository;
  }

  /**
   * Lists pipeline runs, optionally filtered by status, honoring the caller's page/size instead
   * of the top-50 window.
   */
  public Page<PipelineRunDto> listPipelineRuns(String statusFilter, Pageable pageable) {
    Page<PipelineRun> runs =
            (statusFilter != null && !statusFilter.isBlank() && !"ALL".equalsIgnoreCase(statusFilter))
                    ? pipelineRunRepository.findByStatus(statusFilter.toUpperCase(), pageable)
                    : pipelineRunRepository.findAllByOrderByStartedAtDesc(pageable);

    Map<UUID, Connection> connectionMap = loadConnectionsFor(runs);

    return runs.map(run -> toDto(run, connectionMap.get(run.getConnectionId())));
  }

  public PipelineRunDto getPipelineRunById(UUID id) {
    PipelineRun run =
            pipelineRunRepository
                    .findById(id)
                    .orElseThrow(() -> new ResourceNotFoundException("PipelineRun", id));

    Connection conn = connectionRepository.findById(run.getConnectionId()).orElse(null);
    return toDto(run, conn);
  }

  /**
   * Aggregates are computed in the database (SUM/COUNT queries), not by loading every run into
   * memory
   * <p>"Total entities resolved" is sourced from accepted merge candidates
   * ({@code ErCandidateRepository.countByStatus(ACCEPTED)}), not
   * {@code goldenRecordRepository.count()}
   */
  public PipelineMetricsDto getPipelineMetrics() {
    long totalCleaned = pipelineRunRepository.sumRecordsOutput();
    long totalFailed = pipelineRunRepository.sumRecordsFailed();
    long activeJobs = pipelineRunRepository.countByStatus("RUNNING");
    long totalResolved = erCandidateRepository.countByStatus(CandidateStatus.ACCEPTED);
    long totalRuns = pipelineRunRepository.count();

    return new PipelineMetricsDto(totalCleaned, totalResolved, activeJobs, totalFailed, totalRuns);
  }

  /**
   * Batch-fetches only the connections referenced by this page of runs
   */
  private Map<UUID, Connection> loadConnectionsFor(Page<PipelineRun> runs) {
    Set<UUID> connectionIds =
            runs.getContent().stream().map(PipelineRun::getConnectionId).collect(Collectors.toSet());
    if (connectionIds.isEmpty()) {
      return Map.of();
    }
    return connectionRepository.findAllById(connectionIds).stream()
            .collect(Collectors.toMap(Connection::getId, c -> c, (c1, c2) -> c1));
  }

  private PipelineRunDto toDto(PipelineRun run, Connection conn) {
    String name = conn != null ? conn.getName() : "Pipeline";
    String type = conn != null && conn.getType() != null ? conn.getType().name() : "Database";
    return PipelineRunDto.fromEntity(run, name, type);
  }
}