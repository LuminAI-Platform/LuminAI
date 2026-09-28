package com.luminai.dashboard.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** Single time-series data point for dashboard metrics charts. */
@Schema(description = "Aggregated daily metrics time-series point")
public record TimeSeriesPointDto(
    @Schema(description = "Date key in ISO format YYYY-MM-DD", example = "2026-09-27") String date,
    @Schema(description = "Cumulative entity volume on this date", example = "11800")
        long entityCount,
    @Schema(description = "Number of pipeline executions on this date", example = "8")
        long pipelineRuns) {}
