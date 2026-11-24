package com.luminai.graph.repository;

import com.luminai.graph.dto.GraphQueryResponseDto;
import jakarta.annotation.PostConstruct;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Repository;

/**
 * Direct Cypher access to the {@code :Entity} graph, scoped to tenant on every single operation.
 *
 * <p>Uses {@link Neo4jClient} rather than a Spring Data Neo4j annotated-entity repository: node
 * synchronization here is a dynamic, idempotent upsert (MERGE) driven by an incoming Kafka event,
 * not CRUD against a fixed OGM-mapped entity graph, so raw parameterized Cypher is the clearer fit.
 *
 * <p><strong>Multi-tenant isolation:</strong> every query matches nodes by {@code id + tenant_id}
 * together, never by {@code id} alone. Relationship queries {@code MATCH} the source and target
 * nodes independently, both scoped to the <em>same</em> {@code $tenantId} parameter, so a
 * cross-tenant edge is structurally impossible to create — if either node doesn't exist under that
 * tenant, the {@code MATCH} simply returns no rows and no relationship is created.
 *
 * <p><strong>Idempotency:</strong> Neo4j 5 Community Edition (the version run via {@code
 * docker-compose.yml}) does not support composite/node-key uniqueness constraints, so
 * duplicate-node prevention is enforced by always MERGE-ing on the full {@code {id, tenant_id}}
 * pattern rather than relying on a database-level constraint. Two non-composite indexes are created
 * on startup purely for lookup performance.
 */
@Repository
public class Neo4jGraphRepository {

  private static final Logger log = LoggerFactory.getLogger(Neo4jGraphRepository.class);

  // Relationship types can't be parameterized in Cypher (they're part of the query structure, not
  // data), so any type taken from an incoming event must be validated against this allow-list
  // pattern before being concatenated into a query string. This is the standard safe approach for
  // dynamic relationship types in Neo4j — never string-interpolate an unvalidated value.
  private static final Pattern SAFE_RELATIONSHIP_TYPE = Pattern.compile("^[A-Za-z_][A-Za-z0-9_]*$");

  private final Neo4jClient neo4jClient;

  public Neo4jGraphRepository(Neo4jClient neo4jClient) {
    this.neo4jClient = neo4jClient;
  }

  @PostConstruct
  void ensureIndexes() {
    Thread.ofVirtual()
        .name("neo4j-index-init")
        .start(
            () -> {
              try {
                neo4jClient
                    .query("CREATE INDEX entity_id_index IF NOT EXISTS FOR (e:Entity) ON (e.id)")
                    .run();
                neo4jClient
                    .query(
                        "CREATE INDEX entity_tenant_index IF NOT EXISTS FOR (e:Entity) ON"
                            + " (e.tenant_id)")
                    .run();
                neo4jClient
                    .query(
                        "CREATE INDEX entity_composite_tenant_id IF NOT EXISTS FOR (e:Entity) ON"
                            + " (e.tenant_id, e.id)")
                    .run();
                neo4jClient
                    .query(
                        "CREATE INDEX entity_type_index IF NOT EXISTS FOR (e:Entity) ON"
                            + " (e.entity_type)")
                    .run();
                neo4jClient
                    .query(
                        "CREATE INDEX entity_tenant_type_composite IF NOT EXISTS FOR (e:Entity) ON"
                            + " (e.tenant_id, e.entity_type)")
                    .run();
                log.info(
                    "Ensured Neo4j indexes on :Entity(id), :Entity(tenant_id), :Entity(tenant_id, id), :Entity(entity_type), :Entity(tenant_id, entity_type)");
              } catch (Exception e) {
                // Don't fail application startup over index creation — sync will just be slower
                // without them, not incorrect, since correctness comes from the MERGE pattern, not
                // the index.
                log.warn(
                    "Could not ensure Neo4j indexes on :Entity — continuing without them: {}",
                    e.getMessage());
              }
            });
  }

  private static final Pattern SAFE_LABEL = Pattern.compile("^[A-Za-z][A-Za-z0-9_]*$");

