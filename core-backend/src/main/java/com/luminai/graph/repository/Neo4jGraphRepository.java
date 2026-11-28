package com.luminai.graph.repository;

import com.luminai.graph.dto.GraphQueryResponseDto;
import com.luminai.graph.dto.GraphSummaryDto;
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
  private static final Pattern GR_UUID_PATTERN =
      Pattern.compile(
          "^gr-([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$");
  private static final java.util.Set<String> RESERVED_NODE_PROPERTIES =
      java.util.Set.of(
          "id",
          "tenant_id",
          "tenantId",
          "canonical_name",
          "entity_type",
          "created_at",
          "updated_at");
  private static final int MAX_NODE_PROPERTIES = 25;
  private final java.util.Set<String> ensuredEntityTypeLabels =
      java.util.concurrent.ConcurrentHashMap.newKeySet();

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
    if (!ensuredEntityTypeLabels.add(sanitized.toLowerCase())) {
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
   * Merges flat scalar properties onto an existing {@code :Entity} node within the tenant's graph.
   */
  public void mergeEntityProperties(String tenantId, String id, Map<String, Object> rawProperties) {
    Map<String, Object> safeProps = sanitizeScalarProperties(rawProperties);
    if (safeProps.isEmpty() || id == null || id.isBlank()) {
      return;
    }
    String altTenantId = resolveAltTenantId(tenantId);
    String altId = alternateEntityId(id);
    String cypher =
        """
        MATCH (e:Entity)
        WHERE (e.id = $id OR e.id = $altId)
          AND (e.tenant_id = $tenantId OR e.tenant_id = $altTenantId)
        SET e += $props, e.updated_at = datetime()
        """;
    try {
      neo4jClient
          .query(cypher)
          .bind(id)
          .to("id")
          .bind(altId)
          .to("altId")
          .bind(tenantId)
          .to("tenantId")
          .bind(altTenantId)
          .to("altTenantId")
          .bind(safeProps)
          .to("props")
          .run();
    } catch (Exception e) {
      log.debug("Failed merging Neo4j node properties for '{}': {}", id, e.getMessage());
    }
  }

  /** Batched UNWIND upsert for multiple {@code :Entity} nodes and their scalar properties. */
  public void mergeEntityNodesBatch(String tenantId, List<Map<String, Object>> nodes) {
    if (nodes == null || nodes.isEmpty()) {
      return;
    }
    List<Map<String, Object>> prepared = new java.util.ArrayList<>(nodes.size());
    for (Map<String, Object> node : nodes) {
      if (node == null) continue;
      Object rawId = node.get("id");
      if (rawId == null || String.valueOf(rawId).isBlank()) continue;
      String id = String.valueOf(rawId).trim();
      String canonicalName =
          node.get("canonicalName") != null ? String.valueOf(node.get("canonicalName")) : id;
      String entityType =
          node.get("entityType") != null ? String.valueOf(node.get("entityType")) : "Entity";
      @SuppressWarnings("unchecked")
      Map<String, Object> rawProps =
          node.get("properties") instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
      Map<String, Object> safeProps = sanitizeScalarProperties(rawProps);
      Map<String, Object> entry = new java.util.LinkedHashMap<>();
      entry.put("id", id);
      entry.put("canonicalName", canonicalName);
      entry.put("entityType", entityType);
      entry.put("props", safeProps);
      prepared.add(entry);
    }
    if (prepared.isEmpty()) {
      return;
    }

    String cypher =
        """
        UNWIND $items AS item
        MERGE (e:Entity {id: item.id, tenant_id: $tenantId})
        ON CREATE SET e.canonical_name = item.canonicalName, e.entity_type = item.entityType, e.created_at = datetime()
        ON MATCH SET e.canonical_name = item.canonicalName, e.entity_type = item.entityType, e.updated_at = datetime()
        SET e += item.props
        """;
    neo4jClient.query(cypher).bind(prepared).to("items").bind(tenantId).to("tenantId").run();
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

    String altTenantId = resolveAltTenantId(tenantId);
    String altSourceId = alternateEntityId(sourceId);
    String altTargetId = alternateEntityId(targetId);
    boolean incoming = "INCOMING".equalsIgnoreCase(direction);
    String pattern = incoming ? "(target)-[r:%s]->(source)" : "(source)-[r:%s]->(target)";
    String cypher =
        """
                MATCH (source:Entity)
                WHERE (source.id = $sourceId OR source.id = $altSourceId)
                  AND (source.tenant_id = $tenantId OR source.tenant_id = $altTenantId)
                MATCH (target:Entity)
                WHERE (target.id = $targetId OR target.id = $altTargetId)
                  AND (target.tenant_id = $tenantId OR target.tenant_id = $altTenantId)
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
            .bind(altSourceId)
            .to("altSourceId")
            .bind(targetId)
            .to("targetId")
            .bind(altTargetId)
            .to("altTargetId")
            .bind(tenantId)
            .to("tenantId")
            .bind(altTenantId)
            .to("altTenantId")
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
    String altEntityId = alternateEntityId(entityId);
    int safeDepth = Math.max(1, Math.min(depth, 4));
    String cypher =
        """
              MATCH (start:Entity)
              WHERE (start.id = $entityId OR start.id = $altEntityId OR start.canonical_name = $entityId OR toLower(coalesce(start.canonical_name, '')) = toLower($entityId))
                AND (start.tenant_id = $tenantId OR start.tenant_id = $altTenantId)
              OPTIONAL MATCH path = (start)-[rels*1..%d]-(neighbour:Entity)
              WHERE all(node IN nodes(path) WHERE node:Entity AND (node.tenant_id = $tenantId OR node.tenant_id = $altTenantId))
                AND (NOT $filterRelationshipType OR all(rel IN rels WHERE type(rel) = $relationshipType))
              WITH start, [p IN collect(path) WHERE p IS NOT NULL] AS validPaths
              WITH start,
                   [start] + reduce(acc = [], p IN validPaths | acc + nodes(p)) AS allNodes,
                   reduce(acc = [], p IN validPaths | acc + relationships(p)) AS allRels
              RETURN start.id AS centerId,
              [n IN allNodes WHERE n IS NOT NULL | {
                id: n.id,
                label: coalesce(n.canonical_name, n.id),
                entityType: n.entity_type,
                properties: properties(n)
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
      java.util.Collection<Map<String, Object>> rows =
          neo4jClient
              .query(cypher)
              .bind(entityId)
              .to("entityId")
              .bind(altEntityId)
              .to("altEntityId")
              .bind(tenantId)
              .to("tenantId")
              .bind(altTenantId)
              .to("altTenantId")
              .bind(relationshipType == null ? "" : relationshipType)
              .to("relationshipType")
              .bind(relationshipType != null)
              .to("filterRelationshipType")
              .fetch()
              .all();
      return mergeGraphQueryResponses(rows);
    } catch (Exception e) {
      log.warn("Neo4j neighbourhood query failed: {}", e.getMessage());
      return Optional.empty();
    }
  }

  /**
   * Returns an overview cluster of entities for the current tenant when no specific entity is
   * selected, prioritizing connected nodes first.
   */
  public Optional<GraphQueryResponseDto> findOverview(String tenantId, int limit) {
    return findOverview(tenantId, limit, null);
  }

  public Optional<GraphQueryResponseDto> findOverview(
      String tenantId, int limit, String relationshipType) {
    String altTenantId = resolveAltTenantId(tenantId);
    boolean filterRel = relationshipType != null && isSafeRelationshipType(relationshipType);
    String cypher =
        """
        MATCH (start:Entity)
        WHERE (start.tenant_id = $tenantId OR start.tenant_id = $altTenantId)
        OPTIONAL MATCH (start)-[r0]-(:Entity)
        WITH start, count(r0) AS deg
        ORDER BY deg DESC, coalesce(start.canonical_name, start.id) ASC
        LIMIT $limit
        OPTIONAL MATCH (start)-[r]-(other:Entity)
        WHERE (other.tenant_id = $tenantId OR other.tenant_id = $altTenantId)
          AND (NOT $filterRelationshipType OR type(r) = $relationshipType)
        WITH collect(DISTINCT start) AS starts,
             [o IN collect(DISTINCT other) WHERE o IS NOT NULL] AS others,
             [rel IN collect(DISTINCT r) WHERE rel IS NOT NULL] AS rels
        WITH starts + others AS allNodes, rels
        RETURN [n IN allNodes WHERE n IS NOT NULL | {
          id: n.id,
          label: coalesce(n.canonical_name, n.id),
          entityType: n.entity_type,
          properties: properties(n)
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
          .bind(filterRel ? relationshipType : "")
          .to("relationshipType")
          .bind(filterRel)
          .to("filterRelationshipType")
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
    String altTenantId = resolveAltTenantId(tenantId);
    String altSourceId = alternateEntityId(sourceId);
    String altTargetId = alternateEntityId(targetId);
    String cypher =
        """
                MATCH (source:Entity)
                WHERE (source.id = $sourceId OR source.id = $altSourceId OR toLower(coalesce(source.canonical_name, '')) = toLower($sourceId))
                  AND (source.tenant_id = $tenantId OR source.tenant_id = $altTenantId)
                MATCH (target:Entity)
                WHERE (target.id = $targetId OR target.id = $altTargetId OR toLower(coalesce(target.canonical_name, '')) = toLower($targetId))
                  AND (target.tenant_id = $tenantId OR target.tenant_id = $altTenantId)
                MATCH path = shortestPath((source)-[*]-(target))
                WHERE all(node IN nodes(path) WHERE node:Entity AND (node.tenant_id = $tenantId OR node.tenant_id = $altTenantId))
                RETURN
                  source.id AS centerId,
                  [node IN nodes(path) | {
                    id: node.id,
                    label: coalesce(node.canonical_name, node.id),
                    entityType: node.entity_type,
                    properties: properties(node)
                  }] AS nodes,
                  [rel IN relationships(path) | {
                    id: elementId(rel),
                    source: startNode(rel).id,
                    target: endNode(rel).id,
                    relationshipType: type(rel)
                  }] AS edges
                """;

    java.util.Collection<Map<String, Object>> rows =
        neo4jClient
            .query(cypher)
            .bind(sourceId)
            .to("sourceId")
            .bind(altSourceId)
            .to("altSourceId")
            .bind(targetId)
            .to("targetId")
            .bind(altTargetId)
            .to("altTargetId")
            .bind(tenantId)
            .to("tenantId")
            .bind(altTenantId)
            .to("altTenantId")
            .fetch()
            .all();
    return rows.stream().findFirst().map(this::toGraphQueryResponse);
  }

  private Optional<GraphQueryResponseDto> findSingleNodePath(String tenantId, String entityId) {
    String altTenantId = resolveAltTenantId(tenantId);
    String altEntityId = alternateEntityId(entityId);
    String cypher =
        """
                MATCH (node:Entity)
                WHERE (node.id = $entityId OR node.id = $altEntityId OR toLower(coalesce(node.canonical_name, '')) = toLower($entityId))
                  AND (node.tenant_id = $tenantId OR node.tenant_id = $altTenantId)
                RETURN node.id AS centerId,
                [{
                  id: node.id,
                  label: coalesce(node.canonical_name, node.id),
                  entityType: node.entity_type,
                  properties: properties(node)
                }] AS nodes, [] AS edges
                """;
    java.util.Collection<Map<String, Object>> rows =
        neo4jClient
            .query(cypher)
            .bind(entityId)
            .to("entityId")
            .bind(altEntityId)
            .to("altEntityId")
            .bind(tenantId)
            .to("tenantId")
            .bind(altTenantId)
            .to("altTenantId")
            .fetch()
            .all();
    return rows.stream().findFirst().map(this::toGraphQueryResponse);
  }

  /**
   * Computes the exact local clustering coefficient (triangle density) among distinct neighbors.
   */
  public Optional<Double> findLocalClusteringCoefficient(String tenantId, String entityId) {
    if (entityId == null || entityId.isBlank()) {
      return Optional.empty();
    }
    String altTenantId = resolveAltTenantId(tenantId);
    String altEntityId = alternateEntityId(entityId);
    String cypher =
        """
        MATCH (n:Entity)
        WHERE (n.id = $entityId OR n.id = $altEntityId)
          AND (n.tenant_id = $tenantId OR n.tenant_id = $altTenantId)
        OPTIONAL MATCH (n)--(m:Entity)
        WHERE (m.tenant_id = $tenantId OR m.tenant_id = $altTenantId)
        WITH collect(DISTINCT m) AS nbrs
        WITH nbrs, size(nbrs) AS k
        UNWIND CASE WHEN k < 2 THEN [null] ELSE nbrs END AS u
        OPTIONAL MATCH (u)-[r]-(v:Entity)
        WHERE v IN nbrs AND elementId(u) < elementId(v)
        WITH k, count(DISTINCT r) AS neighborLinks
        RETURN CASE WHEN k < 2 THEN 0.0 ELSE toFloat(2 * neighborLinks) / toFloat(k * (k - 1)) END AS clustering
        """;
    try {
      return neo4jClient
          .query(cypher)
          .bind(entityId)
          .to("entityId")
          .bind(altEntityId)
          .to("altEntityId")
          .bind(tenantId)
          .to("tenantId")
          .bind(altTenantId)
          .to("altTenantId")
          .fetch()
          .one()
          .map(
              row -> {
                Object val = row.get("clustering");
                if (val instanceof Number n) {
                  return Math.min(1.0, Math.max(0.0, n.doubleValue()));
                }
                return 0.0;
              });
    } catch (Exception e) {
      log.debug(
          "Failed computing Neo4j clustering coefficient for '{}': {}", entityId, e.getMessage());
      return Optional.empty();
    }
  }

  /**
   * Computes tenant-wide knowledge graph aggregate metrics (type breakdown, relationship breakdown,
   * degree distribution histogram, and top hubs) directly in Neo4j for chart analytics.
   */
  public Optional<GraphSummaryDto> findGraphSummary(String tenantId) {
    String altTenantId = resolveAltTenantId(tenantId);
    try {
      String typeCypher =
          """
          MATCH (n:Entity)
          WHERE (n.tenant_id = $tenantId OR n.tenant_id = $altTenantId)
          RETURN coalesce(n.entity_type, 'Entity') AS entityType, count(n) AS cnt
          ORDER BY cnt DESC, entityType ASC
          """;
      java.util.Collection<Map<String, Object>> typeRows =
          neo4jClient
              .query(typeCypher)
              .bind(tenantId)
              .to("tenantId")
              .bind(altTenantId)
              .to("altTenantId")
              .fetch()
              .all();

      long totalNodes = 0;
      Map<String, Long> entityTypeCounts = new java.util.LinkedHashMap<>();
      for (Map<String, Object> row : typeRows) {
        if (row == null || row.get("entityType") == null) continue;
        long cnt = ((Number) row.getOrDefault("cnt", 0L)).longValue();
        if (cnt <= 0) continue;
        entityTypeCounts.put(String.valueOf(row.get("entityType")), cnt);
        totalNodes += cnt;
      }

      if (totalNodes == 0) {
        return Optional.empty();
      }

      String relCypher =
          """
          MATCH (a:Entity)-[r]->(b:Entity)
          WHERE (a.tenant_id = $tenantId OR a.tenant_id = $altTenantId)
            AND (b.tenant_id = $tenantId OR b.tenant_id = $altTenantId)
          RETURN type(r) AS relationshipType, count(r) AS cnt
          ORDER BY cnt DESC, relationshipType ASC
          """;
      java.util.Collection<Map<String, Object>> relRows =
          neo4jClient
              .query(relCypher)
              .bind(tenantId)
              .to("tenantId")
              .bind(altTenantId)
              .to("altTenantId")
              .fetch()
              .all();

      long totalEdges = 0;
      Map<String, Long> relationshipTypeCounts = new java.util.LinkedHashMap<>();
      for (Map<String, Object> row : relRows) {
        if (row == null || row.get("relationshipType") == null) continue;
        long cnt = ((Number) row.getOrDefault("cnt", 0L)).longValue();
        if (cnt <= 0) continue;
        relationshipTypeCounts.put(String.valueOf(row.get("relationshipType")), cnt);
        totalEdges += cnt;
      }

      String degreeCypher =
          """
          MATCH (n:Entity)
          WHERE (n.tenant_id = $tenantId OR n.tenant_id = $altTenantId)
          OPTIONAL MATCH (n)-[r]-(other:Entity)
          WHERE (other.tenant_id = $tenantId OR other.tenant_id = $altTenantId)
          WITH n, count(r) AS deg
          RETURN CASE
                   WHEN deg = 0 THEN '0 (Isolated)'
                   WHEN deg <= 2 THEN '1-2'
                   WHEN deg <= 5 THEN '3-5'
                   WHEN deg <= 10 THEN '6-10'
                   ELSE '11+'
                 END AS bucket,
                 count(n) AS cnt
          """;
      java.util.Collection<Map<String, Object>> degRows =
          neo4jClient
              .query(degreeCypher)
              .bind(tenantId)
              .to("tenantId")
              .bind(altTenantId)
              .to("altTenantId")
              .fetch()
              .all();

      Map<String, Long> bucketCounts = new java.util.LinkedHashMap<>();
      for (Map<String, Object> row : degRows) {
        if (row == null || row.get("bucket") == null) continue;
        long cnt = ((Number) row.getOrDefault("cnt", 0L)).longValue();
        bucketCounts.put(String.valueOf(row.get("bucket")), cnt);
      }
      long isolatedNodes = bucketCounts.getOrDefault("0 (Isolated)", 0L);

      List<GraphSummaryDto.DegreeBucket> degreeDistribution =
          List.of(
              new GraphSummaryDto.DegreeBucket("0 (Isolated)", 0, 0, isolatedNodes),
              new GraphSummaryDto.DegreeBucket("1-2", 1, 2, bucketCounts.getOrDefault("1-2", 0L)),
              new GraphSummaryDto.DegreeBucket("3-5", 3, 5, bucketCounts.getOrDefault("3-5", 0L)),
              new GraphSummaryDto.DegreeBucket(
                  "6-10", 6, 10, bucketCounts.getOrDefault("6-10", 0L)),
              new GraphSummaryDto.DegreeBucket(
                  "11+", 11, null, bucketCounts.getOrDefault("11+", 0L)));

      String topCypher =
          """
          MATCH (n:Entity)
          WHERE (n.tenant_id = $tenantId OR n.tenant_id = $altTenantId)
          OPTIONAL MATCH (n)-[rOut]->(t:Entity)
          WHERE (t.tenant_id = $tenantId OR t.tenant_id = $altTenantId)
          WITH n, count(rOut) AS outDeg
          OPTIONAL MATCH (s:Entity)-[rIn]->(n)
          WHERE (s.tenant_id = $tenantId OR s.tenant_id = $altTenantId)
          WITH n, outDeg, count(rIn) AS inDeg
          WITH n, outDeg, inDeg, (outDeg + inDeg) AS degree
          WHERE degree > 0
          RETURN n.id AS id,
                 coalesce(n.canonical_name, n.id) AS label,
                 coalesce(n.entity_type, 'Entity') AS entityType,
                 degree, inDeg, outDeg
          ORDER BY degree DESC, label ASC
          LIMIT 10
          """;
      java.util.Collection<Map<String, Object>> topRows =
          neo4jClient
              .query(topCypher)
              .bind(tenantId)
              .to("tenantId")
              .bind(altTenantId)
              .to("altTenantId")
              .fetch()
              .all();

      List<GraphSummaryDto.TopNodeMetric> topConnectedNodes = new java.util.ArrayList<>();
      for (Map<String, Object> row : topRows) {
        if (row == null || row.get("id") == null) continue;
        topConnectedNodes.add(
            new GraphSummaryDto.TopNodeMetric(
                String.valueOf(row.get("id")),
                row.get("label") != null
                    ? String.valueOf(row.get("label"))
                    : String.valueOf(row.get("id")),
                row.get("entityType") != null ? String.valueOf(row.get("entityType")) : "Entity",
                ((Number) row.getOrDefault("degree", 0L)).longValue(),
                ((Number) row.getOrDefault("inDeg", 0L)).longValue(),
                ((Number) row.getOrDefault("outDeg", 0L)).longValue()));
      }

      return Optional.of(
          new GraphSummaryDto(
              totalNodes,
              totalEdges,
              isolatedNodes,
              entityTypeCounts,
              relationshipTypeCounts,
              degreeDistribution,
              topConnectedNodes));
    } catch (Exception e) {
      log.warn(
          "Failed computing Neo4j graph summary for tenant '{}': {}", tenantId, e.getMessage());
      return Optional.empty();
    }
  }

  public static String normalizeEntityId(String rawId) {
    if (rawId == null) return null;
    String trimmed = rawId.trim();
    java.util.regex.Matcher m = GR_UUID_PATTERN.matcher(trimmed);
    return m.matches() ? m.group(1) : trimmed;
  }

  public static String alternateEntityId(String id) {
    if (id == null) return "";
    String trimmed = id.trim();
    java.util.regex.Matcher m = GR_UUID_PATTERN.matcher(trimmed);
    if (m.matches()) {
      return m.group(1);
    }
    try {
      java.util.UUID parsed = java.util.UUID.fromString(trimmed);
      return "gr-" + parsed;
    } catch (IllegalArgumentException ignored) {
      return trimmed;
    }
  }

  public static boolean isSafeRelationshipType(String relationshipType) {
    return relationshipType != null && SAFE_RELATIONSHIP_TYPE.matcher(relationshipType).matches();
  }

  private Map<String, Object> sanitizeScalarProperties(Map<String, Object> raw) {
    Map<String, Object> safe = new java.util.LinkedHashMap<>();
    if (raw == null || raw.isEmpty()) {
      return safe;
    }
    for (Map.Entry<String, Object> entry : raw.entrySet()) {
      if (safe.size() >= MAX_NODE_PROPERTIES) break;
      String k = entry.getKey();
      Object v = entry.getValue();
      if (k == null
          || k.isBlank()
          || k.startsWith("_")
          || RESERVED_NODE_PROPERTIES.contains(k)
          || v == null) {
        continue;
      }
      if (!SAFE_RELATIONSHIP_TYPE.matcher(k).matches()) {
        continue;
      }
      if (v instanceof String s) {
        if (!s.isBlank()) {
          safe.put(k, s.length() > 500 ? s.substring(0, 500) : s);
        }
      } else if (v instanceof Number || v instanceof Boolean) {
        safe.put(k, v);
      } else if (v instanceof java.time.temporal.Temporal) {
        safe.put(k, v.toString());
      }
    }
    return safe;
  }

  private Optional<GraphQueryResponseDto> mergeGraphQueryResponses(
      java.util.Collection<Map<String, Object>> rows) {
    if (rows == null || rows.isEmpty()) {
      return Optional.empty();
    }
    java.util.Map<String, GraphQueryResponseDto.Node> uniqueNodes = new java.util.LinkedHashMap<>();
    java.util.Map<String, GraphQueryResponseDto.Edge> uniqueEdges = new java.util.LinkedHashMap<>();
    String centerId = null;

    for (Map<String, Object> row : rows) {
      if (row == null) continue;
      if (centerId == null && row.get("centerId") != null) {
        centerId = String.valueOf(row.get("centerId"));
      }
      GraphQueryResponseDto partial = toGraphQueryResponse(row);
      if (partial.nodes() != null) {
        for (GraphQueryResponseDto.Node n : partial.nodes()) {
          if (n.data() != null && n.data().id() != null) {
            uniqueNodes.putIfAbsent(n.data().id(), n);
          }
        }
      }
      if (partial.edges() != null) {
        for (GraphQueryResponseDto.Edge e : partial.edges()) {
          if (e.data() != null) {
            String edgeKey =
                e.data().source() + "->" + e.data().target() + ":" + e.data().relationshipType();
            uniqueEdges.putIfAbsent(edgeKey, e);
          }
        }
      }
    }

    if (uniqueNodes.isEmpty()) {
      return Optional.empty();
    }
    List<GraphQueryResponseDto.Node> nodes = new java.util.ArrayList<>(uniqueNodes.values());
    List<GraphQueryResponseDto.Edge> edges = new java.util.ArrayList<>(uniqueEdges.values());
    if (centerId == null && !nodes.isEmpty()) {
      centerId = nodes.get(0).data().id();
    }
    return Optional.of(
        new GraphQueryResponseDto(nodes, edges, centerId, nodes.size(), edges.size()));
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
          Map<String, Object> cleanProps =
              node.get("properties") instanceof Map<?, ?> pMap
                  ? sanitizeScalarProperties((Map<String, Object>) pMap)
                  : Map.of();
          uniqueNodes.putIfAbsent(
              id,
              new GraphQueryResponseDto.Node(
                  new GraphQueryResponseDto.NodeData(
                      id, label, entityType, cleanProps.isEmpty() ? null : cleanProps, null)));
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
    String centerId = row.get("centerId") != null ? String.valueOf(row.get("centerId")) : null;
    if (centerId != null) {
      return new GraphQueryResponseDto(nodes, edges, centerId, nodes.size(), edges.size());
    }
    return new GraphQueryResponseDto(nodes, edges);
  }
}
