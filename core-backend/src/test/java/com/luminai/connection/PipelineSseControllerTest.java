package com.luminai.connection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.luminai.common.exception.GlobalExceptionHandler;
import com.luminai.connection.controller.PipelineSseController;
import com.luminai.connection.service.PipelineSseService;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

class PipelineSseControllerTest {

  private PipelineSseService pipelineSseService;
  private PipelineSseController controller;
  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    pipelineSseService = new PipelineSseService();
    controller = new PipelineSseController(pipelineSseService);
    mockMvc =
        MockMvcBuilders.standaloneSetup(controller)
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  @DisplayName("GET /api/v1/pipelines/stream returns 200 and registers SSE emitter")
  void streamPipelineEventsSuccess() throws Exception {
    mockMvc
        .perform(get("/api/v1/pipelines/stream"))
        .andExpect(status().isOk());

    assertThat(pipelineSseService.getConnectedClientCount()).isGreaterThanOrEqualTo(1);
  }

  @Test
  @DisplayName("GET /api/v1/pipelines/stream/{runId} returns 200 and registers scoped emitter")
  void streamPipelineRunEventsSuccess() throws Exception {
    String runId = "run-" + UUID.randomUUID();
    mockMvc
        .perform(get("/api/v1/pipelines/stream/" + runId))
        .andExpect(status().isOk());

    assertThat(pipelineSseService.getConnectedClientCount()).isGreaterThanOrEqualTo(1);
  }

  @Test
  @DisplayName("PipelineSseService emits progress, error, complete, and heartbeat events")
  void sseServiceEventLifecycle() {
    String runId = "run-test-456";
    SseEmitter emitter = pipelineSseService.createEmitter(null, runId);
    assertThat(emitter).isNotNull();
    assertThat(pipelineSseService.getConnectedClientCount()).isGreaterThanOrEqualTo(1);

    // Verify event methods execute without throwing
    pipelineSseService.emitProgress(runId, "cleaning", 50, "Cleaning in progress");
    pipelineSseService.emitError(runId, "cleaning", "Column null rate exceeded", "warning");
    pipelineSseService.sendHeartbeat();
    pipelineSseService.emitComplete(runId, 5000L, 4800L, 200L, "1m 30s");
  }
}
