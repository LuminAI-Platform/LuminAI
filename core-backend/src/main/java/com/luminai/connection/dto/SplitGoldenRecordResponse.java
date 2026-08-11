package com.luminai.connection.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** Result of a split: the original (now-reduced) cluster and the newly extracted one. */
@Schema(description = "Both Golden Records resulting from a split operation")
public record SplitGoldenRecordResponse(
    @Schema(description = "The original Golden Record, minus the extracted source record")
        GoldenRecordDto original,
    @Schema(description = "The newly created standalone Golden Record")
        GoldenRecordDto extracted) {}