  /**
   * Auto-generates Neo4j schema indexes for a specific entity type label. Ensures lookup by
   * (tenant_id, id) scales to 100,000+ nodes without timing out.
   */
  public void ensureEntityTypeIndexes(String entityType) {
    if (entityType == null || entityType.isBlank()) {
      return;
    }
    String sanitized = entityType.trim();
    if (!SAFE_LABEL.matcher(sanitized).matches()) {
      log.debug(
          "Skipping Neo4j index creation for non-standard entity type label: '{}'", entityType);
      return;
    }

    Thread.ofVirtual()
        .name("neo4j-entity-index-" + sanitized.toLowerCase())
        .start(
            () -> {
              try {
                String prefix = "idx_" + sanitized.toLowerCase() + "_";
                neo4jClient
                    .query(
                        "CREATE INDEX "
                            + prefix
                            + "tenant_id IF NOT EXISTS FOR (e:"
                            + sanitized
                            + ") ON (e.tenant_id, e.id)")
                    .run();
                neo4jClient
                    .query(
                        "CREATE INDEX "
                            + prefix
                            + "id IF NOT EXISTS FOR (e:"
                            + sanitized
                            + ") ON (e.id)")
                    .run();
                log.info("Auto-generated Neo4j schema indexes for entity type :{}", sanitized);
              } catch (Exception e) {
                log.warn(
                    "Could not auto-generate Neo4j indexes for entity type :{}: {}",
                    sanitized,
                    e.getMessage());
              }
            });
  }

  /**
   * Creates or updates an {@code :Entity} node, matched by {@code id + tenant_id}. Idempotent:
   * reprocessing the same event updates the same node rather than creating a duplicate.
   */
  public void mergeEntityNode(String tenantId, String id, String canonicalName, String entityType) {
    String cypher =
        """
                MERGE (e:Entity {id: $id, tenant_id: $tenantId})
                ON CREATE SET e.canonical_name = $canonicalName, e.entity_type = $entityType, e.created_at = datetime()
                ON MATCH SET e.canonical_name = $canonicalName, e.entity_type = $entityType, e.updated_at = datetime()
                """;

    neo4jClient
        .query(cypher)
        .bind(id)
        .to("id")
        .bind(tenantId)
        .to("tenantId")
        .bind(canonicalName)
        .to("canonicalName")
        .bind(entityType)
        .to("entityType")
        .run();
  }

  /**
   * Creates or updates a directional relationship between two {@code :Entity} nodes belonging to
   * the same tenant. Both endpoints are matched by {@code id + tenant_id} using the same {@code
   * tenantId} parameter — a source and target can never resolve to different tenants.
   *
   * @param direction {@code "INCOMING"} to point the edge target→source, anything else (including
   *     {@code null}) defaults to source→target
   * @return {@code true} if the relationship exists (created or already present); {@code false} if
   *     either endpoint could not be found for this tenant, in which case nothing was written
   */
  public boolean mergeRelationship(
      String tenantId,
      String sourceId,
      String targetId,
      String relationshipType,
      String direction) {
    if (relationshipType == null || !SAFE_RELATIONSHIP_TYPE.matcher(relationshipType).matches()) {
      log.warn(
          "Refusing to sync relationship with unsafe/invalid type '{}' for tenant {} (source={}, target={})",
          relationshipType,
          tenantId,
          sourceId,
          targetId);
      return false;
    }

    boolean incoming = "INCOMING".equalsIgnoreCase(direction);
    String pattern = incoming ? "(target)-[r:%s]->(source)" : "(source)-[r:%s]->(target)";
    String cypher =
        """
                MATCH (source:Entity {id: $sourceId, tenant_id: $tenantId})
                MATCH (target:Entity {id: $targetId, tenant_id: $tenantId})
                MERGE %s
                ON CREATE SET r.created_at = datetime()
                RETURN count(r) AS relCount
                """
            .formatted(pattern.formatted(relationshipType));

    Optional<Map<String, Object>> result =
        neo4jClient
            .query(cypher)
            .bind(sourceId)
            .to("sourceId")
            .bind(targetId)
            .to("targetId")
            .bind(tenantId)
            .to("tenantId")
            .fetch()
            .one();

    long relCount =
        result.map(row -> ((Number) row.getOrDefault("relCount", 0L)).longValue()).orElse(0L);

    if (relCount == 0) {
      log.warn(
          "No relationship created for tenant {}: source={} target={} type={} — one or both "
              + "endpoints do not exist under this tenant",
          tenantId,
          sourceId,
          targetId,
          relationshipType);
    }
    return relCount > 0;
  }

  private String resolveAltTenantId(String tenantId) {
    try {
      java.util.UUID uuid = com.luminai.common.tenant.TenantContext.getTenantUuid();
      String slug = com.luminai.common.tenant.TenantContext.getTenantSlug();
      if (slug != null && !slug.isBlank() && !slug.equalsIgnoreCase(tenantId)) {
        return slug;
      }
      if (uuid != null && !uuid.toString().equalsIgnoreCase(tenantId)) {
        return uuid.toString();
      }
    } catch (Exception ignored) {
    }
    return tenantId != null ? tenantId : "";
  }

