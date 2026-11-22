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
    if (nodes != null) {
      for (Map<String, Object> node : nodes) {
        String id = String.valueOf(node.getOrDefault("id", ""));
        String label =
            String.valueOf(node.getOrDefault("label", node.getOrDefault("canonical_name", id)));
        String entityType = String.valueOf(node.getOrDefault("entityType", "Entity"));

        if (!id.isBlank()) {
          neo4jGraphRepository.ensureEntityTypeIndexes(entityType);
          neo4jGraphRepository.mergeEntityNode(tenant, id, label, entityType);
          nodesSynced++;
        }
      }
    }

    int edgesSynced = 0;
    if (edges != null) {
      for (Map<String, Object> edge : edges) {
        String source = String.valueOf(edge.getOrDefault("source", ""));
        String target = String.valueOf(edge.getOrDefault("target", ""));
        String relType = String.valueOf(edge.getOrDefault("relationshipType", "RELATED_TO"));
        String direction = String.valueOf(edge.getOrDefault("direction", "OUTGOING"));

        if (!source.isBlank() && !target.isBlank()) {
          boolean merged =
              neo4jGraphRepository.mergeRelationship(tenant, source, target, relType, direction);
          if (merged) {
            edgesSynced++;
          }
        }
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
}
