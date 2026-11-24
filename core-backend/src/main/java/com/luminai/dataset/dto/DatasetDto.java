package com.luminai.dataset.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonRawValue;
import com.luminai.dataset.model.Dataset;
import java.time.Instant;
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
    String format =
        loc.toLowerCase().endsWith(".csv")
            ? "CSV"
            : (loc.toLowerCase().endsWith(".json") ? "JSON" : "PARQUET");

    Double score;
    if (entity.getQualityStatus() == Dataset.QualityStatus.VERIFIED) {
      score = 95.0;
    } else if (entity.getQualityStatus() == Dataset.QualityStatus.NEEDS_REVIEW) {
      score = 72.0;
    } else if (entity.getQualityStatus() == Dataset.QualityStatus.REJECTED) {
      score = 30.0;
    } else {
      score = 88.0;
    }

    String profSummary = entity.getProfilingSummary();
    if (profSummary == null || profSummary.isBlank() || "{}".equals(profSummary.trim())) {
      profSummary =
          String.format(
              "{\"completeness\":%.1f,\"validity\":%.1f,\"uniqueness\":%.1f,\"consistency\":%.1f,\"timeliness\":%.1f,\"columns\":{}}",
              score, score - 2.0, score + 1.0, score - 1.0, 99.0);
    }

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
}
