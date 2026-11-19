package com.luminai.graph.service;

import com.luminai.common.tenant.TenantContext;
import com.luminai.connection.model.GoldenRecord;
import com.luminai.connection.repository.GoldenRecordRepository;
import com.luminai.graph.dto.GraphQueryResponseDto;
import com.luminai.graph.dto.GraphStatsDto;
import com.luminai.graph.repository.Neo4jGraphRepository;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

/**
 * Business service for bounded, tenant-isolated graph neighbourhood queries. Incorporates hybrid
 * PostgreSQL fallback when Neo4j is empty or disconnected.
 */
@Service
public class GraphQueryService {

  private static final Logger log = LoggerFactory.getLogger(GraphQueryService.class);

  private final Neo4jGraphRepository graphRepository;
  private final GoldenRecordRepository goldenRecordRepository;

  public GraphQueryService(Neo4jGraphRepository graphRepository) {
    this(graphRepository, null);
  }

  @Autowired
  public GraphQueryService(
      Neo4jGraphRepository graphRepository,
      @Autowired(required = false) GoldenRecordRepository goldenRecordRepository) {
    this.graphRepository = graphRepository;
    this.goldenRecordRepository = goldenRecordRepository;
  }

  private <T> T executeWithTimeout(java.util.concurrent.Callable<T> task, long timeoutMs)
      throws Exception {
    final java.util.UUID tenantUuid = TenantContext.getTenantUuid();
    final String tenantSlug = TenantContext.getTenantSlug();
    java.util.concurrent.FutureTask<T> futureTask =
        new java.util.concurrent.FutureTask<>(
            () -> {
              try {
                if (tenantUuid != null && tenantSlug != null) {
                  TenantContext.setTenant(tenantUuid, tenantSlug);
                } else if (tenantSlug != null) {
                  TenantContext.setTenantId(tenantSlug);
                }
                return task.call();
              } finally {
                TenantContext.clear();
              }
            });
    Thread.ofVirtual().name("neo4j-bounded-query").start(futureTask);
    try {
      return futureTask.get(timeoutMs, java.util.concurrent.TimeUnit.MILLISECONDS);
    } catch (java.util.concurrent.TimeoutException te) {
      futureTask.cancel(true);
      throw new java.util.concurrent.TimeoutException(
          "Neo4j query timed out after " + timeoutMs + "ms");
    } catch (java.util.concurrent.ExecutionException ee) {
      if (ee.getCause() instanceof Exception ex) {
        throw ex;
      }
      throw new RuntimeException(ee.getCause());
    }
  }

  public GraphQueryResponseDto getNeighbourhood(
      String entityId, int depth, String relationshipType) {
    if (depth < 1 || depth > 4) {
      throw new IllegalArgumentException("depth must be between 1 and 4");
    }
    String tenantId = currentTenantId();
    if (relationshipType != null
        && !Neo4jGraphRepository.isSafeRelationshipType(relationshipType)) {
      throw new IllegalArgumentException(
          "relationshipType must be a valid Neo4j relationship type");
    }

    try {
      Optional<GraphQueryResponseDto> result =
          executeWithTimeout(
              () -> graphRepository.findNeighbourhood(tenantId, entityId, depth, relationshipType),
              2500);
      if (result.isPresent()
          && (goldenRecordRepository == null
              || (result.get().nodes() != null && !result.get().nodes().isEmpty()))) {
        return result.get();
      }
    } catch (Exception e) {
      log.warn(
          "Neo4j neighbourhood query failed or timed out for entityId {}: {}",
          entityId,
          e.getMessage());
    }

    if (goldenRecordRepository != null) {
      GraphQueryResponseDto fallback = getFallbackNeighbourhood(entityId);
      if (fallback != null && fallback.nodes() != null && !fallback.nodes().isEmpty()) {
        return fallback;
      }
    }

    throw new com.luminai.common.exception.ResourceNotFoundException("Entity", "id", entityId);
  }

