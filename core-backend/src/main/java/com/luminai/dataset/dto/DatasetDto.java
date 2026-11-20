package com.luminai.dataset.dto;

import com.luminai.dataset.model.Dataset;
import java.time.Instant;
import java.util.UUID;

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
    String storageLocation,
    String schemaMetadata,
    String profilingSummary,
    Dataset.QualityStatus qualityStatus,
    UUID createdBy,
    Instant createdAt,
    Instant updatedAt) {
  public static DatasetDto fromEntity(Dataset entity) {
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
        entity.getStorageLocation(),
        entity.getSchemaMetadata(),
        entity.getProfilingSummary(),
        entity.getQualityStatus(),
        entity.getCreatedBy(),
        entity.getCreatedAt(),
        entity.getUpdatedAt());
  }
}
