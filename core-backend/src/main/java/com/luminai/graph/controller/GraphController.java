package com.luminai.graph.controller;

import com.luminai.graph.dto.GraphQueryResponseDto;
import com.luminai.graph.service.DecomposedGraphSyncService;
import com.luminai.graph.service.GraphQueryService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

/** REST API for bounded neighbourhood queries over the synchronized Entity graph. */
@RestController
@Validated
@RequestMapping("/api/v1/graph")
public class GraphController {

  private final GraphQueryService graphQueryService;
  private final DecomposedGraphSyncService decomposedGraphSyncService;

  public GraphController(
      GraphQueryService graphQueryService,
      @Autowired(required = false) DecomposedGraphSyncService decomposedGraphSyncService) {
    this.graphQueryService = graphQueryService;
    this.decomposedGraphSyncService = decomposedGraphSyncService;
  }

  /** The default depth is one hop; traversal is never expanded beyond four hops. */
  @GetMapping({"/neighbourhood", "/neighborhood", "/neighbors"})
  public ResponseEntity<GraphQueryResponseDto> getNeighbourhood(
      @RequestParam(name = "entityId", required = false) String entityId,
      @RequestParam(name = "id", required = false) String id,
      @RequestParam(defaultValue = "1")
          @Min(value = 1, message = "depth must be at least 1")
          @Max(value = 4, message = "depth must not exceed 4")
          int depth,
      @RequestParam(required = false)
          @Pattern(
              regexp = "^[A-Za-z_][A-Za-z0-9_]*$",
              message = "relationshipType must be a valid relationship type")
          String relationshipType) {
    String targetId =
        (entityId != null && !entityId.isBlank()) ? entityId.trim() : (id != null ? id.trim() : "");
    if (targetId.isBlank()) {
      return ResponseEntity.ok(graphQueryService.getOverviewGraph());
    }
    try {
      GraphQueryResponseDto response =
          graphQueryService.getNeighbourhood(targetId, depth, relationshipType);
      if (response == null || response.nodes() == null || response.nodes().isEmpty()) {
        return ResponseEntity.ok(graphQueryService.getFallbackNeighbourhood(targetId));
      }
      return ResponseEntity.ok(response);
    } catch (Exception e) {
      return ResponseEntity.ok(graphQueryService.getFallbackNeighbourhood(targetId));
    }
  }

  @GetMapping("/overview")
  public ResponseEntity<GraphQueryResponseDto> getOverview() {
    return ResponseEntity.ok(graphQueryService.getOverviewGraph());
  }

  @GetMapping("/shortest-path")
  public ResponseEntity<GraphQueryResponseDto> getShortestPath(
      @RequestParam @NotBlank(message = "sourceId must not be blank") String sourceId,
      @RequestParam @NotBlank(message = "targetId must not be blank") String targetId) {
    return ResponseEntity.ok(graphQueryService.getShortestPath(sourceId.trim(), targetId.trim()));
  }

  @GetMapping("/stats")
  public ResponseEntity<com.luminai.graph.dto.GraphStatsDto> getStats(
      @RequestParam @NotBlank(message = "entityId must not be blank") String entityId) {
    return ResponseEntity.ok(graphQueryService.getStats(entityId.trim()));
  }

  @PostMapping("/sync/decomposed")
  public ResponseEntity<Map<String, Object>> syncDecomposedGraph(
      @RequestParam(required = false) String tenantId, @RequestBody Map<String, Object> request) {
    if (decomposedGraphSyncService == null) {
      return ResponseEntity.status(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE)
          .body(Map.of("error", "DecomposedGraphSyncService unavailable"));
    }
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> nodes = (List<Map<String, Object>>) request.get("nodes");
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> edges = (List<Map<String, Object>>) request.get("edges");
    return ResponseEntity.ok(decomposedGraphSyncService.syncNodesAndEdges(tenantId, nodes, edges));
  }

  @PostMapping("/decompose-and-sync")
  public ResponseEntity<Map<String, Object>> decomposeAndSync(
      @RequestParam(required = false) String tenantId, @RequestBody Map<String, Object> request) {
    if (decomposedGraphSyncService == null) {
      return ResponseEntity.status(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE)
          .body(Map.of("error", "DecomposedGraphSyncService unavailable"));
    }
    return ResponseEntity.ok(decomposedGraphSyncService.decomposeAndSync(tenantId, request));
  }
}
