package com.luminai.graph.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.luminai.common.tenant.TenantContext;
import com.luminai.engine.service.DataEngineClient;
import com.luminai.graph.repository.Neo4jGraphRepository;
import java.util.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class DecomposedGraphSyncServiceTest {

  @Mock private Neo4jGraphRepository neo4jGraphRepository;
  @Mock private DataEngineClient dataEngineClient;

  @InjectMocks private DecomposedGraphSyncService syncService;

  private final UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");

  @BeforeEach
  void setUp() {
    TenantContext.setTenant(tenantId, "test_tenant");
  }

  @AfterEach
  void tearDown() {
    TenantContext.clear();
  }

  @Test
  @DisplayName("syncNodesAndEdges merges nodes and relationships into Neo4j")
  void testSyncNodesAndEdges() {
    List<Map<String, Object>> nodes =
        List.of(
            Map.of("id", "n-1", "label", "Dr. Gregory House", "entityType", "Physician"),
            Map.of("id", "n-2", "label", "Princeton Hospital", "entityType", "Hospital"));

    List<Map<String, Object>> edges =
        List.of(
            Map.of(
                "source", "n-1",
                "target", "n-2",
                "relationshipType", "AFFILIATED_WITH",
                "direction", "OUTGOING"));

    when(neo4jGraphRepository.mergeRelationship(
            eq("test_tenant"), eq("n-1"), eq("n-2"), eq("AFFILIATED_WITH"), eq("OUTGOING")))
        .thenReturn(true);

    Map<String, Object> result = syncService.syncNodesAndEdges("test_tenant", nodes, edges);

    assertNotNull(result);
    assertEquals("COMPLETED", result.get("status"));
    assertEquals(2, result.get("nodesSynced"));
    assertEquals(1, result.get("edgesSynced"));

    verify(neo4jGraphRepository, times(1))
        .mergeEntityNode("test_tenant", "n-1", "Dr. Gregory House", "Physician");
    verify(neo4jGraphRepository, times(1))
        .mergeEntityNode("test_tenant", "n-2", "Princeton Hospital", "Hospital");
    verify(neo4jGraphRepository, times(1))
        .mergeRelationship("test_tenant", "n-1", "n-2", "AFFILIATED_WITH", "OUTGOING");
  }

  @Test
  @DisplayName("decomposeAndSync calls Data Engine and synchronizes results into Neo4j")
  void testDecomposeAndSync() {
    Map<String, Object> payload = Map.of("records", List.of(Map.of("id", 1, "physician", "House")));

    Map<String, Object> engineRes = new HashMap<>();
    engineRes.put("status", "SUCCESS");
    engineRes.put("primary_entity_type", "Patient");
    engineRes.put(
        "nodes", List.of(Map.of("id", "p-1", "label", "Patient 1", "entityType", "Patient")));
    engineRes.put("edges", List.of());

    when(dataEngineClient.decomposeGraph(payload)).thenReturn(engineRes);

    Map<String, Object> outcome = syncService.decomposeAndSync("test_tenant", payload);

    assertNotNull(outcome);
    assertTrue(outcome.containsKey("neo4jSync"));
    @SuppressWarnings("unchecked")
    Map<String, Object> syncMap = (Map<String, Object>) outcome.get("neo4jSync");
    assertEquals(1, syncMap.get("nodesSynced"));
    verify(neo4jGraphRepository, times(1))
        .mergeEntityNode("test_tenant", "p-1", "Patient 1", "Patient");
  }

  @Test
  @DisplayName("syncNodesAndEdges processes realistic volumes in 500-item chunks")
  void testSyncLargeVolumeChunking() {
    List<Map<String, Object>> nodes = new ArrayList<>();
    for (int i = 0; i < 1250; i++) {
      nodes.add(Map.of("id", "node-" + i, "label", "Entity " + i, "entityType", "Item"));
    }

    Map<String, Object> result = syncService.syncNodesAndEdges("test_tenant", nodes, List.of());

    assertNotNull(result);
    assertEquals("COMPLETED", result.get("status"));
    assertEquals(1250, result.get("nodesSynced"));
    verify(neo4jGraphRepository, times(1250))
        .mergeEntityNode(eq("test_tenant"), anyString(), anyString(), eq("Item"));
  }

  @Test
  @DisplayName("generateDeterministicId produces identical reproducible IDs for same inputs")
  void testDeterministicIdConsistency() {
    String id1 = syncService.generateDeterministicId("test_tenant", "Person", "John Doe");
    String id2 = syncService.generateDeterministicId("test_tenant", "Person", "John Doe");
    String diffId = syncService.generateDeterministicId("test_tenant", "Person", "Jane Doe");

    assertNotNull(id1);
    assertEquals(id1, id2);
    assertNotEquals(id1, diffId);
  }
}
