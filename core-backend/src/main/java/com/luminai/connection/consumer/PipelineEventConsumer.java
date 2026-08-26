package com.luminai.connection.consumer;

import com.luminai.connection.model.PipelineRun;
import com.luminai.connection.model.PipelineRun.PipelineRunStatus;
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
 * and validated, updating the corresponding {@link PipelineRun} status and output counters.
 */
@Component
public class PipelineEventConsumer {

  private static final Logger log = LoggerFactory.getLogger(PipelineEventConsumer.class);

  private static final Set<String> ALLOWED_STATUSES = Set.of("CLEANED", "VALIDATED");

  private final PipelineRunRepository pipelineRunRepository;

  public PipelineEventConsumer(PipelineRunRepository pipelineRunRepository) {
    this.pipelineRunRepository = pipelineRunRepository;
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
      @Header(KafkaHeaders.RECEIVED_PARTITION) int partition,
      @Header(KafkaHeaders.OFFSET) long offset,
      Acknowledgment ack) {

    log.info(
        "Received ingest.valid event — partition={} offset={} payload={}",
        partition,
        offset,
        payload);

    try {
      UUID connectionId = UUID.fromString((String) payload.get("connectionId"));
      String rawStatus = (String) payload.getOrDefault("status", "VALIDATED");
      long recordsOutput = toLong(payload.getOrDefault("recordsOutput", 0));

      // Validate status against allowed values to prevent injection
      if (!ALLOWED_STATUSES.contains(rawStatus)) {
        log.error("Invalid status '{}' received in ingest.valid event — rejecting", rawStatus);
        ack.acknowledge();
        return;
      }

      PipelineRunStatus newStatus = PipelineRunStatus.valueOf(rawStatus);

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
                    "Updated PipelineRun '{}' for connection '{}' → status={}",
                    run.getId(),
                    connectionId,
                    newStatus);
              },
              () ->
                  log.warn(
                      "No active PipelineRun found for connectionId='{}' — skipping",
                      connectionId));

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
