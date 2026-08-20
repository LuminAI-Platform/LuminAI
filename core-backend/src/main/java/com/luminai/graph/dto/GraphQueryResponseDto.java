package com.luminai.graph.dto;

import java.util.List;

/** Cytoscape.js element response for a tenant-scoped entity neighbourhood. */
public record GraphQueryResponseDto(List<Node> nodes, List<Edge> edges) {

  public record Node(NodeData data) {}

  public record NodeData(String id, String label, String entityType) {}

  public record Edge(EdgeData data) {}

  public record EdgeData(String id, String source, String target, String relationshipType) {}
}
