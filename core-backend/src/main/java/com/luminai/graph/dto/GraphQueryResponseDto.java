package com.luminai.graph.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import java.util.Map;

/**
 * Cytoscape.js element response and graph stats for a tenant-scoped entity neighbourhood.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record GraphQueryResponseDto(
    List<Node> nodes,
    List<Edge> edges,
    String centerNodeId,
    Integer totalNodes,
    Integer totalEdges) {

  public GraphQueryResponseDto(List<Node> nodes, List<Edge> edges) {
    this(nodes, edges, null, nodes != null ? nodes.size() : 0, edges != null ? edges.size() : 0);
  }

  public record Node(NodeData data) {}

  @JsonInclude(JsonInclude.Include.NON_NULL)
  public record NodeData(
      String id,
      String label,
      String entityType,
      Map<String, Object> properties,
      String color) {

    public NodeData(String id, String label, String entityType) {
      this(id, label, entityType, null, null);
    }
  }

  public record Edge(EdgeData data) {}

  @JsonInclude(JsonInclude.Include.NON_NULL)
  public record EdgeData(
      String id,
      String source,
      String target,
      String label,
      String relationshipType,
      Double weight) {

    public EdgeData(String id, String source, String target, String relationshipType) {
      this(id, source, target, relationshipType, relationshipType, 1.0);
    }
  }
}
