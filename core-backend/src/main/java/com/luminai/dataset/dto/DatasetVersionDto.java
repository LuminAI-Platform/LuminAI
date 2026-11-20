package com.luminai.dataset.dto;

import com.luminai.dataset.model.DatasetVersion;
import java.time.Instant;
import java.util.UUID;

public record DatasetVersionDto(
    UUID id,
    UUID datasetId,
    int version,
    String storageLocation,
    long rowCount,
    String schemaSnapshot,
    String profilingSnapshot,
    String commitMessage,
    UUID createdBy,
    Instant createdAt) {
  public static DatasetVersionDto fromEntity(DatasetVersion entity) {
    return new DatasetVersionDto(
        entity.getId(),
        entity.getDatasetId(),
        entity.getVersion(),
        entity.getStorageLocation(),
        entity.getRowCount(),
        entity.getSchemaSnapshot(),
        entity.getProfilingSnapshot(),
        entity.getCommitMessage(),
        entity.getCreatedBy(),
        entity.getCreatedAt());
  }
}
