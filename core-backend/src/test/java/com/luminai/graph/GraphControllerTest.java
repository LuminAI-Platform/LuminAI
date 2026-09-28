package com.luminai.graph;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.luminai.common.exception.GlobalExceptionHandler;
import com.luminai.graph.controller.GraphController;
import com.luminai.graph.dto.GraphQueryResponseDto;
import com.luminai.graph.dto.GraphStatsDto;
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
}
