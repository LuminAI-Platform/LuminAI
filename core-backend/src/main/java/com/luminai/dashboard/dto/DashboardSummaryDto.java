package com.luminai.dashboard.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/** Summary KPI and platform state response for the tenant dashboard. */
@Schema(description = "High-level dashboard overview metrics and state for a tenant")
public record DashboardSummaryDto(
    @Schema(description = "Total number of resolved golden entities", example = "12450")
        long totalEntities,
    @Schema(description = "Total number of registered data connections", example = "6")
        long totalConnections,
    @Schema(description = "Total number of pipeline runs executed", example = "42")
        long totalPipelines,
    @Schema(
            description = "Entity counts grouped by semantic ontology entity type",
            example = "{\"Person\": 8200, \"Organization\": 3400, \"Product\": 850}")
        Map<String, Long> entityBreakdown,
    @Schema(description = "Recent activity stream items") List<ActivityItemDto> recentActivity,
    @Schema(description = "Calculated platform data quality score (0-100)", example = "94.8")
        double dataQualityScore,
    @Schema(description = "Pipeline execution health status counters")
        PipelineHealthDto pipelineHealth,
    @Schema(description = "Timestamp of the most recent synchronization event")
        Instant lastSyncAt) {

  public record PipelineHealthDto(
      @Schema(description = "Number of currently active/running pipelines", example = "1")
          long running,
      @Schema(description = "Number of successfully completed pipelines", example = "38")
          long completed,
      @Schema(description = "Number of failed pipelines", example = "3") long failed) {}
}
