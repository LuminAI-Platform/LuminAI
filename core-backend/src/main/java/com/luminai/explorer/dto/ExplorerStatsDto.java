package com.luminai.explorer.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.Map;

/** Aggregated distribution metrics for Entity Explorer charts (bar, pie/donut, and histograms). */
@Schema(description = "Aggregated Explorer entity breakdown, quality histogram, and source counts")
public record ExplorerStatsDto(
    @Schema(description = "Total canonical golden records for the current tenant")
        long totalEntities,
    @Schema(description = "Entity counts grouped by entityType") Map<String, Long> entityTypeCounts,
    @Schema(description = "Quality/confidence score histogram buckets")
        List<HistogramBucket> qualityDistribution,
    @Schema(description = "Entity counts grouped by merged source record count")
        Map<String, Long> sourceCountDistribution) {

  public record HistogramBucket(String label, double minScore, double maxScore, long count) {}
}
