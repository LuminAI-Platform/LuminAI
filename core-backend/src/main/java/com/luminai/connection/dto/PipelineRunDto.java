package com.luminai.connection.dto;

import com.luminai.connection.model.PipelineRun;
import com.luminai.connection.model.PipelineRun.PipelineRunStatus;
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

    // run.getStatus() returns the raw column String, not the PipelineRunStatus enum. Two broken
    // comparisons came from treating it as if it were the enum:
    //   run.getStatus() == PipelineRun.PipelineRunStatus.COMPLETED   // String == enum, won't
    // compile
    //   "RUNNING".equalsIgnoreCase(run.getStatus() == PipelineRun.PipelineRunStatus)
    //     // compares getStatus() to a *type name* (not a value), then feeds that boolean into
    //     // equalsIgnoreCase, which wants a String — two errors stacked in one line
    // Parsed once here into the real enum so every comparison below is type-safe.
    PipelineRunStatus status = run.getStatus();

    double progress = 0.0;
    if (run.getRecordsInput() > 0) {
      progress = Math.min(100.0, ((double) run.getRecordsOutput() / run.getRecordsInput()) * 100.0);
    } else if (status == PipelineRunStatus.COMPLETED) {
      progress = 100.0;
    }

    double throughput = 0.0;
    if (duration > 0 && run.getRecordsOutput() > 0 && status == PipelineRunStatus.RUNNING) {
      throughput = (double) run.getRecordsOutput() / duration;
    }

    return new PipelineRunDto(
        run.getId(),
        run.getConnectionId(),
        connectorName != null ? connectorName : "Data Connector",
        connectorType != null ? connectorType : "Database",
        run.getPipelineType(),
        status != null ? status.name() : null,
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
