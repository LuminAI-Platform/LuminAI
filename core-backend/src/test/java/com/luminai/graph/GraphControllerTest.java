package com.luminai.graph;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.luminai.common.exception.GlobalExceptionHandler;
import com.luminai.common.exception.ResourceNotFoundException;
import com.luminai.common.tenant.TenantContext;
import com.luminai.connection.service.GoldenRecordPersistenceService;
import com.luminai.graph.controller.GraphController;
import com.luminai.graph.dto.GraphQueryResponseDto;
import com.luminai.graph.dto.GraphStatsDto;
import com.luminai.graph.dto.GraphSummaryDto;
import com.luminai.graph.service.GraphQueryService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class GraphControllerTest {

  @Mock private GraphQueryService graphQueryService;

  @InjectMocks private GraphController controller;

  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc =
        MockMvcBuilders.standaloneSetup(controller)
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  @DisplayName("GET /api/v1/graph/neighbourhood returns 200 OK with nodes and edges")
  void getNeighbourhoodSuccess() throws Exception {
    GraphQueryResponseDto.Node node1 =
        new GraphQueryResponseDto.Node(
            new GraphQueryResponseDto.NodeData("e-1", "Alice Corp", "Organization"));
    GraphQueryResponseDto.Node node2 =
        new GraphQueryResponseDto.Node(
            new GraphQueryResponseDto.NodeData("e-2", "Bob Smith", "Person"));

    GraphQueryResponseDto.Edge edge =
        new GraphQueryResponseDto.Edge(
            new GraphQueryResponseDto.EdgeData("r-1", "e-2", "e-1", "EMPLOYED_BY"));

    GraphQueryResponseDto response =
        new GraphQueryResponseDto(List.of(node1, node2), List.of(edge), "e-1", 2, 1);

    when(graphQueryService.getNeighbourhood(anyString(), anyInt(), any())).thenReturn(response);

    mockMvc
        .perform(get("/api/v1/graph/neighbourhood").param("entityId", "e-1").param("depth", "1"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.nodes[0].data.id").value("e-1"))
        .andExpect(jsonPath("$.nodes[0].data.label").value("Alice Corp"))
        .andExpect(jsonPath("$.edges[0].data.relationshipType").value("EMPLOYED_BY"));
  }

  @Test
  @DisplayName("GET /api/v1/graph/stats returns 200 OK with node degree statistics")
  void getStatsSuccess() throws Exception {
    GraphStatsDto stats =
        new GraphStatsDto("e-1", 5, 3, 2, 0.42, Map.of("EMPLOYED_BY", 3, "PARTNER_WITH", 2));

    when(graphQueryService.getStats("e-1")).thenReturn(stats);

    mockMvc
        .perform(get("/api/v1/graph/stats").param("entityId", "e-1"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.entityId").value("e-1"))
        .andExpect(jsonPath("$.degree").value(5))
        .andExpect(jsonPath("$.inDegree").value(3))
        .andExpect(jsonPath("$.outDegree").value(2))
        .andExpect(jsonPath("$.clusterCoefficient").value(0.42));
  }

  @Test
  @DisplayName(
      "GET /api/v1/graph/neighbourhood returns empty graph instead of overview when entity is not found")
  void getNeighbourhoodReturnsEmptyOnResourceNotFound() throws Exception {
    when(graphQueryService.getNeighbourhood("missing-id", 1, null))
        .thenThrow(new ResourceNotFoundException("Entity", "id", "missing-id"));

    mockMvc
        .perform(get("/api/v1/graph/neighbourhood").param("entityId", "missing-id"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.nodes.length()").value(0))
        .andExpect(jsonPath("$.edges.length()").value(0));
  }

  @Test
  @DisplayName("GET /api/v1/graph/overview forwards relationshipType filter cleanly")
  void getOverviewSupportsRelationshipTypeFilter() throws Exception {
    GraphQueryResponseDto overview = new GraphQueryResponseDto(List.of(), List.of());
    when(graphQueryService.getOverviewGraph("SUPPLIED_BY")).thenReturn(overview);

    mockMvc
        .perform(get("/api/v1/graph/overview").param("relationshipType", "SUPPLIED_BY"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.nodes.length()").value(0));
  }

  @Test
  @DisplayName("POST /api/v1/graph/sync/connection/{id} triggers Neo4j backfill for tenant")
  void backfillConnectionRecordsIntoNeo4j() throws Exception {
    GoldenRecordPersistenceService persistenceService =
        org.mockito.Mockito.mock(GoldenRecordPersistenceService.class);
    controller.setGoldenRecordPersistenceService(persistenceService);

    java.util.UUID tenantUuid = java.util.UUID.randomUUID();
    java.util.UUID connUuid = java.util.UUID.randomUUID();
    TenantContext.setTenant(tenantUuid, "luminex");
    try {
      when(persistenceService.backfillExistingRecordsToNeo4j(tenantUuid, connUuid))
          .thenReturn(Map.of("status", "COMPLETED", "nodesSynced", 10, "edgesSynced", 4));

      mockMvc
          .perform(post("/api/v1/graph/sync/connection/" + connUuid))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.status").value("COMPLETED"))
          .andExpect(jsonPath("$.nodesSynced").value(10))
          .andExpect(jsonPath("$.edgesSynced").value(4));
    } finally {
      TenantContext.clear();
    }
  }

  @Test
  @DisplayName("GET /api/v1/graph/summary returns tenant-wide graph analytics payload")
  void getGraphSummaryReturnsMetrics() throws Exception {
    GraphSummaryDto summary =
        new GraphSummaryDto(
            10L,
            6L,
            2L,
            Map.of("Person", 7L, "Company", 3L),
            Map.of("WORKS_AT", 6L),
            List.of(
                new GraphSummaryDto.DegreeBucket("0 (Isolated)", 0, 0, 2L),
                new GraphSummaryDto.DegreeBucket("1-2", 1, 2, 8L)),
            List.of(new GraphSummaryDto.TopNodeMetric("c-1", "LuminAI", "Company", 6L, 6L, 0L)));

    when(graphQueryService.getGraphSummary()).thenReturn(summary);

    mockMvc
        .perform(get("/api/v1/graph/summary"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalNodes").value(10))
        .andExpect(jsonPath("$.totalEdges").value(6))
        .andExpect(jsonPath("$.entityTypeCounts.Person").value(7))
        .andExpect(jsonPath("$.relationshipTypeCounts.WORKS_AT").value(6))
        .andExpect(jsonPath("$.degreeDistribution[1].label").value("1-2"))
        .andExpect(jsonPath("$.topConnectedNodes[0].label").value("LuminAI"));
  }
}
