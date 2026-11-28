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
   * Hybrid PostgreSQL fallback: when Neo4j has no records or is unreachable, returns the real
   * entity node (with its non-internal properties) directly from PostgreSQL and schedules
   * background Neo4j sync — without fabricating synthetic edges.
   */
  public GraphQueryResponseDto getFallbackNeighbourhood(String entityId) {
    if (goldenRecordRepository == null || entityId == null || entityId.isBlank()) {
      return new GraphQueryResponseDto(List.of(), List.of());
    }

    String trimmedId = entityId.trim();
    String normalizedId = Neo4jGraphRepository.normalizeEntityId(trimmedId);
    GoldenRecord targetRecord = null;
    try {
      UUID uuid = UUID.fromString(normalizedId);
      targetRecord = goldenRecordRepository.findById(uuid).orElse(null);
    } catch (IllegalArgumentException ignored) {
    }

    if (targetRecord == null) {
      try {
        var page =
            goldenRecordRepository.searchByPropertiesAndType(trimmedId, null, PageRequest.of(0, 1));
        if (page.hasContent()) {
          targetRecord = page.getContent().get(0);
        }
      } catch (Exception e) {
        log.warn("Fallback golden record search by query failed: {}", e.getMessage());
      }
    }

    if (targetRecord == null) {
      return new GraphQueryResponseDto(List.of(), List.of());
    }

    GraphQueryResponseDto.Node targetNode = toNodeFromGoldenRecord(targetRecord);
    String targetId = targetNode.data().id();
    Map<String, Object> targetProps = targetNode.data().properties();

    // Async background sync to Neo4j
    final GoldenRecord syncRecord = targetRecord;
    final String currentTenant = currentTenantId();
    new Thread(
            () -> {
              try {
                graphRepository.ensureEntityTypeIndexes(syncRecord.getEntityType());
                graphRepository.mergeEntityNode(
                    currentTenant,
                    syncRecord.getId().toString(),
                    syncRecord.getCanonicalName(),
                    syncRecord.getEntityType());
                if (targetProps != null && !targetProps.isEmpty()) {
                  graphRepository.mergeEntityProperties(
                      currentTenant, syncRecord.getId().toString(), targetProps);
                }
              } catch (Exception e) {
                log.debug("Background Neo4j sync skipped: {}", e.getMessage());
              }
            })
        .start();

    return new GraphQueryResponseDto(List.of(targetNode), List.of(), targetId, 1, 0);
  }

  /** Returns an overview cluster graph when no specific entity is selected. */
  public GraphQueryResponseDto getOverviewGraph() {
    return getOverviewGraph(null);
  }

  /** Returns an overview cluster graph optionally filtered by relationship type. */
  public GraphQueryResponseDto getOverviewGraph(String relationshipType) {
    if (relationshipType != null
        && !relationshipType.isBlank()
        && !Neo4jGraphRepository.isSafeRelationshipType(relationshipType)) {
      throw new IllegalArgumentException(
          "relationshipType must be a valid Neo4j relationship type");
    }
    String tenantId = currentTenantId();
    try {
      Optional<GraphQueryResponseDto> neoResult =
          executeWithTimeout(
              () -> graphRepository.findOverview(tenantId, 25, relationshipType), 2500);
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
      for (GoldenRecord r : records) {
        if (r.getId() == null) continue;
        nodes.add(toNodeFromGoldenRecord(r));
      }
      String centerId = !nodes.isEmpty() ? nodes.get(0).data().id() : null;
      return new GraphQueryResponseDto(nodes, List.of(), centerId, nodes.size(), 0);
    } catch (Exception e) {
      log.error("Failed to build overview graph from PostgreSQL: {}", e.getMessage(), e);
      return new GraphQueryResponseDto(List.of(), List.of());
    }
  }

  private GraphQueryResponseDto.Node toNodeFromGoldenRecord(GoldenRecord r) {
    String id = r.getId().toString();
    String label = r.getCanonicalName() != null ? r.getCanonicalName() : id;
    String entityType = r.getEntityType() != null ? r.getEntityType() : "Entity";
    Map<String, Object> cleanProps = new LinkedHashMap<>();
    if (r.getProperties() != null) {
      for (Map.Entry<String, Object> entry : r.getProperties().entrySet()) {
        String key = entry.getKey();
        Object val = entry.getValue();
        if (key == null || key.startsWith("_") || val == null) continue;
        if (val instanceof String s) {
          if (!s.isBlank()) cleanProps.put(key, s);
        } else if (val instanceof Number || val instanceof Boolean) {
          cleanProps.put(key, val);
        }
      }
    }
    return new GraphQueryResponseDto.Node(
        new GraphQueryResponseDto.NodeData(
            id, label, entityType, cleanProps.isEmpty() ? null : cleanProps, null));
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
    String resolvedId = resolveStatsTargetId(entityId, neighbourhood);
    String altResolvedId = Neo4jGraphRepository.alternateEntityId(resolvedId);

    int inDegree = 0;
    int outDegree = 0;
    Map<String, Integer> relCounts = new LinkedHashMap<>();
    Set<String> neighbors = new LinkedHashSet<>();

    if (neighbourhood.edges() != null) {
      for (GraphQueryResponseDto.Edge edge : neighbourhood.edges()) {
        if (edge.data() == null) continue;
        String src = edge.data().source();
        String tgt = edge.data().target();
        String type =
            edge.data().relationshipType() != null ? edge.data().relationshipType() : "CONNECTED";

        boolean isOut =
            matchesNodeId(src, resolvedId, altResolvedId)
                || matchesNodeId(src, entityId, Neo4jGraphRepository.alternateEntityId(entityId));
        boolean isIn =
            matchesNodeId(tgt, resolvedId, altResolvedId)
                || matchesNodeId(tgt, entityId, Neo4jGraphRepository.alternateEntityId(entityId));

        if (isOut) {
          outDegree++;
          if (tgt != null) neighbors.add(tgt);
        }
        if (isIn) {
          inDegree++;
          if (src != null) neighbors.add(src);
        }
        relCounts.put(type, relCounts.getOrDefault(type, 0) + 1);
      }
    }

    int degree = inDegree + outDegree;
    double clusterCoefficient =
        computeClusteringCoefficient(currentTenantId(), resolvedId, neighbors, neighbourhood);

    return new com.luminai.graph.dto.GraphStatsDto(
        resolvedId, degree, inDegree, outDegree, clusterCoefficient, relCounts);
  }

  private String resolveStatsTargetId(String requestedId, GraphQueryResponseDto neighbourhood) {
    if (neighbourhood.centerNodeId() != null && !neighbourhood.centerNodeId().isBlank()) {
      return neighbourhood.centerNodeId();
    }
    if (neighbourhood.nodes() != null && !neighbourhood.nodes().isEmpty()) {
      String altReq = Neo4jGraphRepository.alternateEntityId(requestedId);
      for (GraphQueryResponseDto.Node node : neighbourhood.nodes()) {
        if (node.data() == null) continue;
        if (matchesNodeId(node.data().id(), requestedId, altReq)
            || (node.data().label() != null && node.data().label().equalsIgnoreCase(requestedId))) {
          return node.data().id();
        }
      }
    }
    return requestedId;
  }

  private boolean matchesNodeId(String candidate, String primaryId, String altId) {
    if (candidate == null || candidate.isBlank()) return false;
    return (primaryId != null && candidate.equalsIgnoreCase(primaryId))
        || (altId != null && !altId.isBlank() && candidate.equalsIgnoreCase(altId));
  }

  private double computeClusteringCoefficient(
      String tenantId,
      String resolvedId,
      Set<String> neighbors,
      GraphQueryResponseDto neighbourhood) {
    if (neighbors.size() < 2) {
      return 0.0;
    }
    try {
      Optional<Double> neoCoeff =
          executeWithTimeout(
              () -> graphRepository.findLocalClusteringCoefficient(tenantId, resolvedId), 1500);
      if (neoCoeff != null && neoCoeff.isPresent()) {
        return Math.round(neoCoeff.get() * 10000.0) / 10000.0;
      }
    } catch (Exception e) {
      log.debug("Falling back to local clustering computation: {}", e.getMessage());
    }

    Set<String> neighborPairs = new LinkedHashSet<>();
    if (neighbourhood.edges() != null) {
      for (GraphQueryResponseDto.Edge edge : neighbourhood.edges()) {
        if (edge.data() == null) continue;
        String src = edge.data().source();
        String tgt = edge.data().target();
        if (src != null
            && tgt != null
            && !src.equals(tgt)
            && neighbors.contains(src)
            && neighbors.contains(tgt)) {
          String pair = src.compareTo(tgt) < 0 ? (src + "::" + tgt) : (tgt + "::" + src);
          neighborPairs.add(pair);
        }
      }
    }
    int k = neighbors.size();
    double coeff = (2.0 * neighborPairs.size()) / (k * (k - 1));
    return Math.round(coeff * 10000.0) / 10000.0;
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
