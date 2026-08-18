package com.luminai.graph.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.luminai.TestcontainersConfig;
import com.luminai.graph.dto.GraphQueryResponseDto;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Integration test against a real Neo4j instance (via {@link TestcontainersConfig}), since node
 * MERGE idempotency and tenant-scoped relationship isolation are Cypher-level guarantees that a
 * mocked {@link Neo4jGraphRepositoryIT#repository} unit test can't meaningfully verify.
 */
@SpringBootTest(properties = "spring.profiles.active=test")
@ActiveProfiles("test")
@Import(TestcontainersConfig.class)
@Testcontainers(disabledWithoutDocker = true)
class Neo4jGraphRepositoryIT {

  @Autowired private Neo4jGraphRepository repository;
  @Autowired private Neo4jClient neo4jClient;

  @AfterEach
  void cleanUp() {
    neo4jClient.query("MATCH (n:Entity) DETACH DELETE n").run();
  }

  @Test
  void mergeEntityNodeCreatesNodeWithRequiredProperties() {
    repository.mergeEntityNode("acme", "gr-1", "Alice Smith", "Person");

    Optional<Map<String, Object>> node =
        neo4jClient
            .query(
                "MATCH (e:Entity {id: $id, tenant_id: $tenantId}) "
                    + "RETURN e.id AS id, e.tenant_id AS tenant_id, e.canonical_name AS canonical_name, "
                    + "e.entity_type AS entity_type")
            .bind("gr-1")
            .to("id")
            .bind("acme")
            .to("tenantId")
            .fetch()
            .one();

    assertThat(node).isPresent();
    assertThat(node.get())
        .containsEntry("id", "gr-1")
        .containsEntry("tenant_id", "acme")
        .containsEntry("canonical_name", "Alice Smith")
        .containsEntry("entity_type", "Person");
  }

  @Test
  void reprocessingSameEventDoesNotCreateDuplicateNode() {
    repository.mergeEntityNode("acme", "gr-1", "Alice Smith", "Person");
    repository.mergeEntityNode("acme", "gr-1", "Alice Smith", "Person");
    repository.mergeEntityNode("acme", "gr-1", "Alice Updated", "Person");

    Long count =
        neo4jClient
            .query("MATCH (e:Entity {id: $id, tenant_id: $tenantId}) RETURN count(e) AS c")
            .bind("gr-1")
            .to("id")
            .bind("acme")
            .to("tenantId")
            .fetch()
            .one()
            .map(row -> ((Number) row.get("c")).longValue())
            .orElse(0L);

    assertThat(count).isEqualTo(1L);
  }

  @Test
  void sameIdUnderDifferentTenantsCreatesTwoSeparateNodes() {
    repository.mergeEntityNode("acme", "gr-1", "Acme's Alice", "Person");
    repository.mergeEntityNode("globex", "gr-1", "Globex's Alice", "Person");

    Long count =
        neo4jClient
            .query("MATCH (e:Entity {id: $id}) RETURN count(e) AS c")
            .bind("gr-1")
            .to("id")
            .fetch()
            .one()
            .map(row -> ((Number) row.get("c")).longValue())
            .orElse(0L);

    assertThat(count).isEqualTo(2L);
  }

  @Test
  void mergeRelationshipCreatesEdgeBetweenSameTenantNodes() {
    repository.mergeEntityNode("acme", "gr-1", "Alice", "Person");
    repository.mergeEntityNode("acme", "gr-2", "Acme Corp", "Organization");

    boolean created = repository.mergeRelationship("acme", "gr-1", "gr-2", "WORKS_AT", "OUTGOING");

    assertThat(created).isTrue();
    Long edgeCount =
        neo4jClient
            .query(
                "MATCH (:Entity {id: 'gr-1', tenant_id: 'acme'})-[r:WORKS_AT]->"
                    + "(:Entity {id: 'gr-2', tenant_id: 'acme'}) RETURN count(r) AS c")
            .fetch()
            .one()
            .map(row -> ((Number) row.get("c")).longValue())
            .orElse(0L);
    assertThat(edgeCount).isEqualTo(1L);
  }

  @Test
  void reprocessingSameRelationshipEventDoesNotCreateDuplicateEdge() {
    repository.mergeEntityNode("acme", "gr-1", "Alice", "Person");
    repository.mergeEntityNode("acme", "gr-2", "Acme Corp", "Organization");

    repository.mergeRelationship("acme", "gr-1", "gr-2", "WORKS_AT", "OUTGOING");
    repository.mergeRelationship("acme", "gr-1", "gr-2", "WORKS_AT", "OUTGOING");

    Long edgeCount =
        neo4jClient
            .query(
                "MATCH (:Entity {id: 'gr-1', tenant_id: 'acme'})-[r:WORKS_AT]->"
                    + "(:Entity {id: 'gr-2', tenant_id: 'acme'}) RETURN count(r) AS c")
            .fetch()
            .one()
            .map(row -> ((Number) row.get("c")).longValue())
            .orElse(0L);
    assertThat(edgeCount).isEqualTo(1L);
  }

  @Test
  void doesNotCreateRelationshipAcrossDifferentTenants() {
    // Tenant A's node and Tenant B's node, same application-level id.
    repository.mergeEntityNode("acme", "gr-1", "Acme's Alice", "Person");
    repository.mergeEntityNode("globex", "gr-2", "Globex Corp", "Organization");

    // Attempt to connect acme's gr-1 to globex's gr-2 using acme's tenant id: target won't be
    // found under acme, so nothing should be created.
    boolean created = repository.mergeRelationship("acme", "gr-1", "gr-2", "WORKS_AT", "OUTGOING");

    assertThat(created).isFalse();
    Long edgeCount =
        neo4jClient
            .query("MATCH ()-[r:WORKS_AT]->() RETURN count(r) AS c")
            .fetch()
            .one()
            .map(row -> ((Number) row.get("c")).longValue())
            .orElse(0L);
    assertThat(edgeCount).isEqualTo(0L);
  }

  @Test
  void rejectsUnsafeRelationshipTypeWithoutWritingAnything() {
    repository.mergeEntityNode("acme", "gr-1", "Alice", "Person");
    repository.mergeEntityNode("acme", "gr-2", "Acme Corp", "Organization");

    boolean created =
        repository.mergeRelationship(
            "acme", "gr-1", "gr-2", "WORKS_AT}) DETACH DELETE (n", "OUTGOING");

    assertThat(created).isFalse();
  }

  @Test
  void returnsBoundedNeighbourhoodWithCytoscapeElementsAndRelationshipFiltering() {
    repository.mergeEntityNode("acme", "a", "Alice", "Person");
    repository.mergeEntityNode("acme", "b", "Acme", "Organization");
    repository.mergeEntityNode("acme", "c", "Carol", "Person");
    repository.mergeEntityNode("acme", "d", "Delta", "Organization");
    repository.mergeEntityNode("acme", "e", "Erin", "Person");
    repository.mergeRelationship("acme", "a", "b", "EMPLOYED_BY", "OUTGOING");
    repository.mergeRelationship("acme", "b", "c", "EMPLOYED_BY", "OUTGOING");
    repository.mergeRelationship("acme", "c", "d", "EMPLOYED_BY", "OUTGOING");
    repository.mergeRelationship("acme", "d", "e", "EMPLOYED_BY", "OUTGOING");
    repository.mergeRelationship("acme", "a", "e", "KNOWS", "OUTGOING");

    for (int depth = 1; depth <= 4; depth++) {
      GraphQueryResponseDto result =
          repository.findNeighbourhood("acme", "a", depth, "EMPLOYED_BY").orElseThrow();

      assertThat(result.nodes()).hasSize(depth + 1);
      assertThat(result.edges()).hasSize(depth);
      assertThat(result.edges())
          .allSatisfy(edge -> assertThat(edge.data().relationshipType()).isEqualTo("EMPLOYED_BY"));
      assertThat(result.nodes()).extracting(node -> node.data().id()).contains("a");
      assertThat(result.edges())
          .allSatisfy(
              edge -> {
                assertThat(result.nodes())
                    .extracting(node -> node.data().id())
                    .contains(edge.data().source());
                assertThat(result.nodes())
                    .extracting(node -> node.data().id())
                    .contains(edge.data().target());
              });
    }
  }

  @Test
  void neighbourhoodDoesNotReturnNodesFromAnotherTenantOrFindTheirEntity() {
    repository.mergeEntityNode("acme", "a1", "Acme Alice", "Person");
    repository.mergeEntityNode("acme", "a2", "Acme Org", "Organization");
    repository.mergeRelationship("acme", "a1", "a2", "EMPLOYED_BY", "OUTGOING");
    repository.mergeEntityNode("globex", "b1", "Globex Bob", "Person");
    repository.mergeEntityNode("globex", "b2", "Globex Org", "Organization");
    repository.mergeRelationship("globex", "b1", "b2", "EMPLOYED_BY", "OUTGOING");

    GraphQueryResponseDto acmeGraph =
        repository.findNeighbourhood("acme", "a1", 4, null).orElseThrow();

    assertThat(acmeGraph.nodes())
        .extracting(node -> node.data().id())
        .containsExactlyInAnyOrder("a1", "a2");
    assertThat(repository.findNeighbourhood("acme", "b1", 1, null)).isEmpty();
  }

  @Test
  void returnsOrderedShortestPathAndPrefersTheShorterRoute() {
    repository.mergeEntityNode("acme", "a", "Alice", "Person");
    repository.mergeEntityNode("acme", "b", "Bob", "Person");
    repository.mergeEntityNode("acme", "c", "Carol", "Person");
    repository.mergeEntityNode("acme", "d", "Delta", "Organization");
    repository.mergeEntityNode("acme", "e", "Erin", "Person");
    repository.mergeRelationship("acme", "a", "b", "KNOWS", "OUTGOING");
    repository.mergeRelationship("acme", "b", "d", "KNOWS", "OUTGOING");
    repository.mergeRelationship("acme", "a", "c", "KNOWS", "OUTGOING");
    repository.mergeRelationship("acme", "c", "e", "KNOWS", "OUTGOING");
    repository.mergeRelationship("acme", "e", "d", "KNOWS", "OUTGOING");

    GraphQueryResponseDto path = repository.findShortestPath("acme", "a", "d").orElseThrow();

    assertThat(path.nodes()).extracting(node -> node.data().id()).containsExactly("a", "b", "d");
    assertThat(path.edges()).extracting(edge -> edge.data().source()).containsExactly("a", "b");
    assertThat(path.edges()).extracting(edge -> edge.data().target()).containsExactly("b", "d");
  }

  @Test
  void shortestPathIsTenantScopedAndHandlesNoPathAndSameNode() {
    repository.mergeEntityNode("acme", "a1", "Acme Alice", "Person");
    repository.mergeEntityNode("acme", "a2", "Acme Org", "Organization");
    repository.mergeEntityNode("acme", "a3", "Acme Carol", "Person");
    repository.mergeRelationship("acme", "a1", "a2", "EMPLOYED_BY", "OUTGOING");
    repository.mergeRelationship("acme", "a2", "a3", "EMPLOYED_BY", "OUTGOING");
    repository.mergeEntityNode("globex", "b3", "Globex Carol", "Person");
    repository.mergeEntityNode("globex", "a1", "Globex Alice", "Person");

    GraphQueryResponseDto tenantPath =
        repository.findShortestPath("acme", "a1", "a3").orElseThrow();
    GraphQueryResponseDto singleNodePath =
        repository.findShortestPath("acme", "a1", "a1").orElseThrow();

    assertThat(tenantPath.nodes())
        .extracting(node -> node.data().id())
        .containsExactly("a1", "a2", "a3");
    assertThat(repository.findShortestPath("acme", "a1", "b3")).isEmpty();
    assertThat(singleNodePath.nodes()).extracting(node -> node.data().id()).containsExactly("a1");
    assertThat(singleNodePath.edges()).isEmpty();
  }
}
