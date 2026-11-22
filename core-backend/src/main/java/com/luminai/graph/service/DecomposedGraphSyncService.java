package com.luminai.graph.service;

import com.luminai.common.tenant.TenantContext;
import com.luminai.engine.service.DataEngineClient;
import com.luminai.graph.repository.Neo4jGraphRepository;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Service orchestrating the synchronization of decomposed multi-class entity graph nodes and
 * relationships directly into Neo4j.
 */
@Service
public class DecomposedGraphSyncService {

  private static final Logger log = LoggerFactory.getLogger(DecomposedGraphSyncService.class);

  private final Neo4jGraphRepository neo4jGraphRepository;
  private final DataEngineClient dataEngineClient;

  public DecomposedGraphSyncService(
      Neo4jGraphRepository neo4jGraphRepository,
      @Autowired(required = false) DataEngineClient dataEngineClient) {
    this.neo4jGraphRepository = neo4jGraphRepository;
    this.dataEngineClient = dataEngineClient;
  }

  private String resolveTenant(String explicitTenant) {
    if (explicitTenant != null && !explicitTenant.isBlank()) {
      return explicitTenant;
    }
    String slug = TenantContext.getTenantSlug();
    if (slug != null && !slug.isBlank()) {
      return slug;
    }
    UUID uuid = TenantContext.getTenantUuid();
    return uuid != null ? uuid.toString() : "acme";
  }

  public Map<String, Object> syncNodesAndEdges(
      String explicitTenant, List<Map<String, Object>> nodes, List<Map<String, Object>> edges) {
    String tenant = resolveTenant(explicitTenant);
    log.info(
        "Synchronizing decomposed graph ({} nodes, {} edges) for tenant '{}'",
        nodes != null ? nodes.size() : 0,
        edges != null ? edges.size() : 0,
        tenant);

    int nodesSynced = 0;
    final int BATCH_SIZE = 500;
    if (nodes != null) {
      for (int i = 0; i < nodes.size(); i += BATCH_SIZE) {
        int end = Math.min(i + BATCH_SIZE, nodes.size());
        List<Map<String, Object>> batch = nodes.subList(i, end);
        nodesSynced +=
            executeWithRetry(
                () -> {
                  int count = 0;
                  for (Map<String, Object> node : batch) {
                    String label =
                        String.valueOf(
                            node.getOrDefault("label", node.getOrDefault("canonical_name", "")));
                    String entityType = String.valueOf(node.getOrDefault("entityType", "Entity"));
                    String rawId = String.valueOf(node.getOrDefault("id", ""));
                    String id =
                        !rawId.isBlank()
                            ? rawId
                            : generateDeterministicId(tenant, entityType, label);

                    if (!id.isBlank()) {
                      neo4jGraphRepository.ensureEntityTypeIndexes(entityType);
                      neo4jGraphRepository.mergeEntityNode(tenant, id, label, entityType);
                      count++;
                    }
                  }
                  return count;
                },
                3);
      }
    }

    int edgesSynced = 0;
    if (edges != null) {
      for (int i = 0; i < edges.size(); i += BATCH_SIZE) {
        int end = Math.min(i + BATCH_SIZE, edges.size());
        List<Map<String, Object>> batch = edges.subList(i, end);
        edgesSynced +=
            executeWithRetry(
                () -> {
                  int count = 0;
                  for (Map<String, Object> edge : batch) {
                    String source = String.valueOf(edge.getOrDefault("source", ""));
                    String target = String.valueOf(edge.getOrDefault("target", ""));
                    String relType =
                        String.valueOf(edge.getOrDefault("relationshipType", "RELATED_TO"));
                    String direction = String.valueOf(edge.getOrDefault("direction", "OUTGOING"));

                    if (!source.isBlank() && !target.isBlank()) {
                      boolean merged =
                          neo4jGraphRepository.mergeRelationship(
                              tenant, source, target, relType, direction);
                      if (merged) {
                        count++;
                      }
                    }
                  }
                  return count;
                },
                3);
      }
    }

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("tenantId", tenant);
    result.put("nodesSynced", nodesSynced);
    result.put("edgesSynced", edgesSynced);
    result.put("status", "COMPLETED");
    return result;
  }

  public Map<String, Object> decomposeAndSync(String explicitTenant, Map<String, Object> payload) {
    String tenant = resolveTenant(explicitTenant);
    if (dataEngineClient == null) {
      return Map.of(
          "status", "ERROR",
          "error", "Data Engine client is offline or not configured");
    }

    Map<String, Object> engineRes = dataEngineClient.decomposeGraph(payload);
    if (engineRes == null || engineRes.containsKey("error")) {
      return engineRes != null
          ? engineRes
          : Map.of("status", "ERROR", "error", "Empty decomposition response");
    }

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> nodes =
        (List<Map<String, Object>>) engineRes.getOrDefault("nodes", List.of());
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> edges =
        (List<Map<String, Object>>) engineRes.getOrDefault("edges", List.of());

    Map<String, Object> syncResult = syncNodesAndEdges(tenant, nodes, edges);

    Map<String, Object> combined = new LinkedHashMap<>(engineRes);
    combined.put("neo4jSync", syncResult);
    return combined;
  }

  public String generateDeterministicId(String tenant, String entityType, String key) {
    String raw = tenant + ":" + entityType + ":" + key;
    return UUID.nameUUIDFromBytes(raw.getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString();
  }

  private <T> T executeWithRetry(java.util.function.Supplier<T> action, int maxRetries) {
    int attempts = 0;
    while (true) {
      try {
        return action.get();
      } catch (Exception e) {
        attempts++;
        if (attempts >= maxRetries) {
          log.warn("Batch execution failed after {} attempts: {}", attempts, e.getMessage());
          throw e;
        }
        try {
          Thread.sleep(attempts * 50L);
        } catch (InterruptedException ie) {
          Thread.currentThread().interrupt();
          throw new RuntimeException("Interrupted during retry backoff", ie);
        }
      }
    }
  }
}
