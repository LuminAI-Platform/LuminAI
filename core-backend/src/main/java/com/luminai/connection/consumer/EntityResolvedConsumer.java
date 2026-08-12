package com.luminai.connection.consumer;

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

  private final PipelineRunRepository pipelineRunRepository;

  public EntityResolvedConsumer(PipelineRunRepository pipelineRunRepository) {
    this.pipelineRunRepository = pipelineRunRepository;
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
      @Header(KafkaHeaders.RECEIVED_PARTITION) int partition,
      @Header(KafkaHeaders.OFFSET) long offset,
      Acknowledgment ack) {

    log.info(
        "Received entity.resolved event — partition={} offset={} payload={}",
        partition,
        offset,
        payload);

    try {
      UUID connectionId = UUID.fromString((String) payload.get("connectionId"));
      long resolvedEntities = toLong(payload.getOrDefault("resolvedEntities", 0));

      pipelineRunRepository.findByConnectionId(connectionId).stream()
          .filter(run -> "VALIDATED".equals(run.getStatus()) || "CLEANED".equals(run.getStatus()))
          .findFirst()
          .ifPresentOrElse(
              run -> {
                run.setStatus("COMPLETED");
                run.setCompletedAt(Instant.now());
                run.setMetadata(String.format("{\"resolvedEntities\": %d}", resolvedEntities));
                pipelineRunRepository.save(run);
                log.info(
                    "Marked PipelineRun '{}' COMPLETED for connection '{}' — resolvedEntities={}",
                    run.getId(),
                    connectionId,
                    resolvedEntities);
              },
              () ->
                  log.warn(
                      "No active PipelineRun found for connectionId='{}' — skipping",
                      connectionId));

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
