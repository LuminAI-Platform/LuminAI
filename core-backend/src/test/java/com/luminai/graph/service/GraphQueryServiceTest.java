package com.luminai.graph.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.luminai.common.exception.ResourceNotFoundException;
import com.luminai.common.tenant.TenantContext;
import com.luminai.connection.model.GoldenRecord;
import com.luminai.connection.repository.GoldenRecordRepository;
import com.luminai.graph.dto.GraphQueryResponseDto;
import com.luminai.graph.dto.GraphStatsDto;
import com.luminai.graph.dto.GraphSummaryDto;
import com.luminai.graph.repository.Neo4jGraphRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

class GraphQueryServiceTest {

  private Neo4jGraphRepository repository;
  private GraphQueryService service;

  @BeforeEach
  void setUp() {
    repository = mock(Neo4jGraphRepository.class);
    service = new GraphQueryService(repository);
    TenantContext.setTenantId("acme");
  }

  @AfterEach
  void tearDown() {
    TenantContext.clear();
  }

  @Test
  void usesCurrentTenantForNeighbourhoodLookup() {
    GraphQueryResponseDto expected = new GraphQueryResponseDto(List.of(), List.of());
    when(repository.findNeighbourhood("acme", "a1", 2, "EMPLOYED_BY"))
        .thenReturn(Optional.of(expected));

    assertThat(service.getNeighbourhood("a1", 2, "EMPLOYED_BY")).isSameAs(expected);

    verify(repository).findNeighbourhood("acme", "a1", 2, "EMPLOYED_BY");
  }

  @Test
  void rejectsEveryDepthOutsideTheHardBound() {
    for (int invalidDepth : List.of(-1, 0, 5, 10)) {
      assertThatThrownBy(() -> service.getNeighbourhood("a1", invalidDepth, null))
          .isInstanceOf(IllegalArgumentException.class);
    }
  }

