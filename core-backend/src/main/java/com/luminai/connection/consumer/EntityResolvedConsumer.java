package com.luminai.connection.consumer;

import com.luminai.connection.model.PipelineRun.PipelineRunStatus;
import com.luminai.connection.repository.PipelineRunRepository;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Component;

/**
 * Kafka listener for the {@code entity.resolved} topic.
 *
 * <p>Processes entity resolution events emitted by the Data Engine after golden records have been
 * resolved, marking the pipeline run as {@code COMPLETED} and saving resolved entity metrics.
 */
@Component
public class EntityResolvedConsumer {

  private static final Logger log = LoggerFactory.getLogger(EntityResolvedConsumer.class);

  private static final PipelineRunStatus COMPLETED_STATUS = PipelineRunStatus.COMPLETED;

  private final PipelineRunRepository pipelineRunRepository;
  private final com.luminai.connection.repository.ConnectionRepository connectionRepository;
  private final com.luminai.auth.repository.TenantRepository tenantRepository;

  public EntityResolvedConsumer(
      PipelineRunRepository pipelineRunRepository,
      com.luminai.connection.repository.ConnectionRepository connectionRepository,
      com.luminai.auth.repository.TenantRepository tenantRepository) {
    this.pipelineRunRepository = pipelineRunRepository;
    this.connectionRepository = connectionRepository;
    this.tenantRepository = tenantRepository;
  }

  /**
   * Handles {@code entity.resolved} events.
   *
   * <p>Expected payload fields:
   *
   * <ul>
   *   <li>{@code connectionId} — UUID of the connection
   *   <li>{@code resolvedEntities} — count of golden records resolved
   * </ul>
   */
  @KafkaListener(
      topics = "entity.resolved",
      groupId = "${spring.kafka.consumer.group-id}",
      containerFactory = "kafkaListenerContainerFactory")
  public void onEntityResolved(
      @Payload Map<String, Object> payload,
      @Header(value = KafkaHeaders.RECEIVED_KEY, required = false) String messageKey,
      @Header(KafkaHeaders.RECEIVED_PARTITION) int partition,
      @Header(KafkaHeaders.OFFSET) long offset,
      Acknowledgment ack) {

    log.info(
        "Received entity.resolved event — partition={} offset={} payload={}",
        partition,
        offset,
        payload);

    try {
      Object rawConnId =
          payload.get("connectionId") != null
              ? payload.get("connectionId")
              : payload.get("source_id");
      if (rawConnId == null) {
        log.debug("entity.resolved event without connectionId/source_id — acknowledging message");
        ack.acknowledge();
        return;
      }

      UUID connectionId = UUID.fromString((String) rawConnId);
      long resolvedEntities =
          toLong(
              payload.get("resolvedEntities") != null
                  ? payload.get("resolvedEntities")
                  : payload.getOrDefault("record_count", 0));

      // Validate resolvedEntities is non-negative
      if (resolvedEntities < 0) {
        log.error("Invalid resolvedEntities '{}' received — rejecting event", resolvedEntities);
        ack.acknowledge();
        return;
      }

      UUID tenantId = null;
      String tenantSlug = null;
      Object rawTenant =
          payload.get("tenantId") != null ? payload.get("tenantId") : payload.get("tenant_id");
      if (rawTenant instanceof String s && !s.isBlank()) {
        try {
          tenantId = UUID.fromString(s);
        } catch (IllegalArgumentException ignored) {
          tenantSlug = s;
        }
      }

      if (tenantId == null
          && tenantSlug == null
          && messageKey != null
          && messageKey.contains(":")) {
        String keyPart = messageKey.split(":")[0];
        try {
          tenantId = UUID.fromString(keyPart);
        } catch (IllegalArgumentException ignored) {
          tenantSlug = keyPart;
        }
      }

      if (tenantId == null && tenantSlug == null) {
        var connOpt = connectionRepository.findById(connectionId);
        if (connOpt.isPresent()) {
          tenantId = connOpt.get().getTenantId();
        }
      }

      if (tenantId != null) {
        var tOpt = tenantRepository.findById(tenantId);
        if (tOpt.isPresent()) {
          tenantSlug = tOpt.get().getSlug();
        }
      } else if (tenantSlug != null) {
        var tOpt = tenantRepository.findBySlug(tenantSlug);
        if (tOpt.isPresent()) {
          tenantId = tOpt.get().getId();
        }
      }

      if (tenantId != null && tenantSlug != null) {
        com.luminai.common.tenant.TenantContext.setTenant(tenantId, tenantSlug);
      }

      try {
        pipelineRunRepository.findByConnectionId(connectionId).stream()
            .filter(
                run ->
                    run.getStatus() == PipelineRunStatus.VALIDATED
                        || run.getStatus() == PipelineRunStatus.CLEANED)
            .findFirst()
            .ifPresentOrElse(
                run -> {
                  run.setStatus(COMPLETED_STATUS);
                  run.setCompletedAt(Instant.now());
                  // Use long value directly — safe from injection since it's a numeric type
                  run.setMetadata("{\"resolvedEntities\":" + resolvedEntities + "}");
                  pipelineRunRepository.save(run);
                  log.info(
                      "Marked PipelineRun '{}' COMPLETED for connection '{}' (tenant={}) — resolvedEntities={}",
                      run.getId(),
                      connectionId,
                      com.luminai.common.tenant.TenantContext.getTenantSlug(),
                      resolvedEntities);
                },
                () ->
                    log.warn(
                        "No active PipelineRun found for connectionId='{}' (tenant={}) — skipping",
                        connectionId,
                        com.luminai.common.tenant.TenantContext.getTenantSlug()));
      } finally {
        com.luminai.common.tenant.TenantContext.clear();
      }

      ack.acknowledge();

    } catch (Exception e) {
      log.error(
          "Failed to process entity.resolved event at partition={} offset={}: {}",
          partition,
          offset,
          e.getMessage(),
          e);
      throw e;
    }
  }

  private long toLong(Object value) {
    if (value instanceof Number n) return n.longValue();
    return Long.parseLong(String.valueOf(value));
  }
}
