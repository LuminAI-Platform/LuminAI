package com.luminai.connection.service;

import com.luminai.common.exception.ResourceNotFoundException;
import com.luminai.connection.dto.PipelineMetricsDto;
import com.luminai.connection.dto.PipelineRunDto;
import com.luminai.connection.model.Connection;
import com.luminai.connection.model.PipelineRun;
import com.luminai.connection.repository.ConnectionRepository;
import com.luminai.connection.repository.GoldenRecordRepository;
import com.luminai.connection.repository.PipelineRunRepository;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Service for retrieving active and historical pipeline execution runs and summary metrics. */
@Service
@Transactional(readOnly = true)
public class PipelineMonitoringService {

  private final PipelineRunRepository pipelineRunRepository;
  private final ConnectionRepository connectionRepository;
  private final GoldenRecordRepository goldenRecordRepository;

  public PipelineMonitoringService(
      PipelineRunRepository pipelineRunRepository,
      ConnectionRepository connectionRepository,
      GoldenRecordRepository goldenRecordRepository) {
    this.pipelineRunRepository = pipelineRunRepository;
    this.connectionRepository = connectionRepository;
    this.goldenRecordRepository = goldenRecordRepository;
  }

  public List<PipelineRunDto> listPipelineRuns(String statusFilter) {
    List<PipelineRun> runs;
    if (statusFilter != null && !statusFilter.isBlank() && !"ALL".equalsIgnoreCase(statusFilter)) {
      Page<PipelineRun> page =
          pipelineRunRepository.findByStatus(
              statusFilter.toUpperCase(),
              PageRequest.of(0, 50, Sort.by(Sort.Direction.DESC, "startedAt")));
      runs = page.getContent();
    } else {
      runs = pipelineRunRepository.findTop50ByOrderByStartedAtDesc();
    }

    Map<UUID, Connection> connectionMap =
        connectionRepository.findAll().stream()
            .collect(Collectors.toMap(Connection::getId, c -> c, (c1, c2) -> c1));

    return runs.stream()
        .map(
            run -> {
              Connection conn = connectionMap.get(run.getConnectionId());
              String name = conn != null ? conn.getName() : "Pipeline";
              String type =
                  conn != null && conn.getType() != null ? conn.getType().name() : "Database";
              return PipelineRunDto.fromEntity(run, name, type);
            })
        .collect(Collectors.toList());
  }

  public PipelineRunDto getPipelineRunById(UUID id) {
    PipelineRun run =
        pipelineRunRepository
            .findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("PipelineRun", id));

    Connection conn = connectionRepository.findById(run.getConnectionId()).orElse(null);
    String name = conn != null ? conn.getName() : "Pipeline";
    String type = conn != null && conn.getType() != null ? conn.getType().name() : "Database";

    return PipelineRunDto.fromEntity(run, name, type);
  }

  public PipelineMetricsDto getPipelineMetrics() {
    List<PipelineRun> runs = pipelineRunRepository.findAll();

    long totalCleaned = runs.stream().mapToLong(PipelineRun::getRecordsOutput).sum();
    long totalFailed = runs.stream().mapToLong(PipelineRun::getRecordsFailed).sum();
    long activeJobs = pipelineRunRepository.countByStatus("RUNNING");
    long totalResolved = goldenRecordRepository.count();

    return new PipelineMetricsDto(
        totalCleaned, totalResolved, activeJobs, totalFailed, runs.size());
  }
}
