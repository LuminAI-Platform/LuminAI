package com.luminai.connection.producer;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Component;

/**
 * Publishes parsed rows of raw datasets onto the Kafka topic {@code ingest.raw} inside standardized
 * event wrapper envelopes containing ingestion metadata, tenant keys, and column payloads.
 *
 * <p>Event envelope structure:
 *
 * <pre>
 * {
 *   "eventId":      "uuid",
 *   "tenantId":     "uuid",
 *   "connectionId": "uuid",
 *   "source":       "schema.table | filename",
 *   "ingestedAt":   "2026-01-01T00:00:00Z",
 *   "totalRows":    100,
 *   "rows": [
 *     { "column1": "value1", "column2": 42, ... },
 *     ...
 *   ]
 * }
 * </pre>
 */
@Component
public class ConnectionProducer {

  private static final Logger log = LoggerFactory.getLogger(ConnectionProducer.class);

  static final String TOPIC = "ingest.raw";

  private final KafkaTemplate<String, String> kafkaTemplate;
  private final ObjectMapper objectMapper;

  public ConnectionProducer(
      KafkaTemplate<String, String> kafkaTemplate, ObjectMapper objectMapper) {
    this.kafkaTemplate = kafkaTemplate;
    this.objectMapper = objectMapper;
  }

  /**
   * Publishes a batch of parsed rows as a single event envelope onto {@code ingest.raw}.
   *
   * <p>The Kafka message key is set to {@code tenantId} to ensure all events for the same tenant
   * land on the same partition, preserving ordering per tenant.
   *
   * @param tenantId the tenant UUID — used as the Kafka message key
   * @param connectionId the connection UUID the rows originated from
   * @param source a human-readable source label (e.g. "public.users" or "sales_2024.csv")
   * @param rows the parsed rows to publish; each row is a map of column name → value
   */
  public void publishRows(
      UUID tenantId, UUID connectionId, String source, List<Map<String, Object>> rows) {

    if (rows == null || rows.isEmpty()) {
      log.warn("publishRows called with empty rows for connection '{}' — skipping", connectionId);
      return;
    }

    IngestEvent event =
        new IngestEvent(
            UUID.randomUUID().toString(),
            tenantId.toString(),
            connectionId.toString(),
            source,
            Instant.now().toString(),
            rows.size(),
            rows);

    String payload = serialize(event);
    String messageKey = tenantId.toString();

    kafkaTemplate
        .send(TOPIC, messageKey, payload)
        .whenComplete(
            (result, ex) -> {
              if (ex != null) {
                log.error(
                    "Failed to publish {} rows from '{}' to topic '{}': {}",
                    rows.size(),
                    source,
                    TOPIC,
                    ex.getMessage(),
                    ex);
              } else {
                SendResult<String, String> sendResult = result;
                log.info(
                    "Published {} rows from '{}' to topic '{}' partition {} offset {}",
                    rows.size(),
                    source,
                    TOPIC,
                    sendResult.getRecordMetadata().partition(),
                    sendResult.getRecordMetadata().offset());
              }
            });
  }

  /**
   * Convenience method to publish a single row as an event envelope.
   *
   * @param tenantId the tenant UUID
   * @param connectionId the connection UUID
   * @param source the source label
   * @param row a single parsed row
   */
  public void publishRow(UUID tenantId, UUID connectionId, String source, Map<String, Object> row) {
    publishRows(tenantId, connectionId, source, List.of(row));
  }

  // ---------------------------------------------------------------------------
  // Event envelope record
  // ---------------------------------------------------------------------------

  /**
   * Standardized event wrapper envelope published to Kafka.
   *
   * @param eventId unique ID for this event
   * @param tenantId tenant that owns the data
   * @param connectionId connection the data was ingested from
   * @param source human-readable source label
   * @param ingestedAt ISO-8601 timestamp of ingestion
   * @param totalRows number of rows in this batch
   * @param rows the parsed row data
   */
  public record IngestEvent(
      String eventId,
      String tenantId,
      String connectionId,
      String source,
      String ingestedAt,
      int totalRows,
      List<Map<String, Object>> rows) {}

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private String serialize(IngestEvent event) {
    try {
      return objectMapper.writeValueAsString(event);
    } catch (JsonProcessingException e) {
      throw new RuntimeException("Failed to serialize IngestEvent to JSON: " + e.getMessage(), e);
    }
  }
}
