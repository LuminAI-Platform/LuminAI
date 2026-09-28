package com.luminai.connection.controller;

import com.luminai.connection.service.PipelineSseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Server-Sent Events (SSE) controller for real-time pipeline execution progress streaming. Emits
 * pipeline.progress, pipeline.error, and pipeline.complete events with a 15-second heartbeat ping.
 */
@RestController
@RequestMapping("/api/v1/pipelines")
@Tag(name = "Pipeline SSE", description = "Real-time pipeline progress streaming via SSE.")
public class PipelineSseController {

  private static final Logger log = LoggerFactory.getLogger(PipelineSseController.class);

  private final PipelineSseService pipelineSseService;

  public PipelineSseController(PipelineSseService pipelineSseService) {
    this.pipelineSseService = pipelineSseService;
  }

  /**
   * Opens an SSE stream for real-time pipeline progress events.
   *
   * @param connectionId optional filter — if provided, only events for this connection are emitted
   * @param runId optional filter — if provided, only events for this pipeline run are emitted
   * @return a long-lived SseEmitter pushing structured progress events
   */
  @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
  @Operation(
      summary = "Stream real-time pipeline progress",
      description =
          "Opens a Server-Sent Events stream. Clients receive live updates (pipeline.progress, "
              + "pipeline.error, pipeline.complete) and a 15-second ping heartbeat.")
  @ApiResponses({
    @ApiResponse(responseCode = "200", description = "SSE stream established successfully")
  })
  public SseEmitter streamPipelineEvents(
      @Parameter(description = "Filter by connection UUID") @RequestParam(required = false)
          UUID connectionId,
      @Parameter(description = "Filter by pipeline run ID") @RequestParam(required = false)
          String runId) {

    log.info("New SSE client connected — connId={}, runId={}", connectionId, runId);
    return pipelineSseService.createEmitter(connectionId, runId);
  }

  /**
   * Opens an SSE stream scoped specifically to a single pipeline run ID.
   *
   * @param runId target pipeline run identifier
   * @return SseEmitter streaming events for the designated run
   */
  @GetMapping(value = "/stream/{runId}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
  @Operation(
      summary = "Stream progress for a specific pipeline run",
      description = "Subscribes to real-time events for a specific pipeline execution run.")
  @ApiResponses({
    @ApiResponse(responseCode = "200", description = "SSE stream established for the given run")
  })
  public SseEmitter streamPipelineRunEvents(
      @Parameter(description = "Pipeline run UUID or ID", required = true) @PathVariable
          String runId) {

    log.info("New SSE client connected for runId={}", runId);
    return pipelineSseService.createEmitter(null, runId);
  }
}
