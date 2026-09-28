package com.luminai.connection.consumer;

import com.luminai.auth.repository.TenantRepository;
import com.luminai.common.tenant.TenantContext;
import com.luminai.connection.model.PipelineRun;
import com.luminai.connection.model.PipelineRun.PipelineRunStatus;
import com.luminai.connection.repository.ConnectionRepository;
import com.luminai.connection.repository.PipelineRunRepository;
import java.util.Map;
import java.util.Set;
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
 * Kafka listener for the {@code ingest.valid} topic.
 *
 * <p>Processes validation events emitted by the Data Engine after a pipeline run has been cleaned
 * and validated, updating the corresponding {@link PipelineRun} status and output counters under
 * the correct tenant schema context.
 */
@Component
public class PipelineEventConsumer {

  private static final Logger log = LoggerFactory.getLogger(PipelineEventConsumer.class);

  private static final Set<String> ALLOWED_STATUSES = Set.of("CLEANED", "VALIDATED");

  private final PipelineRunRepository pipelineRunRepository;
  private final ConnectionRepository connectionRepository;
  private final TenantRepository tenantRepository;

  public PipelineEventConsumer(
      PipelineRunRepository pipelineRunRepository,
      ConnectionRepository connectionRepository,
      TenantRepository tenantRepository) {
    this.pipelineRunRepository = pipelineRunRepository;
    this.connectionRepository = connectionRepository;
    this.tenantRepository = tenantRepository;
  }

  /**
   * Handles {@code ingest.valid} events.
   *
   * <p>Expected payload fields:
   *
   * <ul>
   *   <li>{@code connectionId} — UUID of the connection
   *   <li>{@code pipelineType} — pipeline type label
   *   <li>{@code status} — either {@code "CLEANED"} or {@code "VALIDATED"}
   *   <li>{@code recordsOutput} — number of valid records output
   * </ul>
   */
  @KafkaListener(
      topics = "ingest.valid",
      groupId = "${spring.kafka.consumer.group-id}",
      containerFactory = "kafkaListenerContainerFactory")
  public void onIngestValid(
      @Payload Map<String, Object> payload,
      @Header(value = KafkaHeaders.RECEIVED_KEY, required = false) String messageKey,
      @Header(KafkaHeaders.RECEIVED_PARTITION) int partition,
      @Header(KafkaHeaders.OFFSET) long offset,
      Acknowledgment ack) {

    log.info(
        "Received ingest.valid event — partition={} offset={} payload={}",
        partition,
        offset,
        payload);

    try {
      String rawConnectionId =
          (String)
              (payload.get("connectionId") != null
                  ? payload.get("connectionId")
                  : payload.get("source_id"));
      if (rawConnectionId == null) {
        log.error("Missing connectionId/source_id in ingest.valid event — rejecting");
        ack.acknowledge();
        return;
      }

      UUID connectionId = UUID.fromString(rawConnectionId);
      String rawStatus = (String) payload.getOrDefault("status", "VALIDATED");
      if ("valid".equalsIgnoreCase(rawStatus)) {
        rawStatus = "VALIDATED";
      }

      long recordsOutput =
          toLong(
              payload.get("recordsOutput") != null
                  ? payload.get("recordsOutput")
                  : payload.getOrDefault("record_count", 0));

      // Validate status against allowed values to prevent injection
      if (!ALLOWED_STATUSES.contains(rawStatus)) {
        log.error("Invalid status '{}' received in ingest.valid event — rejecting", rawStatus);
        ack.acknowledge();
        return;
      }

      PipelineRunStatus newStatus = PipelineRunStatus.valueOf(rawStatus);

      // Resolve tenant context for multi-tenant schema isolation
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
        TenantContext.setTenant(tenantId, tenantSlug);
      }

      try {
        pipelineRunRepository.findByConnectionId(connectionId).stream()
            .filter(
                run ->
                    run.getStatus() == PipelineRunStatus.PENDING
                        || run.getStatus() == PipelineRunStatus.INGESTING)
            .findFirst()
            .ifPresentOrElse(
                run -> {
                  run.setStatus(newStatus);
                  run.setRecordsOutput(run.getRecordsOutput() + recordsOutput);
                  pipelineRunRepository.save(run);
                  log.info(
                      "Updated PipelineRun '{}' for connection '{}' (tenant={}) → status={}",
                      run.getId(),
                      connectionId,
                      TenantContext.getTenantSlug(),
                      newStatus);
                },
                () ->
                    log.warn(
                        "No active PipelineRun found for connectionId='{}' (tenant={}) — skipping",
                        connectionId,
                        TenantContext.getTenantSlug()));
      } finally {
        TenantContext.clear();
      }

      ack.acknowledge();

    } catch (Exception e) {
      log.error(
          "Failed to process ingest.valid event at partition={} offset={}: {}",
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
