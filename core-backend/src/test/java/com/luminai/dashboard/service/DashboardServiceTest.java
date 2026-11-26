package com.luminai.dashboard.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.luminai.connection.repository.ConnectionRepository;
import com.luminai.connection.repository.GoldenRecordRepository;
import com.luminai.connection.repository.PipelineRunRepository;
import com.luminai.dashboard.dto.TimeSeriesPointDto;
import com.luminai.ontology.repository.EntityTypeRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class DashboardServiceTest {

  @Mock private ConnectionRepository connectionRepository;
  @Mock private PipelineRunRepository pipelineRunRepository;
  @Mock private GoldenRecordRepository goldenRecordRepository;
  @Mock private EntityTypeRepository entityTypeRepository;

  private DashboardService dashboardService;

  @BeforeEach
  void setUp() {
    dashboardService =
        new DashboardService(
            connectionRepository,
            pipelineRunRepository,
            goldenRecordRepository,
            entityTypeRepository);
  }

  @Test
  void getTimeSeriesComputesCumulativeEntityGrowthFromHistoricalBaseline() {
    LocalDate today = LocalDate.now(ZoneOffset.UTC);
    Instant twoDaysAgo = today.minusDays(2).atStartOfDay().plusHours(4).toInstant(ZoneOffset.UTC);
    Instant todayTs = today.atStartOfDay().plusHours(2).toInstant(ZoneOffset.UTC);

    when(goldenRecordRepository.countByCreatedAtBefore(any())).thenReturn(10L);
    when(goldenRecordRepository.findCreatedAtSince(any()))
        .thenReturn(List.of(twoDaysAgo, twoDaysAgo, todayTs));
    when(pipelineRunRepository.findStartedAtSinceAndConnectionId(any(), eq(null)))
        .thenReturn(List.of(todayTs));

    List<TimeSeriesPointDto> points = dashboardService.getTimeSeries("7d", null);

    assertEquals(7, points.size());
    // Days before twoDaysAgo keep the 10-entity historical baseline
    assertEquals(10L, points.get(0).entityCount());
    // 2 days ago (index 4 in 7d window) increments by 2 entities -> 12
    assertEquals(12L, points.get(4).entityCount());
    // Yesterday (index 5) remains 12
    assertEquals(12L, points.get(5).entityCount());
    // Today (index 6) increments by 1 entity -> 13 and 1 pipeline run
    assertEquals(13L, points.get(6).entityCount());
    assertEquals(1L, points.get(6).pipelineRuns());
  }
}
