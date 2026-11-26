package com.luminai.dataset.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.luminai.dataset.model.DatasetVersion;
import java.time.Instant;
import java.util.UUID;

/**
 * DTO for a {@link DatasetVersion} entity sent to the frontend.
 *
 * <p>Field name aliases are applied via {@code @JsonProperty} to match the frontend contract:
 *
 * <ul>
 *   <li>{@code version} → {@code versionNumber}
 *   <li>{@code storageLocation} → {@code storageUri}
 *   <li>{@code createdBy} → {@code committedBy}
 *   <li>{@code sizeBytes} uses {@code rowCount} as the best available approximation (the model has
 *       no byte-size column)
 * </ul>
 */
public record DatasetVersionDto(
    UUID id,
    UUID datasetId,
    @JsonProperty("versionNumber") int version,
    @JsonProperty("storageUri") String storageLocation,
    long rowCount,
    @JsonProperty("sizeBytes") long sizeBytes,
    String schemaSnapshot,
    String profilingSnapshot,
    String commitMessage,
    @JsonProperty("committedBy") UUID createdBy,
    Instant createdAt) {

  public static DatasetVersionDto fromEntity(DatasetVersion entity) {
    long rc = entity.getRowCount();
    return new DatasetVersionDto(
        entity.getId(),
        entity.getDatasetId(),
        entity.getVersion(),
        entity.getStorageLocation(),
        rc,
        rc, // sizeBytes approximated by rowCount (no byte-size column on the model)
        entity.getSchemaSnapshot(),
        entity.getProfilingSnapshot(),
        entity.getCommitMessage(),
        entity.getCreatedBy(),
        entity.getCreatedAt());
  }
}