  @Test
  void treatsAnEntityOutsideCurrentTenantAsNotFound() {
    when(repository.findNeighbourhood("acme", "belongs-to-globex", 1, null))
        .thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.getNeighbourhood("belongs-to-globex", 1, null))
        .isInstanceOf(ResourceNotFoundException.class);
  }

  @Test
  void usesCurrentTenantForShortestPathLookupAndReturnsNotFoundForNoPath() {
    GraphQueryResponseDto expected = new GraphQueryResponseDto(List.of(), List.of());
    when(repository.findShortestPath("acme", "a1", "a2")).thenReturn(Optional.of(expected));

    assertThat(service.getShortestPath("a1", "a2")).isSameAs(expected);
    verify(repository).findShortestPath("acme", "a1", "a2");

    when(repository.findShortestPath("acme", "a1", "unconnected")).thenReturn(Optional.empty());
    assertThatThrownBy(() -> service.getShortestPath("a1", "unconnected"))
        .isInstanceOf(ResourceNotFoundException.class);
  }

  @Test
  void fallbackDoesNotFabricateSyntheticEdgesAndReturnsEmptyForUnknownEntity() {
    GoldenRecordRepository goldenRepo = mock(GoldenRecordRepository.class);
    GraphQueryService hybridService = new GraphQueryService(repository, goldenRepo);

    GoldenRecord g1 = GoldenRecord.newStandalone();
    UUID id1 = UUID.randomUUID();
    ReflectionTestUtils.setField(g1, "id", id1);
    g1.setCanonicalName("Volta Freight");
    g1.setEntityType("Shipment");
    g1.getProperties().put("origin", "Accra");
    g1.getProperties().put("_connection_id", "conn-1");

    GoldenRecord g2 = GoldenRecord.newStandalone();
    ReflectionTestUtils.setField(g2, "id", UUID.randomUUID());
    g2.setCanonicalName("Kumasi Express");
    g2.setEntityType("Shipment");

    when(repository.findOverview("acme", 25, null)).thenReturn(Optional.empty());
    when(goldenRepo.findAll(org.mockito.ArgumentMatchers.any(Pageable.class)))
        .thenReturn(new PageImpl<>(List.of(g1, g2)));

    GraphQueryResponseDto overview = hybridService.getOverviewGraph();
    assertThat(overview.nodes()).hasSize(2);
    assertThat(overview.edges()).isEmpty();
    assertThat(overview.nodes().get(0).data().properties())
        .containsEntry("origin", "Accra")
        .doesNotContainKey("_connection_id");

    when(goldenRepo.findById(id1)).thenReturn(Optional.of(g1));
    GraphQueryResponseDto singleFallback = hybridService.getFallbackNeighbourhood(id1.toString());
    assertThat(singleFallback.nodes()).hasSize(1);
    assertThat(singleFallback.edges()).isEmpty();

    when(goldenRepo.searchByPropertiesAndType(
            org.mockito.ArgumentMatchers.eq("missing-entity"),
            org.mockito.ArgumentMatchers.isNull(),
            org.mockito.ArgumentMatchers.any(Pageable.class)))
        .thenReturn(org.springframework.data.domain.Page.empty());
    GraphQueryResponseDto missing = hybridService.getFallbackNeighbourhood("missing-entity");
    assertThat(missing.nodes()).isEmpty();
    assertThat(missing.edges()).isEmpty();
  }

  @Test
  void statsResolvesCenterIdByNameSearchAndComputesRealClusteringCoefficient() {
    GraphQueryResponseDto.Node n1 =
        new GraphQueryResponseDto.Node(
            new GraphQueryResponseDto.NodeData("id-1", "Alice", "Person"));
    GraphQueryResponseDto.Node n2 =
        new GraphQueryResponseDto.Node(new GraphQueryResponseDto.NodeData("id-2", "Bob", "Person"));
    GraphQueryResponseDto.Node n3 =
        new GraphQueryResponseDto.Node(
            new GraphQueryResponseDto.NodeData("id-3", "Carol", "Person"));
    GraphQueryResponseDto.Edge e1 =
        new GraphQueryResponseDto.Edge(
            new GraphQueryResponseDto.EdgeData("e1", "id-1", "id-2", "KNOWS"));
    GraphQueryResponseDto.Edge e2 =
        new GraphQueryResponseDto.Edge(
            new GraphQueryResponseDto.EdgeData("e2", "id-1", "id-3", "KNOWS"));
    GraphQueryResponseDto.Edge e3 =
        new GraphQueryResponseDto.Edge(
            new GraphQueryResponseDto.EdgeData("e3", "id-2", "id-3", "KNOWS"));

    GraphQueryResponseDto graph =
        new GraphQueryResponseDto(List.of(n1, n2, n3), List.of(e1, e2, e3), "id-1", 3, 3);
    when(repository.findNeighbourhood("acme", "Alice", 1, null)).thenReturn(Optional.of(graph));
    when(repository.findLocalClusteringCoefficient("acme", "id-1")).thenReturn(Optional.of(1.0));

    GraphStatsDto stats = service.getStats("Alice");
    assertThat(stats.entityId()).isEqualTo("id-1");
    assertThat(stats.outDegree()).isEqualTo(2);
    assertThat(stats.inDegree()).isZero();
    assertThat(stats.degree()).isEqualTo(2);
    assertThat(stats.clusterCoefficient()).isEqualTo(1.0);
  }

  @Test
  void summaryReturnsNeo4jMetricsOrPostgresFallbackWithoutFabricatingEdges() {
    GraphSummaryDto neoSummary =
        new GraphSummaryDto(
            5,
            4,
            1,
            java.util.Map.of("Person", 3L, "Company", 2L),
            java.util.Map.of("WORKS_AT", 4L),
            List.of(new GraphSummaryDto.DegreeBucket("0 (Isolated)", 0, 0, 1L)),
            List.of(new GraphSummaryDto.TopNodeMetric("id-1", "Acme", "Company", 4L, 4L, 0L)));
    when(repository.findGraphSummary("acme")).thenReturn(Optional.of(neoSummary));

    assertThat(service.getGraphSummary()).isSameAs(neoSummary);

    GoldenRecordRepository goldenRepo = mock(GoldenRecordRepository.class);
    GraphQueryService hybridService = new GraphQueryService(repository, goldenRepo);
    when(repository.findGraphSummary("acme")).thenReturn(Optional.empty());
    when(goldenRepo.countByEntityType())
        .thenReturn(List.of(new Object[] {"Organization", 12L}, new Object[] {"Person", 8L}));

    GraphSummaryDto fallback = hybridService.getGraphSummary();
    assertThat(fallback.totalNodes()).isEqualTo(20L);
    assertThat(fallback.totalEdges()).isZero();
    assertThat(fallback.isolatedNodes()).isEqualTo(20L);
    assertThat(fallback.entityTypeCounts()).containsEntry("Organization", 12L);
    assertThat(fallback.relationshipTypeCounts()).isEmpty();
    assertThat(fallback.degreeDistribution().get(0).count()).isEqualTo(20L);

    TenantContext.clear();
    assertThatThrownBy(() -> hybridService.getGraphSummary())
        .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
  }
}
