package com.luminai.connection.dto;

import com.luminai.connection.model.PipelineRun;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/** DTO for Pipeline execution run details. */
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
    double throughput,
    Instant startedAt,
    Instant completedAt,
    long durationSeconds,
    String errorMessage,
    String metadata,
    Instant createdAt) {

  public static PipelineRunDto fromEntity(
      PipelineRun run, String connectorName, String connectorType) {
    long duration = 0;
    Instant start = run.getStartedAt();
    Instant end = run.getCompletedAt() != null ? run.getCompletedAt() : Instant.now();
    if (start != null) {
      duration = Math.max(0, Duration.between(start, end).getSeconds());
    }

    String status = run.getStatus().name();

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

    return new PipelineRunDto(
        run.getId(),
        run.getConnectionId(),
        connectorName != null ? connectorName : "Data Connector",
        connectorType != null ? connectorType : "Database",
        run.getPipelineType(),
        status,
        progress,
        run.getRecordsInput(),
        run.getRecordsOutput(),
        run.getRecordsFailed(),
        throughput,
        run.getStartedAt(),
        run.getCompletedAt(),
        duration,
        run.getErrorMessage(),
        run.getMetadata(),
        run.getCreatedAt());
  }
}
