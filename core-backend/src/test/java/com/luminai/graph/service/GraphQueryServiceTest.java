package com.luminai.graph.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.luminai.common.exception.ResourceNotFoundException;
import com.luminai.common.tenant.TenantContext;
import com.luminai.graph.dto.GraphQueryResponseDto;
import com.luminai.graph.repository.Neo4jGraphRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

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
}