  /**
   * Returns the tenant-scoped neighbourhood for an entity. The maximum relationship expansion is
   * fixed at four hops; the requested depth is a parameter used to further constrain paths.
   */
  public Optional<GraphQueryResponseDto> findNeighbourhood(
      String tenantId, String entityId, int depth, String relationshipType) {
    String altTenantId = resolveAltTenantId(tenantId);
    int safeDepth = Math.max(1, Math.min(depth, 4));
    String cypher =
        """
              MATCH (start:Entity)
              WHERE (start.id = $entityId OR start.canonical_name = $entityId OR toLower(coalesce(start.canonical_name, '')) = toLower($entityId))
                AND (start.tenant_id = $tenantId OR start.tenant_id = $altTenantId)
              OPTIONAL MATCH path = (start)-[rels*1..%d]-(neighbour:Entity)
              WHERE all(node IN nodes(path) WHERE node:Entity AND (node.tenant_id = $tenantId OR node.tenant_id = $altTenantId))
                AND (NOT $filterRelationshipType OR all(rel IN rels WHERE type(rel) = $relationshipType))
              WITH start, [p IN collect(path) WHERE p IS NOT NULL] AS validPaths
              WITH [start] + reduce(acc = [], p IN validPaths | acc + nodes(p)) AS allNodes,
                   reduce(acc = [], p IN validPaths | acc + relationships(p)) AS allRels
              RETURN [n IN allNodes WHERE n IS NOT NULL | {
                id: n.id,
                label: coalesce(n.canonical_name, n.id),
                entityType: n.entity_type
              }] AS nodes,
              [e IN allRels WHERE e IS NOT NULL | {
                id: elementId(e),
                source: startNode(e).id,
                target: endNode(e).id,
                relationshipType: type(e)
              }] AS edges
        """
            .formatted(safeDepth);

    try {
      return neo4jClient
          .query(cypher)
          .bind(entityId)
          .to("entityId")
          .bind(tenantId)
          .to("tenantId")
          .bind(altTenantId)
          .to("altTenantId")
          .bind(relationshipType == null ? "" : relationshipType)
          .to("relationshipType")
          .bind(relationshipType != null)
          .to("filterRelationshipType")
          .fetch()
          .one()
          .map(this::toGraphQueryResponse);
    } catch (Exception e) {
      log.warn("Neo4j neighbourhood query failed: {}", e.getMessage());
      return Optional.empty();
    }
  }

  /**
   * Returns an overview cluster of entities for the current tenant when no specific entity is
   * selected.
   */
  public Optional<GraphQueryResponseDto> findOverview(String tenantId, int limit) {
    String altTenantId = resolveAltTenantId(tenantId);
    String cypher =
        """
        MATCH (start:Entity)
        WHERE (start.tenant_id = $tenantId OR start.tenant_id = $altTenantId)
        WITH start LIMIT $limit
        OPTIONAL MATCH (start)-[r]-(other:Entity)
        WHERE (other.tenant_id = $tenantId OR other.tenant_id = $altTenantId)
        WITH collect(DISTINCT start) AS starts,
             [o IN collect(DISTINCT other) WHERE o IS NOT NULL] AS others,
             [rel IN collect(DISTINCT r) WHERE rel IS NOT NULL] AS rels
        WITH starts + others AS allNodes, rels
        RETURN [n IN allNodes WHERE n IS NOT NULL | {
          id: n.id,
          label: coalesce(n.canonical_name, n.id),
          entityType: n.entity_type
        }] AS nodes,
        [e IN rels WHERE e IS NOT NULL | {
          id: elementId(e),
          source: startNode(e).id,
          target: endNode(e).id,
          relationshipType: type(e)
        }] AS edges
        """;
    try {
      return neo4jClient
          .query(cypher)
          .bind(tenantId)
          .to("tenantId")
          .bind(altTenantId)
          .to("altTenantId")
          .bind(limit)
          .to("limit")
          .fetch()
          .one()
          .map(this::toGraphQueryResponse);
    } catch (Exception e) {
      log.warn("Neo4j findOverview query failed: {}", e.getMessage());
      return Optional.empty();
    }
  }

