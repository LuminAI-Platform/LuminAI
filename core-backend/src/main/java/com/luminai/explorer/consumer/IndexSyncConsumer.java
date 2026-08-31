package com.luminai.explorer.consumer;

import com.luminai.config.KafkaConfig;
import com.luminai.explorer.service.OpenSearchIndexingService;
import com.luminai.graph.EntityResolvedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.kafka.support.serializer.JsonDeserializer;
import org.springframework.stereotype.Component;

/**
 * Listens to {@link KafkaConfig#TOPIC_ENTITY_RESOLVED} and synchronizes resolved entities into
 * OpenSearch in real time.
 */
@Component
public class IndexSyncConsumer {

  private static final Logger log = LoggerFactory.getLogger(IndexSyncConsumer.class);

  private final OpenSearchIndexingService indexingService;

  public IndexSyncConsumer(OpenSearchIndexingService indexingService) {
    this.indexingService = indexingService;
  }

  @KafkaListener(
      topics = KafkaConfig.TOPIC_ENTITY_RESOLVED,
      groupId = "luminai-explorer-opensearch-group",
      containerFactory = "kafkaListenerContainerFactory",
      properties = {
        JsonDeserializer.VALUE_DEFAULT_TYPE + "=com.luminai.graph.EntityResolvedEvent",
        JsonDeserializer.USE_TYPE_INFO_HEADERS + "=false"
      })
  public void onEntityResolved(EntityResolvedEvent event, Acknowledgment acknowledgment) {
    log.info(
        "Received entity.resolved event for OpenSearch indexing: golden_id={} tenant_id={} entity_type={}",
        event.goldenId(),
        event.tenantId(),
        event.entityType());

    indexingService.indexEntity(event);

    acknowledgment.acknowledge();
  }
}
