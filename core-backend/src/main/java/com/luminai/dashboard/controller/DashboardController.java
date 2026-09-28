package com.luminai.dashboard.controller;

import com.luminai.dashboard.dto.ActivityItemDto;
import com.luminai.dashboard.dto.DashboardSummaryDto;
import com.luminai.dashboard.dto.TimeSeriesPointDto;
import com.luminai.dashboard.service.DashboardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

/**
 * REST API exposing aggregated metrics, platform activity, and telemetry for the tenant dashboard.
 */
@RestController
@Validated
@RequestMapping("/api/v1/dashboard")
@Tag(name = "Dashboard", description = "Tenant dashboard KPI summary, event streams, and time-series telemetry")
public class DashboardController {

  private final DashboardService dashboardService;

  public DashboardController(DashboardService dashboardService) {
    this.dashboardService = dashboardService;
  }

  @Operation(
      summary = "Get Dashboard Summary",
      description = "Returns aggregated tenant-scoped KPI counters, entity breakdown, pipeline health, and data quality score.")
  @ApiResponse(responseCode = "200", description = "Dashboard summary retrieved successfully")
  @GetMapping("/summary")
  public ResponseEntity<DashboardSummaryDto> getSummary() {
    return ResponseEntity.ok(dashboardService.getSummary());
  }

  @Operation(
      summary = "Get Recent Activity",
      description = "Retrieves recent audit events including pipeline executions, entity resolutions, and connector updates.")
  @ApiResponse(responseCode = "200", description = "Activity items retrieved successfully")
  @GetMapping("/activity")
  public ResponseEntity<List<ActivityItemDto>> getActivity(
      @Parameter(description = "Maximum number of events to return (1-50)")
          @RequestParam(defaultValue = "20")
          @Min(1)
          @Max(50)
          int limit) {
    return ResponseEntity.ok(dashboardService.getActivity(limit));
  }

  @Operation(
      summary = "Get Time-Series Statistics",
      description = "Returns date-bucketed entity count and pipeline throughput metrics for charting.")
  @ApiResponse(responseCode = "200", description = "Time-series stats retrieved successfully")
  @GetMapping("/stats/timeseries")
  public ResponseEntity<List<TimeSeriesPointDto>> getTimeSeries(
      @Parameter(description = "Time window range (e.g. 7d, 14d, 30d)")
          @RequestParam(defaultValue = "7d")
          String range) {
    return ResponseEntity.ok(dashboardService.getTimeSeries(range));
  }
}