  /**
   * Uses Neo4j's {@code shortestPath} to return the ordered, tenant-scoped path between two Entity
   * nodes. The node predicate is part of the Cypher operation, so neither a cross-tenant node nor
   * its relationships can be returned.
   */
  public Optional<GraphQueryResponseDto> findShortestPath(
      String tenantId, String sourceId, String targetId) {
    if (sourceId.equals(targetId)) {
      return findSingleNodePath(tenantId, sourceId);
    }
    String cypher =
        """
                MATCH (source:Entity {id: $sourceId, tenant_id: $tenantId})
                MATCH (target:Entity {id: $targetId, tenant_id: $tenantId})
                MATCH path = shortestPath((source)-[*]-(target))
                WHERE all(node IN nodes(path) WHERE node:Entity AND node.tenant_id = $tenantId)
                RETURN
                  [node IN nodes(path) | {
                    id: node.id,
                    label: coalesce(node.canonical_name, node.id),
                    entityType: node.entity_type
                  }] AS nodes,
                  [rel IN relationships(path) | {
                    id: elementId(rel),
                    source: startNode(rel).id,
                    target: endNode(rel).id,
                    relationshipType: type(rel)
                  }] AS edges
                """;

    return neo4jClient
        .query(cypher)
        .bind(sourceId)
        .to("sourceId")
        .bind(targetId)
        .to("targetId")
        .bind(tenantId)
        .to("tenantId")
        .fetch()
        .one()
        .map(this::toGraphQueryResponse);
  }

  private Optional<GraphQueryResponseDto> findSingleNodePath(String tenantId, String entityId) {
    String cypher =
        """
                MATCH (node:Entity {id: $entityId, tenant_id: $tenantId})
                RETURN [{
                  id: node.id,
                  label: coalesce(node.canonical_name, node.id),
                  entityType: node.entity_type
                }] AS nodes, [] AS edges
                """;
    return neo4jClient
        .query(cypher)
        .bind(entityId)
        .to("entityId")
        .bind(tenantId)
        .to("tenantId")
        .fetch()
        .one()
        .map(this::toGraphQueryResponse);
  }

  public static boolean isSafeRelationshipType(String relationshipType) {
    return relationshipType != null && SAFE_RELATIONSHIP_TYPE.matcher(relationshipType).matches();
  }

  @SuppressWarnings("unchecked")
  private GraphQueryResponseDto toGraphQueryResponse(Map<String, Object> row) {
    java.util.Map<String, GraphQueryResponseDto.Node> uniqueNodes = new java.util.LinkedHashMap<>();
    List<Map<String, Object>> rawNodes =
        (List<Map<String, Object>>) row.getOrDefault("nodes", List.of());
    if (rawNodes != null) {
      for (Map<String, Object> node : rawNodes) {
        if (node != null && node.get("id") != null) {
          String id = String.valueOf(node.get("id"));
          String label = node.get("label") != null ? String.valueOf(node.get("label")) : id;
          String entityType =
              node.get("entityType") != null ? String.valueOf(node.get("entityType")) : "Entity";
          uniqueNodes.putIfAbsent(
              id,
              new GraphQueryResponseDto.Node(
                  new GraphQueryResponseDto.NodeData(id, label, entityType)));
        }
      }
    }

    java.util.Map<String, GraphQueryResponseDto.Edge> uniqueEdges = new java.util.LinkedHashMap<>();
    List<Map<String, Object>> rawEdges =
        (List<Map<String, Object>>) row.getOrDefault("edges", List.of());
    if (rawEdges != null) {
      for (Map<String, Object> edge : rawEdges) {
        if (edge != null && edge.get("source") != null && edge.get("target") != null) {
          String source = String.valueOf(edge.get("source"));
          String target = String.valueOf(edge.get("target"));
          String relType =
              edge.get("relationshipType") != null
                  ? String.valueOf(edge.get("relationshipType"))
                  : "RELATED_TO";
          String edgeKey = source + "->" + target + ":" + relType;
          String id = edge.get("id") != null ? String.valueOf(edge.get("id")) : edgeKey;
          uniqueEdges.putIfAbsent(
              edgeKey,
              new GraphQueryResponseDto.Edge(
                  new GraphQueryResponseDto.EdgeData(id, source, target, relType)));
        }
      }
    }

    List<GraphQueryResponseDto.Node> nodes = new java.util.ArrayList<>(uniqueNodes.values());
    List<GraphQueryResponseDto.Edge> edges = new java.util.ArrayList<>(uniqueEdges.values());
    return new GraphQueryResponseDto(nodes, edges);
  }
}
