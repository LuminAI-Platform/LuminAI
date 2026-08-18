package com.luminai.graph.consumer;

import com.luminai.config.KafkaConfig;
import com.luminai.graph.EntityResolvedEvent;
import com.luminai.graph.service.Neo4jSyncService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.kafka.support.serializer.JsonDeserializer;
import org.springframework.stereotype.Component;

/**
 * Listens to {@link KafkaConfig#TOPIC_ENTITY_RESOLVED} and synchronizes resolved entities into
 * Neo4j in real time.
 *
 * <p>Reuses the project's existing {@code kafkaListenerContainerFactory} bean (manual-ack,
 * DLQ-backed {@code DefaultErrorHandler}) defined in {@link KafkaConfig} rather than introducing a
 * new Kafka configuration.
 *
 * <p>One per-listener override is necessary: the shared consumer factory configures {@code
 * JsonDeserializer} with {@code USE_TYPE_INFO_HEADERS=true}, which expects Spring's {@code
 * __TypeId__} record headers. Those headers are never present here because the producer of {@code
 * entity.resolved} is {@code data-engine} (Python, {@code confluent_kafka}), which writes plain
 * JSON with no Spring-specific headers. The {@code properties} below point the deserializer at
 * {@link EntityResolvedEvent} directly and disable the type-header lookup for this listener only —
 * every other listener on the shared factory is unaffected.
 *
 * <p>Kept intentionally thin: all Cypher/database logic lives in {@link Neo4jSyncService} and
 * {@link com.luminai.graph.repository.Neo4jGraphRepository}.
 */
@Component
public class GraphSyncConsumer {

  private static final Logger log = LoggerFactory.getLogger(GraphSyncConsumer.class);

  private final Neo4jSyncService syncService;

  public GraphSyncConsumer(Neo4jSyncService syncService) {
    this.syncService = syncService;
  }

  @KafkaListener(
      topics = KafkaConfig.TOPIC_ENTITY_RESOLVED,
      containerFactory = "kafkaListenerContainerFactory",
      properties = {
        JsonDeserializer.VALUE_DEFAULT_TYPE + "=com.luminai.graph.EntityResolvedEvent",
        JsonDeserializer.USE_TYPE_INFO_HEADERS + "=false"
      })
  public void onEntityResolved(EntityResolvedEvent event, Acknowledgment acknowledgment) {
    log.info(
        "Received entity.resolved event: golden_id={} tenant_id={} entity_type={}",
        event.goldenId(),
        event.tenantId(),
        event.entityType());

    syncService.sync(event);

    acknowledgment.acknowledge();
  }
}
