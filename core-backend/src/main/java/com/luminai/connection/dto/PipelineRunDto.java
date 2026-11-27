package com.luminai.connection.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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

  private static final ObjectMapper METADATA_MAPPER = new ObjectMapper();

  private static List<StageMetricDto> generateDefaultStages(
      long in, long out, long failed, long duration) {
    if (in == 0 && out == 0 && failed == 0 && duration == 0) {
      return List.of();
    }
    List<StageMetricDto> stages = new ArrayList<>();
    long durSlice = duration > 0 ? duration / 4 : 0L;
    stages.add(new StageMetricDto("ingest", "Data Ingestion", in, in, 0, durSlice));
    stages.add(new StageMetricDto("clean", "Cleaning & Normalization", in, in, 0, durSlice));
    stages.add(new StageMetricDto("dedupe", "Deduplication", in, out + failed, failed, durSlice));
    stages.add(new StageMetricDto("resolve", "Entity Resolution", out + failed, out, 0, durSlice));
    return stages;
  }

  private static JsonNode parseMetadata(String rawMetadata) {
    if (rawMetadata == null || rawMetadata.isBlank() || "{}".equals(rawMetadata.trim())) {
      return null;
    }
    try {
      return METADATA_MAPPER.readTree(rawMetadata);
    } catch (Exception e) {
      return null;
    }
  }

  private static Long readLongField(JsonNode node, String field) {
    if (node != null && node.has(field) && node.get(field).isNumber()) {
      return node.get(field).asLong();
    }
    return null;
  }

  private static List<StageMetricDto> readStagesFromMetadata(JsonNode meta) {
    if (meta == null || !meta.has("stages") || !meta.get("stages").isArray()) {
      return null;
    }
    List<StageMetricDto> result = new ArrayList<>();
    for (JsonNode s : meta.get("stages")) {
      if (!s.isObject()) continue;
      String stage =
          s.has("stage")
              ? s.get("stage").asText("stage")
              : (s.has("id") ? s.get("id").asText("stage") : "stage");
      String label =
          s.has("label")
              ? s.get("label").asText(stage)
              : (s.has("name") ? s.get("name").asText(stage) : stage);
      long recIn = s.has("recordsIn") ? s.get("recordsIn").asLong(0L) : 0L;
      long recOut = s.has("recordsOut") ? s.get("recordsOut").asLong(0L) : 0L;
      long dropped =
          s.has("dropped")
              ? s.get("dropped").asLong(0L)
              : (s.has("recordsFailed") ? s.get("recordsFailed").asLong(0L) : 0L);
      long dur = s.has("durationSeconds") ? s.get("durationSeconds").asLong(0L) : 0L;
      result.add(new StageMetricDto(stage, label, recIn, recOut, dropped, dur));
    }
    return result.isEmpty() ? null : result;
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
    JsonNode meta = parseMetadata(run.getMetadata());
    Long metaQuarantined = readLongField(meta, "quarantined");
    Long metaRejected = readLongField(meta, "rejected");
    long quarantined = metaQuarantined != null ? Math.max(0L, metaQuarantined) : 0L;
    long rejected =
        metaRejected != null ? Math.max(0L, metaRejected) : Math.max(0L, failed - quarantined);
    List<StageMetricDto> parsedStages = readStagesFromMetadata(meta);
    List<StageMetricDto> stages =
        parsedStages != null
            ? parsedStages
            : generateDefaultStages(
                run.getRecordsInput(), run.getRecordsOutput(), failed, duration);

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
        stages,
        throughput,
        run.getStartedAt(),
        run.getCompletedAt(),
        duration,
        run.getErrorMessage(),
        run.getMetadata(),
        run.getCreatedAt());
  }
}
