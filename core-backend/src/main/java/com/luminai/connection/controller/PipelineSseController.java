package com.luminai.connection.controller;

import com.luminai.connection.service.PipelineSseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Server-Sent Events (SSE) controller for real-time pipeline progress streaming.
 *
 * <p>Clients connect to {@code GET /api/v1/pipelines/stream} and receive live push events as
 * pipeline jobs progress through their lifecycle stages.
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
   * <p>Emits events of type: {@code JOB_PROGRESS}, {@code RECORD_CLEANED}, {@code ENTITY_MATCHED},
   * {@code JOB_COMPLETE}.
   *
   * @param connectionId optional filter — if provided, only events for this connection are emitted
   * @return a long-lived {@link SseEmitter} that pushes events to the client
   */
  @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
  @Operation(
      summary = "Stream real-time pipeline progress",
      description =
          "Opens a Server-Sent Events stream. Clients receive live updates as pipeline jobs"
              + " progress. Optionally filter by connectionId.")
  public SseEmitter streamPipelineEvents(@RequestParam(required = false) UUID connectionId) {

    log.info("New SSE client connected — connectionId filter: {}", connectionId);
    return pipelineSseService.createEmitter(connectionId);
  }
}
