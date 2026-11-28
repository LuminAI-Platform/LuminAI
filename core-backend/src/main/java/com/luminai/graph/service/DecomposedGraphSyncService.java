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
                    String entityType = resolveEntityType(node);
                    String label = resolveNodeLabel(node);
                    String rawId = firstNonBlank(node.get("id"), node.get("node_id"));
                    String id =
                        rawId != null
                            ? Neo4jGraphRepository.normalizeEntityId(rawId)
                            : generateDeterministicId(
                                tenant,
                                entityType,
                                label != null ? label : UUID.randomUUID().toString());
                    String resolvedLabel = label != null ? label : id;

                    if (!id.isBlank()) {
                      neo4jGraphRepository.ensureEntityTypeIndexes(entityType);
                      neo4jGraphRepository.mergeEntityNode(tenant, id, resolvedLabel, entityType);
                      if (node.get("properties") instanceof Map<?, ?> propMap
                          && !propMap.isEmpty()) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> castProps = (Map<String, Object>) propMap;
                        neo4jGraphRepository.mergeEntityProperties(tenant, id, castProps);
                      }
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
                    String source =
                        Neo4jGraphRepository.normalizeEntityId(
                            firstNonBlank(
                                edge.get("source"),
                                edge.get("source_entity_id"),
                                edge.get("sourceId"),
                                edge.get("from")));
                    String target =
                        Neo4jGraphRepository.normalizeEntityId(
                            firstNonBlank(
                                edge.get("target"),
                                edge.get("target_entity_id"),
                                edge.get("targetId"),
                                edge.get("to")));
                    String relType =
                        firstNonBlank(
                            edge.get("relationshipType"),
                            edge.get("relationship_type"),
                            edge.get("type"));
                    if (relType == null) {
                      relType = "RELATED_TO";
                    }
                    String direction = firstNonBlank(edge.get("direction"));
                    if (direction == null) {
                      direction = "OUTGOING";
                    }

                    if (source != null
                        && !source.isBlank()
                        && target != null
                        && !target.isBlank()) {
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
    result.put("nodesCreated", nodesSynced);
    result.put("relationshipsCreated", edgesSynced);
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

    Map<String, Object> normalizedPayload = normalizeDecomposeRequest(payload);
    Map<String, Object> engineRes = dataEngineClient.decomposeGraph(normalizedPayload);
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
    combined.put("nodesCreated", syncResult.get("nodesSynced"));
    combined.put("relationshipsCreated", syncResult.get("edgesSynced"));
    combined.put("status", "COMPLETED");
    return combined;
  }

  private Map<String, Object> normalizeDecomposeRequest(Map<String, Object> payload) {
    if (payload == null) {
      return Map.of();
    }
    Map<String, Object> req = new LinkedHashMap<>(payload);
    if (payload.containsKey("primaryEntityType") && !payload.containsKey("primary_entity_type")) {
      req.put("primary_entity_type", payload.get("primaryEntityType"));
    }
    if (payload.containsKey("primaryIdColumn") && !payload.containsKey("primary_id_column")) {
      req.put("primary_id_column", payload.get("primaryIdColumn"));
    }
    if (payload.get("rules") instanceof List<?> rawRules) {
      List<Map<String, Object>> normalizedRules = new ArrayList<>(rawRules.size());
      for (Object item : rawRules) {
        if (!(item instanceof Map<?, ?> m)) continue;
        Map<String, Object> rule = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : m.entrySet()) {
          if (entry.getKey() != null) {
            rule.put(String.valueOf(entry.getKey()), entry.getValue());
          }
        }
        putIfAbsent(rule, "target_entity_type", m.get("targetEntityType"));
        putIfAbsent(rule, "relationship_type", m.get("relationshipType"));
        putIfAbsent(rule, "id_column", m.get("idColumn"));
        putIfAbsent(rule, "name_column", m.get("nameColumn"));
        putIfAbsent(rule, "attribute_columns", m.get("attributeColumns"));
        normalizedRules.add(rule);
      }
      req.put("rules", normalizedRules);
    }
    return req;
  }

  private static void putIfAbsent(Map<String, Object> map, String key, Object value) {
    if (value != null && !map.containsKey(key)) {
      map.put(key, value);
    }
  }

  private String resolveEntityType(Map<String, Object> node) {
    String entityType = firstNonBlank(node.get("entityType"), node.get("entity_type"));
    return entityType != null ? entityType : "Entity";
  }

  private String resolveNodeLabel(Map<String, Object> node) {
    String direct =
        firstNonBlank(
            node.get("label"),
            node.get("canonicalName"),
            node.get("canonical_name"),
            node.get("name"));
    if (direct != null) {
      return direct;
    }
    if (node.get("properties") instanceof Map<?, ?> propMap) {
      return firstNonBlank(
          propMap.get("canonical_name"),
          propMap.get("canonicalName"),
          propMap.get("name"),
          propMap.get("title"),
          propMap.get("code"),
          propMap.get("id"));
    }
    return null;
  }

  private static String firstNonBlank(Object... values) {
    if (values == null) return null;
    for (Object val : values) {
      if (val != null) {
        String s = String.valueOf(val).trim();
        if (!s.isEmpty() && !"null".equalsIgnoreCase(s)) {
          return s;
        }
      }
    }
    return null;
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
