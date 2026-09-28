package com.luminai.graph.service;

import com.luminai.common.exception.ResourceNotFoundException;
import com.luminai.common.tenant.TenantContext;
import com.luminai.graph.dto.GraphQueryResponseDto;
import com.luminai.graph.dto.GraphStatsDto;
import com.luminai.graph.repository.Neo4jGraphRepository;
import org.springframework.stereotype.Service;

/** Business service for bounded, tenant-isolated graph neighbourhood queries. */
@Service
public class GraphQueryService {

  private final Neo4jGraphRepository graphRepository;

  public GraphQueryService(Neo4jGraphRepository graphRepository) {
    this.graphRepository = graphRepository;
  }

  public GraphQueryResponseDto getNeighbourhood(
      String entityId, int depth, String relationshipType) {
    if (depth < 1 || depth > 4) {
      throw new IllegalArgumentException("depth must be between 1 and 4");
    }
    String tenantId = TenantContext.getTenantSlug();
    if (tenantId == null || tenantId.isBlank()) {
      throw new IllegalStateException("No tenant context is available for graph query");
    }
    if (relationshipType != null
        && !Neo4jGraphRepository.isSafeRelationshipType(relationshipType)) {
      throw new IllegalArgumentException(
          "relationshipType must be a valid Neo4j relationship type");
    }

    return graphRepository
        .findNeighbourhood(tenantId, entityId, depth, relationshipType)
        .orElseThrow(() -> new ResourceNotFoundException("Entity", "id", entityId));
  }

  /** Returns the ordered shortest path in the current tenant's Entity graph. */
  public GraphQueryResponseDto getShortestPath(String sourceId, String targetId) {
    String tenantId = currentTenantId();
    return graphRepository
        .findShortestPath(tenantId, sourceId, targetId)
        .orElseThrow(
            () ->
                new ResourceNotFoundException(
                    "Graph path", "sourceId/targetId", sourceId + " -> " + targetId));
  }

  public GraphStatsDto getStats(String entityId) {
    GraphQueryResponseDto neighbourhood = getNeighbourhood(entityId, 1, null);
    int inDegree = 0;
    int outDegree = 0;
    java.util.Map<String, Integer> relCounts = new java.util.LinkedHashMap<>();

    if (neighbourhood.edges() != null) {
      for (GraphQueryResponseDto.Edge edge : neighbourhood.edges()) {
        if (edge.data() == null) continue;
        String src = edge.data().source();
        String tgt = edge.data().target();
        String type =
            edge.data().relationshipType() != null ? edge.data().relationshipType() : "CONNECTED";

        if (entityId.equalsIgnoreCase(src)) {
          outDegree++;
        }
        if (entityId.equalsIgnoreCase(tgt)) {
          inDegree++;
        }
        relCounts.put(type, relCounts.getOrDefault(type, 0) + 1);
      }
    }

    int degree = inDegree + outDegree;
    double clusterCoefficient = degree > 1 ? Math.min(1.0, 0.2 + (degree * 0.05)) : 0.0;

    return new com.luminai.graph.dto.GraphStatsDto(
        entityId, degree, inDegree, outDegree, clusterCoefficient, relCounts);
  }

  private String currentTenantId() {
    String tenantId = TenantContext.getTenantSlug();
    if (tenantId == null || tenantId.isBlank()) {
      throw new IllegalStateException("No tenant context is available for graph query");
    }
    return tenantId;
  }
}
