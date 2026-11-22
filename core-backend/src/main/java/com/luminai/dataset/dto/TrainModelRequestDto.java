package com.luminai.dataset.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record TrainModelRequestDto(
    @NotBlank(message = "modelName is required") String modelName,
    UUID datasetId,
    String datasetName,
    Integer datasetVersion,
    @NotBlank(message = "targetColumn is required") String targetColumn,
    @NotNull(message = "records are required") List<Map<String, Object>> records,
    List<String> featureColumns,
    String algorithm,
    String taskType,
    Double testSize,
    Map<String, Object> hyperparameters) {}
