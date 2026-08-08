package com.luminai.connection.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Frontend-facing view of a Golden Record, returned after split operations. */
@Schema(description = "A Golden Record resulting from a split operation")
public record GoldenRecordDto(
        @Schema(description = "Golden Record identifier") UUID id,
        @Schema(description = "Source records currently clustered into this Golden Record")
        Set<UUID> sourceRecordIds,
        @Schema(description = "Current merged field values") Map<String, Object> properties,
        @Schema(description = "Optimistic locking version") long version) {}


