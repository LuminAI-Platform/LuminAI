package com.luminai.dataset.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.luminai.dataset.model.MlModel;
import java.time.Instant;
import java.util.UUID;

public record MlModelDto(
    UUID id,
    UUID tenantId,
    String name,
    String algorithm,
    String taskType,
    @JsonProperty("datasetId") UUID trainingDatasetId,
    Integer datasetVersion,
    String features,
    String targetColumn,
    String hyperparameters,
    String metrics,
    String status,
    @JsonProperty("artifactPath") String modelArtifactPath,
    Instant createdAt,
    Instant updatedAt) {

  public static MlModelDto fromEntity(MlModel model) {
    if (model == null) return null;
    return new MlModelDto(
        model.getId(),
        model.getTenantId(),
        model.getName(),
        model.getAlgorithm(),
        model.getTaskType(),
        model.getTrainingDatasetId(),
        model.getDatasetVersion(),
        model.getFeatures(),
        model.getTargetColumn(),
        model.getHyperparameters(),
        model.getMetrics(),
        model.getStatus(),
        model.getModelArtifactPath(),
        model.getCreatedAt(),
        model.getUpdatedAt());
  }
}
