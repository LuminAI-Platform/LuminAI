package com.luminai.connection.producer;

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

  private final KafkaTemplate<String, Object> kafkaTemplate;

  public ConnectionProducer(KafkaTemplate<String, Object> kafkaTemplate) {
    this.kafkaTemplate = kafkaTemplate;
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
    publishRows(tenantId, connectionId, source, rows, true, null);
  }

  public void publishRows(
      UUID tenantId,
      UUID connectionId,
      String source,
      List<Map<String, Object>> rows,
      boolean batchComplete) {
    publishRows(tenantId, connectionId, source, rows, batchComplete, null);
  }

  public void publishRows(
      UUID tenantId,
      UUID connectionId,
      String source,
      List<Map<String, Object>> rows,
      boolean batchComplete,
      String objectKey) {
    int inferredTotal = rows != null ? rows.size() : 0;
    publishRows(
        tenantId, connectionId, source, rows, batchComplete, objectKey, inferredTotal, null);
  }

  public void publishRows(
      UUID tenantId,
      UUID connectionId,
      String source,
      List<Map<String, Object>> rows,
      boolean batchComplete,
      String objectKey,
      int actualTotalRows,
      Long fileSizeBytes) {

    if ((rows == null || rows.isEmpty()) && (objectKey == null || objectKey.isBlank())) {
      log.warn(
          "publishRows called with empty rows and no objectKey for connection '{}' — skipping",
          connectionId);
      return;
    }

    int rowCount = Math.max(actualTotalRows, rows != null ? rows.size() : 0);
    List<Map<String, Object>> safeRows = rows != null ? rows : List.of();

    IngestEvent event =
        new IngestEvent(
            UUID.randomUUID().toString(),
            tenantId.toString(),
            connectionId.toString(),
            source,
            Instant.now().toString(),
            rowCount,
            safeRows,
            batchComplete,
            objectKey,
            fileSizeBytes);

    String messageKey = tenantId.toString();

    // Pass the event object directly — KafkaTemplate<String, Object> with JsonSerializer
    // will serialize it once. Serializing to String here caused double-encode: the JSON
    // string would be re-serialized as a quoted JSON string literal, breaking consumers.
    kafkaTemplate
        .send(TOPIC, messageKey, event)
        .whenComplete(
            (result, ex) -> {
              if (ex != null) {
                log.error(
                    "Failed to publish {} rows from '{}' to topic '{}': {}",
                    rowCount,
                    source,
                    TOPIC,
                    ex.getMessage(),
                    ex);
              } else {
                SendResult<String, Object> sendResult = result;
                log.info(
                    "Published {} rows from '{}' to topic '{}' partition {} offset {}",
                    rowCount,
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
   * @param batchComplete flag indicating whether this event completes an ingestion batch
   * @param objectKey MinIO / S3 storage key pointing to the raw file
   */
  public record IngestEvent(
      String eventId,
      String tenantId,
      String connectionId,
      String source,
      String ingestedAt,
      int totalRows,
      List<Map<String, Object>> rows,
      @com.fasterxml.jackson.annotation.JsonProperty("batch_complete") boolean batchComplete,
      @com.fasterxml.jackson.annotation.JsonProperty("object_key") String objectKey,
      @com.fasterxml.jackson.annotation.JsonProperty("file_size_bytes") Long fileSizeBytes) {

    public IngestEvent(
        String eventId,
        String tenantId,
        String connectionId,
        String source,
        String ingestedAt,
        int totalRows,
        List<Map<String, Object>> rows,
        boolean batchComplete,
        String objectKey) {
      this(
          eventId,
          tenantId,
          connectionId,
          source,
          ingestedAt,
          totalRows,
          rows,
          batchComplete,
          objectKey,
          null);
    }

    public IngestEvent(
        String eventId,
        String tenantId,
        String connectionId,
        String source,
        String ingestedAt,
        int totalRows,
        List<Map<String, Object>> rows,
        boolean batchComplete) {
      this(
          eventId,
          tenantId,
          connectionId,
          source,
          ingestedAt,
          totalRows,
          rows,
          batchComplete,
          null,
          null);
    }

    public IngestEvent(
        String eventId,
        String tenantId,
        String connectionId,
        String source,
        String ingestedAt,
        int totalRows,
        List<Map<String, Object>> rows) {
      this(eventId, tenantId, connectionId, source, ingestedAt, totalRows, rows, true, null, null);
    }
  }
}
