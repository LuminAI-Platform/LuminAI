package com.luminai.graph.controller;

import com.luminai.common.exception.ResourceNotFoundException;
import com.luminai.common.tenant.TenantContext;
import com.luminai.connection.service.GoldenRecordPersistenceService;
import com.luminai.graph.dto.GraphQueryResponseDto;
import com.luminai.graph.service.DecomposedGraphSyncService;
import com.luminai.graph.service.GraphQueryService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

/** REST API for bounded neighbourhood queries over the synchronized Entity graph. */
@RestController
@Validated
@RequestMapping("/api/v1/graph")
@PreAuthorize(
    "hasAnyRole('ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DATA_ENGINEER', 'OPERATOR', 'USER', 'VIEWER')")
public class GraphController {

  private final GraphQueryService graphQueryService;
  private final DecomposedGraphSyncService decomposedGraphSyncService;
  private GoldenRecordPersistenceService goldenRecordPersistenceService;

  public GraphController(
      GraphQueryService graphQueryService,
      @Autowired(required = false) DecomposedGraphSyncService decomposedGraphSyncService) {
    this.graphQueryService = graphQueryService;
    this.decomposedGraphSyncService = decomposedGraphSyncService;
  }

  @Autowired(required = false)
  public void setGoldenRecordPersistenceService(
      GoldenRecordPersistenceService goldenRecordPersistenceService) {
    this.goldenRecordPersistenceService = goldenRecordPersistenceService;
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
      return ResponseEntity.ok(graphQueryService.getOverviewGraph(relationshipType));
    }
    try {
      GraphQueryResponseDto response =
          graphQueryService.getNeighbourhood(targetId, depth, relationshipType);
      if (response == null || response.nodes() == null || response.nodes().isEmpty()) {
        return ResponseEntity.ok(new GraphQueryResponseDto(List.of(), List.of(), targetId, 0, 0));
      }
      return ResponseEntity.ok(response);
    } catch (ResourceNotFoundException notFound) {
      return ResponseEntity.ok(new GraphQueryResponseDto(List.of(), List.of(), targetId, 0, 0));
    } catch (IllegalArgumentException badArg) {
      throw badArg;
    } catch (Exception e) {
      GraphQueryResponseDto fallback = graphQueryService.getFallbackNeighbourhood(targetId);
      if (fallback == null || fallback.nodes() == null || fallback.nodes().isEmpty()) {
        return ResponseEntity.ok(new GraphQueryResponseDto(List.of(), List.of(), targetId, 0, 0));
      }
      return ResponseEntity.ok(fallback);
    }
  }

  @GetMapping("/overview")
  public ResponseEntity<GraphQueryResponseDto> getOverview(
      @RequestParam(required = false)
          @Pattern(
              regexp = "^[A-Za-z_][A-Za-z0-9_]*$",
              message = "relationshipType must be a valid relationship type")
          String relationshipType) {
    return ResponseEntity.ok(graphQueryService.getOverviewGraph(relationshipType));
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
  @PreAuthorize(
      "hasAnyRole('ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DATA_ENGINEER', 'OPERATOR')")
  public ResponseEntity<Map<String, Object>> syncDecomposedGraph(
      @RequestParam(required = false) String tenantId, @RequestBody Map<String, Object> request) {
    if (decomposedGraphSyncService == null) {
      return ResponseEntity.status(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE)
          .body(Map.of("error", "DecomposedGraphSyncService unavailable"));
    }
    String effectiveTenant = resolveTenant(tenantId);
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> nodes = (List<Map<String, Object>>) request.get("nodes");
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> edges = (List<Map<String, Object>>) request.get("edges");
    return ResponseEntity.ok(
        decomposedGraphSyncService.syncNodesAndEdges(effectiveTenant, nodes, edges));
  }

  @PostMapping("/decompose-and-sync")
  @PreAuthorize(
      "hasAnyRole('ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DATA_ENGINEER', 'OPERATOR')")
  public ResponseEntity<Map<String, Object>> decomposeAndSync(
      @RequestParam(required = false) String tenantId, @RequestBody Map<String, Object> request) {
    if (decomposedGraphSyncService == null) {
      return ResponseEntity.status(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE)
          .body(Map.of("error", "DecomposedGraphSyncService unavailable"));
    }
    String effectiveTenant = resolveTenant(tenantId);
    return ResponseEntity.ok(decomposedGraphSyncService.decomposeAndSync(effectiveTenant, request));
  }

  @PostMapping({"/backfill", "/sync/connection/{connectionId}"})
  @PreAuthorize(
      "hasAnyRole('ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DATA_ENGINEER', 'OPERATOR')")
  public ResponseEntity<Map<String, Object>> syncExistingRecordsToGraph(
      @PathVariable(required = false) UUID connectionId) {
    if (goldenRecordPersistenceService == null) {
      return ResponseEntity.status(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE)
          .body(Map.of("error", "GoldenRecordPersistenceService unavailable"));
    }
    UUID tenantUuid = TenantContext.getTenantUuid();
    if (tenantUuid == null) {
      throw new org.springframework.security.access.AccessDeniedException("Missing tenant context");
    }
    Map<String, Object> summary =
        goldenRecordPersistenceService.backfillExistingRecordsToNeo4j(tenantUuid, connectionId);
    return ResponseEntity.ok(summary);
  }

  private String resolveTenant(String supplied) {
    String slug = TenantContext.getTenantSlug();
    if (slug != null && !slug.isBlank()) return slug;
    UUID uuid = TenantContext.getTenantUuid();
    if (uuid != null) return uuid.toString();
    if (supplied != null && !supplied.isBlank()) return supplied.trim();
    throw new org.springframework.security.access.AccessDeniedException("Missing tenant context");
  }
}
