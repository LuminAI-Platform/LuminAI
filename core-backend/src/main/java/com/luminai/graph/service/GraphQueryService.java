package com.luminai.graph.service;

import com.luminai.common.exception.ResourceNotFoundException;
import com.luminai.common.tenant.TenantContext;
import com.luminai.graph.dto.GraphQueryResponseDto;
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
    String tenantId = TenantContext.getTenantId();
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

  private String currentTenantId() {
    String tenantId = TenantContext.getTenantId();
    if (tenantId == null || tenantId.isBlank()) {
      throw new IllegalStateException("No tenant context is available for graph query");
    }
    return tenantId;
  }
}
