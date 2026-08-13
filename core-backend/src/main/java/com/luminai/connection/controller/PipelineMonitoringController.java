package com.luminai.connection.controller;

import com.luminai.connection.dto.PipelineMetricsDto;
import com.luminai.connection.dto.PipelineRunDto;
import com.luminai.connection.service.PipelineMonitoringService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** REST API for pipeline execution status monitoring and throughput metrics. */
@RestController
@RequestMapping("/api/v1/pipelines")
@Tag(
    name = "Pipeline Monitoring",
    description = "Endpoints for monitoring active and historical pipeline execution runs.")
public class PipelineMonitoringController {

  private final PipelineMonitoringService pipelineMonitoringService;

  public PipelineMonitoringController(PipelineMonitoringService pipelineMonitoringService) {
    this.pipelineMonitoringService = pipelineMonitoringService;
  }

  @GetMapping("/runs")
  @Operation(
      summary = "List pipeline execution runs",
      description =
          "Returns pipeline runs sorted by start time (most recent first), optionally filtered"
              + " by status. Paginated via standard page/size query params.")
  public ResponseEntity<Page<PipelineRunDto>> listPipelineRuns(
      @RequestParam(required = false) String status, Pageable pageable) {
    return ResponseEntity.ok(pipelineMonitoringService.listPipelineRuns(status, pageable));
  }

  @GetMapping("/runs/{id}")
  @Operation(
      summary = "Get pipeline run details",
      description = "Retrieves detailed execution metrics for a specific pipeline run by ID.")
  public ResponseEntity<PipelineRunDto> getPipelineRun(@PathVariable UUID id) {
    return ResponseEntity.ok(pipelineMonitoringService.getPipelineRunById(id));
  }

  @GetMapping("/metrics")
  @Operation(
      summary = "Get pipeline summary metrics",
      description =
          "Aggregates total records cleaned, total entities resolved, active jobs count, and"
              + " failure metrics.")
  public ResponseEntity<PipelineMetricsDto> getPipelineMetrics() {
    return ResponseEntity.ok(pipelineMonitoringService.getPipelineMetrics());
  }
}
