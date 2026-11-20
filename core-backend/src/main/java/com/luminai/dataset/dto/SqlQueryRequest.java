package com.luminai.dataset.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public record SqlQueryRequest(@NotBlank String query, UUID datasetId, int limit) {}
