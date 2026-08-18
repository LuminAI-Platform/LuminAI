package com.luminai.graph.repository;

import jakarta.annotation.PostConstruct;
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
 * docker-compose.yml}) does not support composite/node-key uniqueness constraints, so duplicate-node
 * prevention is enforced by always MERGE-ing on the full {@code {id, tenant_id}} pattern rather than
 * relying on a database-level constraint. Two non-composite indexes are created on startup purely
 * for lookup performance.
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
        try {
            neo4jClient
                    .query("CREATE INDEX entity_id_index IF NOT EXISTS FOR (e:Entity) ON (e.id)")
                    .run();
            neo4jClient
                    .query("CREATE INDEX entity_tenant_index IF NOT EXISTS FOR (e:Entity) ON (e.tenant_id)")
                    .run();
            log.info("Ensured Neo4j indexes on :Entity(id) and :Entity(tenant_id)");
        } catch (Exception e) {
            // Don't fail application startup over index creation — sync will just be slower without
            // them, not incorrect, since correctness comes from the MERGE pattern, not the index.
            log.warn("Could not ensure Neo4j indexes on :Entity — continuing without them: {}", e.getMessage());
        }
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
            String tenantId, String sourceId, String targetId, String relationshipType, String direction) {
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
}

