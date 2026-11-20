package com.luminai.dataset.dto;

import com.luminai.dataset.model.Dataset;
import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public record CreateDatasetRequest(
    @NotBlank String name,
    @NotBlank String displayName,
    String description,
    Dataset.Layer layer,
    Dataset.ProjectType projectType,
    UUID sourceConnectionId,
    String schemaMetadata,
    String storageLocation,
    long rowCount,
    long byteSize
) {}
