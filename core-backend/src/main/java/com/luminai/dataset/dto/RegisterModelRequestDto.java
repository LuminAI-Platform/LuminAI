package com.luminai.dataset.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public record RegisterModelRequestDto(
    @NotBlank(message = "status is required") String status, String description, UUID modelId) {}
