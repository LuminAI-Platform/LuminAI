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

  @GetMapping({"", "/runs"})
  @Operation(
      summary = "List pipeline execution runs",
      description =
          "Returns pipeline runs sorted by start time (most recent first), optionally filtered"
              + " by status, search query, connection ID, pipeline type, and sorted dynamically. Paginated via standard page/size query params.")
  public ResponseEntity<Page<PipelineRunDto>> listPipelineRuns(
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String search,
      @RequestParam(required = false) UUID connectionId,
      @RequestParam(required = false) String pipeline,
      @RequestParam(required = false) String sortBy,
      @RequestParam(required = false) String sortOrder,
      Pageable pageable) {
    return ResponseEntity.ok(
        pipelineMonitoringService.listPipelineRuns(
            status, search, connectionId, pipeline, sortBy, sortOrder, pageable));
  }

  @GetMapping("/runs/{id}")
  @Operation(
      summary = "Get pipeline run details",
      description = "Retrieves detailed execution metrics for a specific pipeline run by ID.")
  public ResponseEntity<PipelineRunDto> getPipelineRun(@PathVariable UUID id) {
    return ResponseEntity.ok(pipelineMonitoringService.getPipelineRunById(id));
  }

  @PostMapping("/runs/{id}/pause")
  @Operation(
      summary = "Pause a pipeline run",
      description = "Transitions an active pipeline run to PAUSED status.")
  public ResponseEntity<PipelineRunDto> pausePipelineRun(@PathVariable UUID id) {
    return ResponseEntity.ok(pipelineMonitoringService.pausePipelineRun(id));
  }

  @PostMapping("/runs/{id}/resume")
  @Operation(summary = "Resume a pipeline run", description = "Resumes a paused pipeline run.")
  public ResponseEntity<PipelineRunDto> resumePipelineRun(@PathVariable UUID id) {
    return ResponseEntity.ok(pipelineMonitoringService.resumePipelineRun(id));
  }

  @PostMapping("/runs/{id}/cancel")
  @Operation(
      summary = "Cancel a pipeline run",
      description = "Cancels a running or paused pipeline run.")
  public ResponseEntity<PipelineRunDto> cancelPipelineRun(@PathVariable UUID id) {
    return ResponseEntity.ok(pipelineMonitoringService.cancelPipelineRun(id));
  }

  @GetMapping("/runs/{id}/logs")
  @Operation(
      summary = "Get pipeline run logs",
      description = "Fetches execution log lines for a specific pipeline run.")
  public ResponseEntity<java.util.List<java.util.Map<String, Object>>> getPipelineRunLogs(
      @PathVariable UUID id,
      @RequestParam(required = false) String level,
      @RequestParam(required = false) Integer limit) {
    return ResponseEntity.ok(pipelineMonitoringService.getLogs(id, level, limit));
  }

  @GetMapping("/logs")
  @Operation(
      summary = "Get historical pipeline logs",
      description = "Fetches recent pipeline execution log lines.")
  public ResponseEntity<java.util.List<java.util.Map<String, Object>>> getPipelineLogs(
      @RequestParam(required = false) UUID runId,
      @RequestParam(required = false) String level,
      @RequestParam(required = false) Integer limit) {
    return ResponseEntity.ok(pipelineMonitoringService.getLogs(runId, level, limit));
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
