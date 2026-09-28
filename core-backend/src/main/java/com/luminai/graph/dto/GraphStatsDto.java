package com.luminai.graph.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.Map;

/** Topological centrality and degree statistics for an entity node in the knowledge graph. */
@Schema(description = "Node graph centrality and degree statistics")
public record GraphStatsDto(
    @Schema(description = "Entity node identifier", example = "e-101") String entityId,
    @Schema(description = "Total degree (in + out edges)", example = "12") int degree,
    @Schema(description = "Number of incoming relationships", example = "7") int inDegree,
    @Schema(description = "Number of outgoing relationships", example = "5") int outDegree,
    @Schema(description = "Clustering coefficient metric (0.0 to 1.0)", example = "0.45")
        double clusterCoefficient,
    @Schema(
            description = "Breakdown of adjacent edges by relationship type",
            example = "{\"OWNS\": 3, \"EMPLOYED_BY\": 2, \"ASSOCIATED_WITH\": 7}")
        Map<String, Integer> relationshipTypeCounts) {}
