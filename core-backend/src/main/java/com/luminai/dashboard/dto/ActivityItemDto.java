package com.luminai.dashboard.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/**
 * Single platform event item for the dashboard activity feed.
 */
@Schema(description = "Recent system event or activity log item")
public record ActivityItemDto(
    @Schema(description = "Unique event identifier", example = "act-9f8e7d")
        String id,
    @Schema(
            description = "Category of activity",
            example = "PIPELINE_RUN",
            allowableValues = {"PIPELINE_RUN", "ENTITY_SYNC", "ONTOLOGY_UPDATE", "CONNECTION_CREATE"})
        String type,
    @Schema(description = "Short headline for the event", example = "Cleaning Pipeline Completed")
        String title,
    @Schema(description = "Descriptive context or outcome", example = "4,200 Customer records normalized and validated.")
        String description,
    @Schema(description = "Timestamp when the event occurred")
        Instant timestamp,
    @Schema(
            description = "Status indicator for the event",
            example = "SUCCESS",
            allowableValues = {"SUCCESS", "RUNNING", "FAILED", "INFO"})
        String status) {}
