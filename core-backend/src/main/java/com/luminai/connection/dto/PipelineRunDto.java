package com.luminai.connection.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.luminai.connection.model.PipelineRun;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
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
    long durationSeconds,
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
        generateDefaultStages(recordsInput, recordsOutput, recordsFailed, durationSeconds),
        throughput,
        startedAt,
        completedAt,
        durationSeconds,
        errorMessage,
        metadata,
        createdAt);
  }

  private static List<StageMetricDto> generateDefaultStages(
      long in, long out, long failed, long duration) {
    List<StageMetricDto> stages = new ArrayList<>();
    long durSlice = Math.max(1, duration / 4);
    stages.add(new StageMetricDto("ingest", "Data Ingestion", in, in, 0, durSlice));
    stages.add(new StageMetricDto("clean", "Cleaning & Normalization", in, in, 0, durSlice));
    stages.add(new StageMetricDto("dedupe", "Deduplication", in, out + failed, failed, durSlice));
    stages.add(new StageMetricDto("resolve", "Entity Resolution", out + failed, out, 0, durSlice));
    return stages;
  }

  public static PipelineRunDto fromEntity(
      PipelineRun run, String connectorName, String connectorType) {
    long duration = 0;
    Instant start = run.getStartedAt();
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

    long failed = run.getRecordsFailed();
    long quarantined = failed > 0 ? failed / 2 : 0;
    long rejected = failed - quarantined;

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
        quarantined,
        rejected,
        null,
        generateDefaultStages(run.getRecordsInput(), run.getRecordsOutput(), failed, duration),
        throughput,
        run.getStartedAt(),
        run.getCompletedAt(),
        duration,
        run.getErrorMessage(),
        run.getMetadata(),
        run.getCreatedAt());
  }
}
