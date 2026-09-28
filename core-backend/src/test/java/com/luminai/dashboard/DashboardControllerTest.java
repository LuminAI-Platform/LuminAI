package com.luminai.dashboard;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.luminai.common.exception.GlobalExceptionHandler;
import com.luminai.dashboard.controller.DashboardController;
import com.luminai.dashboard.dto.ActivityItemDto;
import com.luminai.dashboard.dto.DashboardSummaryDto;
import com.luminai.dashboard.dto.TimeSeriesPointDto;
import com.luminai.dashboard.service.DashboardService;
import java.time.Instant;
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
class DashboardControllerTest {

  @Mock private DashboardService dashboardService;

  @InjectMocks private DashboardController controller;

  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc =
        MockMvcBuilders.standaloneSetup(controller)
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  @DisplayName("GET /api/v1/dashboard/summary returns 200 OK with valid KPI metrics")
  void getSummarySuccess() throws Exception {
    DashboardSummaryDto mockSummary =
        new DashboardSummaryDto(
            1500L,
            4L,
            25L,
            Map.of("Person", 1000L, "Organization", 500L),
            List.of(),
            97.8,
            new DashboardSummaryDto.PipelineHealthDto(1L, 23L, 1L),
            Instant.now());

    when(dashboardService.getSummary()).thenReturn(mockSummary);

    mockMvc
        .perform(get("/api/v1/dashboard/summary"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalEntities").value(1500))
        .andExpect(jsonPath("$.totalConnections").value(4))
        .andExpect(jsonPath("$.totalPipelines").value(25))
        .andExpect(jsonPath("$.dataQualityScore").value(97.8))
        .andExpect(jsonPath("$.pipelineHealth.running").value(1))
        .andExpect(jsonPath("$.pipelineHealth.completed").value(23))
        .andExpect(jsonPath("$.pipelineHealth.failed").value(1));
  }

  @Test
  @DisplayName("GET /api/v1/dashboard/activity returns 200 OK with event items")
  void getActivitySuccess() throws Exception {
    ActivityItemDto mockItem =
        new ActivityItemDto(
            "act-123",
            "PIPELINE_RUN",
            "Cleaning Completed",
            "Normalized 500 records.",
            Instant.now(),
            "SUCCESS");

    when(dashboardService.getActivity(anyInt())).thenReturn(List.of(mockItem));

    mockMvc
        .perform(get("/api/v1/dashboard/activity").param("limit", "10"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].id").value("act-123"))
        .andExpect(jsonPath("$[0].title").value("Cleaning Completed"))
        .andExpect(jsonPath("$[0].status").value("SUCCESS"));
  }

  @Test
  @DisplayName("GET /api/v1/dashboard/stats/timeseries returns 200 OK with time-series points")
  void getTimeSeriesSuccess() throws Exception {
    TimeSeriesPointDto mockPoint = new TimeSeriesPointDto("2026-09-28", 1200L, 5L);

    when(dashboardService.getTimeSeries(anyString())).thenReturn(List.of(mockPoint));

    mockMvc
        .perform(get("/api/v1/dashboard/stats/timeseries").param("range", "7d"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].date").value("2026-09-28"))
        .andExpect(jsonPath("$[0].entityCount").value(1200))
        .andExpect(jsonPath("$[0].pipelineRuns").value(5));
  }
}
