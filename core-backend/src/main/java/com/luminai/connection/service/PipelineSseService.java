package com.luminai.connection.service;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Service managing real-time Server-Sent Events (SSE) for pipeline execution progress, errors, and
 * completions. Includes a 15-second heartbeat ping to keep connections alive.
 */
@Service
public class PipelineSseService {

  private static final Logger log = LoggerFactory.getLogger(PipelineSseService.class);

  /** SSE emitter timeout — 30 minutes. */
  private static final long EMITTER_TIMEOUT_MS = 30 * 60 * 1000L;

  /** Active emitters list. */
  private final List<EmitterEntry> emitters = new CopyOnWriteArrayList<>();

  /** Background heartbeat daemon scheduled executor. */
  private final ScheduledExecutorService heartbeatExecutor =
      Executors.newSingleThreadScheduledExecutor(
          r -> {
            Thread t = new Thread(r, "sse-heartbeat");
            t.setDaemon(true);
            return t;
          });

  public record EmitterEntry(
      String clientId, SseEmitter emitter, UUID connectionIdFilter, String runIdFilter) {}

  /** Start the 15-second heartbeat ping interval. */
  @PostConstruct
  public void startHeartbeat() {
    heartbeatExecutor.scheduleAtFixedRate(this::sendHeartbeat, 15, 15, TimeUnit.SECONDS);
  }

  /** Gracefully shutdown executor on container destroy. */
  @PreDestroy
  public void shutdown() {
    heartbeatExecutor.shutdown();
  }

  /** Creates an emitter with optional connection filter. */
  public SseEmitter createEmitter(UUID connectionIdFilter) {
    return createEmitter(connectionIdFilter, null);
  }

  /**
   * Creates and registers a new SSE emitter for a client with connection or runId filtering.
   *
   * @param connectionIdFilter optional connection ID to filter events
   * @param runIdFilter optional pipeline run ID to filter events
   * @return the configured SseEmitter
   */
  public SseEmitter createEmitter(UUID connectionIdFilter, String runIdFilter) {
    String clientId = UUID.randomUUID().toString();
    SseEmitter emitter = new SseEmitter(EMITTER_TIMEOUT_MS);
    EmitterEntry entry = new EmitterEntry(clientId, emitter, connectionIdFilter, runIdFilter);

    emitters.add(entry);
    log.info(
        "SSE client registered — clientId={} connFilter={} runFilter={}",
        clientId,
        connectionIdFilter,
        runIdFilter);

    emitter.onCompletion(
        () -> {
          emitters.remove(entry);
          log.info("SSE client disconnected — clientId={}", clientId);
        });

    emitter.onTimeout(
        () -> {
          emitters.remove(entry);
          log.info("SSE client timed out — clientId={}", clientId);
        });

    emitter.onError(
        ex -> {
          emitters.remove(entry);
          log.warn("SSE client error — clientId={}: {}", clientId, ex.getMessage());
        });

    // Send initial handshake confirmation event
    try {
      emitter.send(
          SseEmitter.event()
              .name("pipeline.connected")
              .data(
                  Map.of(
                      "status",
                      "CONNECTED",
                      "clientId",
                      clientId,
                      "timestamp",
                      Instant.now().toString())));
    } catch (IOException e) {
      emitters.remove(entry);
    }

    return emitter;
  }

  /** Emits a step-level progress update event (MVP-05). Event: pipeline.progress */
  public void emitProgress(String runId, String step, int progress, String message) {
    Map<String, Object> data =
        Map.of(
            "runId", runId,
            "step", step,
            "progress", progress,
            "message", message != null ? message : "");
    broadcastToRun("pipeline.progress", runId, data);
  }

  /** Emits an error notification event (MVP-05). Event: pipeline.error */
  public void emitError(String runId, String step, String error, String severity) {
    Map<String, Object> data =
        Map.of(
            "runId", runId,
            "step", step,
            "error", error,
            "severity", severity != null ? severity : "error");
    broadcastToRun("pipeline.error", runId, data);
  }

  /**
   * Emits a pipeline run completion event and completes associated run emitters (MVP-05). Event:
   * pipeline.complete
   */
  public void emitComplete(
      String runId, long totalRecords, long cleanedRecords, long errorsCount, String duration) {
    Map<String, Object> data =
        Map.of(
            "runId", runId,
            "totalRecords", totalRecords,
            "cleanedRecords", cleanedRecords,
            "errorsCount", errorsCount,
            "duration", duration != null ? duration : "0s");
    broadcastToRun("pipeline.complete", runId, data);

    // Gracefully complete any emitter subscribed specifically to this runId
    for (EmitterEntry entry : emitters) {
      if (runId.equals(entry.runIdFilter())) {
        try {
          entry.emitter().complete();
        } catch (Exception ignored) {
          // ignore already completed
        }
      }
    }
  }

  /** Broadcasts an event to all subscribers matching the given runId filter. */
  public void broadcastToRun(String eventType, String runId, Map<String, Object> data) {
    List<EmitterEntry> stale = new ArrayList<>();

    for (EmitterEntry entry : emitters) {
      if (entry.runIdFilter() != null && !entry.runIdFilter().equals(runId)) {
        continue;
      }

      try {
        entry.emitter().send(SseEmitter.event().name(eventType).data(data));
      } catch (IOException e) {
        log.warn("Failed to send SSE event to clientId={} — marking stale", entry.clientId());
        stale.add(entry);
      }
    }

    emitters.removeAll(stale);
  }

  /** Broadcasts a pipeline event to all connected clients matching the connection filter. */
  public void broadcast(String eventType, UUID connectionId, Map<String, Object> data) {
    List<EmitterEntry> stale = new ArrayList<>();

    for (EmitterEntry entry : emitters) {
      if (entry.connectionIdFilter() != null && !entry.connectionIdFilter().equals(connectionId)) {
        continue;
      }

      try {
        entry.emitter().send(SseEmitter.event().name(eventType).data(data));
      } catch (IOException e) {
        log.warn("Failed to send SSE event to clientId={} — marking stale", entry.clientId());
        stale.add(entry);
      }
    }

    emitters.removeAll(stale);
  }

  /** Sends a 15-second heartbeat ping to all connected clients. */
  public void sendHeartbeat() {
    if (emitters.isEmpty()) return;
    List<EmitterEntry> stale = new ArrayList<>();

    for (EmitterEntry entry : emitters) {
      try {
        entry
            .emitter()
            .send(
                SseEmitter.event()
                    .name("ping")
                    .data(Map.of("heartbeat", System.currentTimeMillis())));
      } catch (Exception e) {
        stale.add(entry);
      }
    }

    emitters.removeAll(stale);
  }

  /** Returns the number of currently connected SSE clients. */
  public int getConnectedClientCount() {
    return emitters.size();
  }
}
