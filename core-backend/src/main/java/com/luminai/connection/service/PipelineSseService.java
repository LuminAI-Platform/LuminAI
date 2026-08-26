package com.luminai.connection.service;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Manages SSE emitter registrations and broadcasts pipeline progress events to connected clients.
 *
 * <p>Emitter lifecycle:
 *
 * <ul>
 *   <li>Created on client connect via {@link #createEmitter(UUID)}
 *   <li>Removed on client disconnect, timeout, or error
 * </ul>
 */
@Service
public class PipelineSseService {

  private static final Logger log = LoggerFactory.getLogger(PipelineSseService.class);

  /** SSE emitter timeout — 30 minutes. */
  private static final long EMITTER_TIMEOUT_MS = 30 * 60 * 1000L;

  /**
   * Active emitters keyed by a unique client ID. Value is an array: [SseEmitter, UUID connectionId
   * filter (nullable)]
   */
  private final List<EmitterEntry> emitters = new CopyOnWriteArrayList<>();

  private record EmitterEntry(String clientId, SseEmitter emitter, UUID connectionIdFilter) {}

  /**
   * Creates and registers a new SSE emitter for a client.
   *
   * @param connectionIdFilter optional connection ID to filter events; null means all events
   * @return the configured {@link SseEmitter}
   */
  public SseEmitter createEmitter(UUID connectionIdFilter) {
    String clientId = UUID.randomUUID().toString();
    SseEmitter emitter = new SseEmitter(EMITTER_TIMEOUT_MS);
    EmitterEntry entry = new EmitterEntry(clientId, emitter, connectionIdFilter);

    emitters.add(entry);
    log.info("SSE client registered — clientId={} filter={}", clientId, connectionIdFilter);

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

    return emitter;
  }

  /**
   * Broadcasts a pipeline event to all connected clients matching the connection filter.
   *
   * @param eventType the event type label (e.g. "JOB_PROGRESS", "JOB_COMPLETE")
   * @param connectionId the connection UUID the event belongs to
   * @param data the event payload
   */
  public void broadcast(String eventType, UUID connectionId, Map<String, Object> data) {
    List<EmitterEntry> stale = new CopyOnWriteArrayList<>();

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

  /** Returns the number of currently connected SSE clients. */
  public int getConnectedClientCount() {
    return emitters.size();
  }
}
