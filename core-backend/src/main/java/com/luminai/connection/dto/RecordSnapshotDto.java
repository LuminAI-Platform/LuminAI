package com.luminai.connection.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.Map;
import java.util.UUID;

/** Lightweight, denormalized view of one side of a candidate comparison. */
@Schema(description = "Snapshot of a source record's fields as captured at candidate creation time")
public record RecordSnapshotDto(
    @Schema(description = "Source record identifier") UUID recordId,
    @Schema(description = "Field values captured for comparison") Map<String, Object> properties) {}
