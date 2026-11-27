package com.luminai.connection.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.luminai.connection.model.PipelineRun;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** DTO for Pipeline execution run details with multi-stage metrics. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record PipelineRunDto(
    UUID id,
    UUID connectionId,
    String connectorName,
    String connectorType,
    String pipelineType,
    String status,
    double progress,
    long recordsInput,
    long recordsOutput,
    long recordsFailed,
    long recordsQuarantined,
    long recordsRejected,
    UUID datasetId,
    List<StageMetricDto> stages,
    double throughput,
    Instant startedAt,
    Instant completedAt,
    Long durationSeconds,
    String errorMessage,
    String metadata,
    Instant createdAt) {

  public record StageMetricDto(
      String stage,
      String label,
      long recordsIn,
      long recordsOut,
      long dropped,
      long durationSeconds) {}

  public PipelineRunDto(
      UUID id,
      UUID connectionId,
      String connectorName,
      String connectorType,
      String pipelineType,
      String status,
      double progress,
      long recordsInput,
      long recordsOutput,
      long recordsFailed,
      double throughput,
      Instant startedAt,
      Instant completedAt,
      long durationSeconds,
      String errorMessage,
      String metadata,
      Instant createdAt) {
    this(
        id,
        connectionId,
        connectorName,
        connectorType,
        pipelineType,
        status,
        progress,
        recordsInput,
        recordsOutput,
        recordsFailed,
        0L,
        recordsFailed,
        null,
        List.of(),
        throughput,
        startedAt,
        completedAt,
        durationSeconds,
        errorMessage,
        metadata,
        createdAt);
  }

  public static PipelineRunDto fromEntity(
      PipelineRun run, String connectorName, String connectorType) {
    long duration = 0;
    Instant start = run.getStartedAt();
    boolean terminal = run.getStatus() == PipelineRun.PipelineRunStatus.COMPLETED
        || run.getStatus() == PipelineRun.PipelineRunStatus.CLEANED
        || run.getStatus() == PipelineRun.PipelineRunStatus.VALIDATED
        || run.getStatus() == PipelineRun.PipelineRunStatus.FAILED
        || run.getStatus() == PipelineRun.PipelineRunStatus.CANCELLED;
    Instant end = run.getCompletedAt() != null ? run.getCompletedAt() : Instant.now();
    if (start != null) {
      duration = Math.max(0, Duration.between(start, end).getSeconds());
    }

    String status = run.getStatus() != null ? run.getStatus().name() : "PENDING";

    double progress = 0.0;
    if (run.getRecordsInput() > 0) {
      progress = Math.min(100.0, ((double) run.getRecordsOutput() / run.getRecordsInput()) * 100.0);
    } else if ("COMPLETED".equalsIgnoreCase(status)) {
      progress = 100.0;
    }

    double throughput = 0.0;
    if (duration > 0 && run.getRecordsOutput() > 0) {
      throughput = (double) run.getRecordsOutput() / duration;
    }

    Long reportedDuration = terminal && run.getCompletedAt() == null ? null : duration;

    return new PipelineRunDto(
        run.getId(),
        run.getConnectionId(),
        connectorName,
        connectorType,
        run.getPipelineType(),
        status,
        progress,
        run.getRecordsInput(),
        run.getRecordsOutput(),
        run.getRecordsFailed(),
        run.getRecordsQuarantined(),
        run.getRecordsRejected(),
        null,
        List.of(),
        throughput,
        run.getStartedAt(),
        run.getCompletedAt(),
        reportedDuration,
        run.getErrorMessage(),
        run.getMetadata(),
        run.getCreatedAt());
  }
}