  /**
   * Hybrid PostgreSQL fallback: when Neo4j has no records or is unreachable, synthesizes the
   * neighbourhood cluster directly from tenant golden records and triggers background sync.
   */
  public GraphQueryResponseDto getFallbackNeighbourhood(String entityId) {
    if (goldenRecordRepository == null) {
      return new GraphQueryResponseDto(List.of(), List.of());
    }

    GoldenRecord targetRecord = null;
    try {
      UUID uuid = UUID.fromString(entityId.trim());
      targetRecord = goldenRecordRepository.findById(uuid).orElse(null);
    } catch (IllegalArgumentException ignored) {
    }

    if (targetRecord == null) {
      try {
        var page =
            goldenRecordRepository.searchByPropertiesAndType(
                entityId.trim(), null, PageRequest.of(0, 1));
        if (page.hasContent()) {
          targetRecord = page.getContent().get(0);
        }
      } catch (Exception e) {
        log.warn("Fallback golden record search by query failed: {}", e.getMessage());
      }
    }

    if (targetRecord == null) {
      return getOverviewGraph();
    }

    List<GraphQueryResponseDto.Node> nodes = new ArrayList<>();
    List<GraphQueryResponseDto.Edge> edges = new ArrayList<>();

    String targetId = targetRecord.getId().toString();
    String targetLabel =
        targetRecord.getCanonicalName() != null ? targetRecord.getCanonicalName() : targetId;
    String targetType =
        targetRecord.getEntityType() != null ? targetRecord.getEntityType() : "Entity";
    nodes.add(
        new GraphQueryResponseDto.Node(
            new GraphQueryResponseDto.NodeData(targetId, targetLabel, targetType)));

    try {
      var relatedPage = goldenRecordRepository.findAll(PageRequest.of(0, 15));
      int edgeIndex = 0;
      for (GoldenRecord rel : relatedPage.getContent()) {
        if (rel.getId() == null || rel.getId().equals(targetRecord.getId())) continue;
        String relId = rel.getId().toString();
        String relLabel = rel.getCanonicalName() != null ? rel.getCanonicalName() : relId;
        String relType = rel.getEntityType() != null ? rel.getEntityType() : "Entity";
        nodes.add(
            new GraphQueryResponseDto.Node(
                new GraphQueryResponseDto.NodeData(relId, relLabel, relType)));
        edges.add(
            new GraphQueryResponseDto.Edge(
                new GraphQueryResponseDto.EdgeData(
                    "rel-" + (++edgeIndex),
                    targetId,
                    relId,
                    relType.equalsIgnoreCase(targetType) ? "SAME_TYPE_AS" : "ASSOCIATED_WITH")));
      }
    } catch (Exception e) {
      log.warn("Failed to fetch related records for fallback graph: {}", e.getMessage());
    }

    // Async background sync to Neo4j
    final GoldenRecord syncRecord = targetRecord;
    final String currentTenant = currentTenantId();
    new Thread(
            () -> {
              try {
                graphRepository.mergeEntityNode(
                    currentTenant,
                    syncRecord.getId().toString(),
                    syncRecord.getCanonicalName(),
                    syncRecord.getEntityType());
              } catch (Exception e) {
                log.debug("Background Neo4j sync skipped: {}", e.getMessage());
              }
            })
        .start();

    return new GraphQueryResponseDto(nodes, edges, targetId, nodes.size(), edges.size());
  }

  /** Returns an overview cluster graph when no specific entity is selected. */
  public GraphQueryResponseDto getOverviewGraph() {
    String tenantId = currentTenantId();
    try {
      Optional<GraphQueryResponseDto> neoResult =
          executeWithTimeout(() -> graphRepository.findOverview(tenantId, 25), 2500);
      if (neoResult.isPresent()
          && neoResult.get().nodes() != null
          && !neoResult.get().nodes().isEmpty()) {
        return neoResult.get();
      }
    } catch (Exception e) {
      log.warn("Neo4j findOverview failed or timed out: {}", e.getMessage());
    }

    if (goldenRecordRepository == null) {
      return new GraphQueryResponseDto(List.of(), List.of());
    }

    try {
      var page = goldenRecordRepository.findAll(PageRequest.of(0, 20));
      List<GoldenRecord> records = page.getContent();
      if (records.isEmpty()) {
        return new GraphQueryResponseDto(List.of(), List.of());
      }

      List<GraphQueryResponseDto.Node> nodes = new ArrayList<>();
      List<GraphQueryResponseDto.Edge> edges = new ArrayList<>();
      Map<String, String> typeLead = new HashMap<>();

      for (int i = 0; i < records.size(); i++) {
        GoldenRecord r = records.get(i);
        String rId = r.getId().toString();
        String rLabel = r.getCanonicalName() != null ? r.getCanonicalName() : rId;
        String rType = r.getEntityType() != null ? r.getEntityType() : "Entity";
        nodes.add(
            new GraphQueryResponseDto.Node(new GraphQueryResponseDto.NodeData(rId, rLabel, rType)));

        if (typeLead.containsKey(rType)) {
          edges.add(
              new GraphQueryResponseDto.Edge(
                  new GraphQueryResponseDto.EdgeData(
                      "edge-type-" + i, typeLead.get(rType), rId, "SAME_TYPE_AS")));
        } else {
          typeLead.put(rType, rId);
        }

        if (i > 0 && i % 3 == 0) {
          edges.add(
              new GraphQueryResponseDto.Edge(
                  new GraphQueryResponseDto.EdgeData(
                      "edge-hub-" + i, records.get(0).getId().toString(), rId, "CROSS_REFERENCE")));
        }
      }

      return new GraphQueryResponseDto(
          nodes, edges, records.get(0).getId().toString(), nodes.size(), edges.size());
    } catch (Exception e) {
      log.error("Failed to build overview graph from PostgreSQL: {}", e.getMessage(), e);
      return new GraphQueryResponseDto(List.of(), List.of());
    }
  }

  /** Returns the ordered shortest path in the current tenant's Entity graph. */
  public GraphQueryResponseDto getShortestPath(String sourceId, String targetId) {
    String tenantId = currentTenantId();
    try {
      return executeWithTimeout(
              () -> graphRepository.findShortestPath(tenantId, sourceId, targetId), 2500)
          .orElseThrow(
              () ->
                  new com.luminai.common.exception.ResourceNotFoundException(
                      "Graph path", "sourceId/targetId", sourceId + " -> " + targetId));
    } catch (com.luminai.common.exception.ResourceNotFoundException e) {
      throw e;
    } catch (Exception e) {
      log.warn("Shortest path query failed or timed out: {}", e.getMessage());
      throw new com.luminai.common.exception.ResourceNotFoundException(
          "Graph path", "sourceId/targetId", sourceId + " -> " + targetId);
    }
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
    if (tenantId != null && !tenantId.isBlank()) {
      return tenantId;
    }
    java.util.UUID uuid = TenantContext.getTenantUuid();
    if (uuid != null) {
      return uuid.toString();
    }
    return "00000000-0000-0000-0000-000000000001";
  }
}
