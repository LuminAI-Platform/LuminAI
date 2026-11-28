package com.luminai.graph.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.Map;

/** Tenant-wide knowledge graph summary metrics for chart visualizations and analytics panels. */
@Schema(description = "Tenant-scoped aggregate metrics for Knowledge Graph charts")
public record GraphSummaryDto(
    @Schema(description = "Total entity nodes indexed in the tenant graph") long totalNodes,
    @Schema(description = "Total directed relationships between tenant entity nodes")
        long totalEdges,
    @Schema(description = "Count of entity nodes with degree 0 (no relationships)")
        long isolatedNodes,
    @Schema(description = "Node counts grouped by entity type") Map<String, Long> entityTypeCounts,
    @Schema(description = "Edge counts grouped by relationship type")
        Map<String, Long> relationshipTypeCounts,
    @Schema(description = "Ordered degree distribution histogram buckets")
        List<DegreeBucket> degreeDistribution,
    @Schema(description = "Highest-degree entity hubs ordered descending by total degree")
        List<TopNodeMetric> topConnectedNodes) {

  public record DegreeBucket(String label, int minDegree, Integer maxDegree, long count) {}

  public record TopNodeMetric(
      String id, String label, String entityType, long degree, long inDegree, long outDegree) {}
}
