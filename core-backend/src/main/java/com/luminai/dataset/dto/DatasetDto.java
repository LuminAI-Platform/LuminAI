package com.luminai.dataset.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonRawValue;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luminai.dataset.model.Dataset;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record DatasetDto(
    UUID id,
    UUID tenantId,
    String name,
    String displayName,
    String description,
    Dataset.Layer layer,
    Dataset.ProjectType projectType,
    UUID sourceConnectionId,
    int currentVersion,
    long rowCount,
    long byteSize,
    long sizeBytes,
    String storageLocation,
    String storageFormat,
    @JsonRawValue String schemaMetadata,
    @JsonRawValue String profilingSummary,
    Dataset.QualityStatus qualityStatus,
    Double qualityScore,
    UUID createdBy,
    Instant createdAt,
    Instant updatedAt) {

  public static DatasetDto fromEntity(Dataset entity) {
    if (entity == null) return null;

    String loc = entity.getStorageLocation() != null ? entity.getStorageLocation() : "";
    String lowerLoc = loc.toLowerCase();
    String format;
    if (lowerLoc.endsWith(".csv")) {
      format = "CSV";
    } else if (lowerLoc.endsWith(".json") || lowerLoc.endsWith(".ndjson")) {
      format = "JSON";
    } else if (lowerLoc.endsWith(".xlsx") || lowerLoc.endsWith(".xls")) {
      format = "XLSX";
    } else if (lowerLoc.endsWith(".parquet")) {
      format = "PARQUET";
    } else if (loc.isBlank() && entity.getSourceConnectionId() != null) {
      format = "TABLE";
    } else {
      format = "PARQUET";
    }

    String profSummary = entity.getProfilingSummary();
    if (profSummary == null || profSummary.isBlank()) {
      profSummary = "{}";
    }
    Double score = extractRealQualityScore(profSummary);

    String schema = entity.getSchemaMetadata();
    if (schema == null || schema.isBlank()) {
      schema = "{}";
    }

    return new DatasetDto(
        entity.getId(),
        entity.getTenantId(),
        entity.getName(),
        entity.getDisplayName(),
        entity.getDescription(),
        entity.getLayer(),
        entity.getProjectType(),
        entity.getSourceConnectionId(),
        entity.getCurrentVersion(),
        entity.getRowCount(),
        entity.getByteSize(),
        entity.getByteSize(), // sizeBytes
        entity.getStorageLocation(),
        format, // storageFormat
        schema,
        profSummary,
        entity.getQualityStatus(),
        score, // qualityScore
        entity.getCreatedBy(),
        entity.getCreatedAt(),
        entity.getUpdatedAt());
  }

  private static final ObjectMapper SUMMARY_MAPPER = new ObjectMapper();

  private static Double extractRealQualityScore(String profSummary) {
    if (profSummary == null || profSummary.isBlank() || "{}".equals(profSummary.trim())) {
      return null;
    }
    try {
      JsonNode root = SUMMARY_MAPPER.readTree(profSummary);
      if (root == null || !root.isObject()) {
        return null;
      }
      for (String key : List.of("overallScore", "overall_score", "qualityScore", "score")) {
        if (root.has(key) && root.get(key).isNumber()) {
          return root.get(key).asDouble();
        }
      }
      double sum = 0.0;
      int count = 0;
      for (String dim :
          List.of(
              "completeness", "validity", "uniqueness", "consistency", "accuracy", "timeliness")) {
        if (root.has(dim) && root.get(dim).isNumber()) {
          sum += root.get(dim).asDouble();
          count++;
        }
      }
      if (count > 0) {
        return Math.round((sum / count) * 100.0) / 100.0;
      }
      if (root.has("quality_dimensions") && root.get("quality_dimensions").isObject()) {
        JsonNode dims = root.get("quality_dimensions");
        if (dims.has("overall_score") && dims.get("overall_score").isNumber()) {
          return dims.get("overall_score").asDouble();
        }
      }
      if (root.has("overview") && root.get("overview").isObject()) {
        JsonNode overview = root.get("overview");
        if (overview.has("missing_cells_pct") && overview.get("missing_cells_pct").isNumber()) {
          double completeness = 100.0 - overview.get("missing_cells_pct").asDouble();
          return Math.round(Math.max(0.0, Math.min(100.0, completeness)) * 100.0) / 100.0;
        }
      }
      return null;
    } catch (Exception e) {
      return null;
    }
  }
}
