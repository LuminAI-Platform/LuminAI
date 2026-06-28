package com.luminai.config;

import java.util.HashMap;
import java.util.Map;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.apache.kafka.common.serialization.StringSerializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.*;
import org.springframework.kafka.listener.ContainerProperties;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.kafka.support.serializer.JsonDeserializer;
import org.springframework.kafka.support.serializer.JsonSerializer;
import org.springframework.util.backoff.FixedBackOff;

@EnableKafka
@Configuration
public class KafkaConfig {
  private static final Logger log = LoggerFactory.getLogger(KafkaConfig.class);

  // DLG retry policy
  // Number of delivery attempts before a message is routed to the DLQ
  private static final int DLQ_MAX_ATTEMPTS = 3;

  // Fixed back-off interval between retry attempts (milliseconds)
  private static final long DLQ_BACKOFF_MS = 500L;

  // Topic constants
  public static final String TOPIC_INGEST_RAW = "ingest.raw";
  public static final String TOPIC_INGEST_VALID = "ingest.valid";
  public static final String TOPIC_ENTITY_RESOLVED = "entity.resolved";
  public static final String TOPIC_ENTITY_UPDATED = "entity.updated";
  public static final String TOPIC_AUDIT_LOG = "audit.log";
  public static final String TOPIC_ALERTS_TRIGGERED = "alerts.triggered";
  public static final String TOPIC_DEAD_LETTER = "ingest.dead_letter";

  // Injected properties (from application-dev.yml)
  @Value("${spring.kafka.bootstrap-servers}")
  private String bootstrapServers;

  @Value("${spring.kafka.consumer.group-id}")
  private String consumerGroupId;

  @Value("${luminai.kafka.topic.partitions:3}")
  private int defaultPartitions;

  @Value("${luminai.kafka.topic.replication-factor:1}")
  private short replicationFactor;

  // ===========================================================
  // PRODUCER
  // ===========================================================
  @Bean
  public ProducerFactory<String, Object> producerFactory() {
    Map<String, Object> props = new HashMap<>();

    props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
    props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
    props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, JsonSerializer.class);

    // Idempotent producer — prevents duplicate messages on broker retry
    props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);
    props.put(ProducerConfig.ACKS_CONFIG, "all");
    props.put(ProducerConfig.RETRIES_CONFIG, 3);
    props.put(ProducerConfig.MAX_IN_FLIGHT_REQUESTS_PER_CONNECTION, 5);

    // Throughput tuning
    props.put(ProducerConfig.LINGER_MS_CONFIG, 5);
    props.put(ProducerConfig.BATCH_SIZE_CONFIG, 16_384);
    props.put(ProducerConfig.COMPRESSION_TYPE_CONFIG, "snappy");

    // Include type information in the JSON payload so the consumer can
    // deserialise into the correct class without extra configuration.
    props.put(JsonSerializer.ADD_TYPE_INFO_HEADERS, true);

    log.info("Kafka Producer Factory configured -> {}", bootstrapServers);
    return new DefaultKafkaProducerFactory<>(props);
  }

  // KafkaTemplate — the primary bean for publishing messages
  @Bean
  public KafkaTemplate<String, Object> kafkaTemplate() {
    KafkaTemplate<String, Object> kafkaTemplate = new KafkaTemplate<>(producerFactory());
    kafkaTemplate.setObservationEnabled(true); // Micrometer timing
    return kafkaTemplate;
  }

  // ===========================================================
  // CONSUMER
  // ===========================================================

  @Bean
  public ConsumerFactory<String, Object> consumerFactory() {
    Map<String, Object> props = new HashMap<>();

    props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
    props.put(ConsumerConfig.GROUP_ID_CONFIG, consumerGroupId);
    props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
    props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, JsonDeserializer.class);

    // Offset management
    props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
    props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false);

    // Throughput / latency tuning
    props.put(ConsumerConfig.MAX_POLL_RECORDS_CONFIG, 50);
    props.put(ConsumerConfig.FETCH_MIN_BYTES_CONFIG, 1);
    props.put(ConsumerConfig.FETCH_MAX_WAIT_MS_CONFIG, 500);

    // Trust all packages for JSON deserialisation.
    // Restrict to specific packages in production:
    //   props.put(JsonDeserializer.TRUSTED_PACKAGES, "com.luminai.model.events");
    props.put(JsonDeserializer.TRUSTED_PACKAGES, "*");
    props.put(JsonDeserializer.USE_TYPE_INFO_HEADERS, true);

    return new DefaultKafkaConsumerFactory<>(props);
  }

  // Dead letter publishing recoverer
  @Bean
  public DeadLetterPublishingRecoverer deadLetterPublishingRecoverer() {
    return new DeadLetterPublishingRecoverer(
        kafkaTemplate(),
        // Route ALL failed messages to the single dead-letter topic, partition 0
        (record, exception) -> {
          log.error(
              "Routing failed message to DLQ. topic={}, partition={}, offset={}, error={}",
              record.topic(),
              record.partition(),
              record.offset(),
              exception.getMessage());
          return new org.apache.kafka.common.TopicPartition(TOPIC_DEAD_LETTER, 0);
        });
  }

  // Error handler with fixed back-off and dead-letter recovery
  @Bean
  public DefaultErrorHandler kafkaErrorHandler() {
    FixedBackOff backOff = new FixedBackOff(DLQ_BACKOFF_MS, DLQ_MAX_ATTEMPTS - 1L);

    DefaultErrorHandler errorHandler =
        new DefaultErrorHandler(deadLetterPublishingRecoverer(), backOff);

    // Do NOT retry on deserialisation or permanent data errors
    errorHandler.addNotRetryableExceptions(
        org.apache.kafka.common.errors.SerializationException.class,
        com.fasterxml.jackson.core.JsonParseException.class,
        com.fasterxml.jackson.databind.exc.InvalidDefinitionException.class,
        IllegalArgumentException.class);

    errorHandler.setRetryListeners(
        (record, ex, deliveryAttempt) ->
            log.warn(
                "Kafka retry attempt {}/{} for topic={} partition={} offset={}",
                deliveryAttempt,
                DLQ_MAX_ATTEMPTS,
                record.topic(),
                record.partition(),
                record.offset()));

    return errorHandler;
  }

  // Listener container factory — wires the consumer factory, error handler and acknowledgement mode
  // together
  @Bean
  public ConcurrentKafkaListenerContainerFactory<String, Object> kafkaListenerContainerFactory() {
    ConcurrentKafkaListenerContainerFactory<String, Object> factory =
        new ConcurrentKafkaListenerContainerFactory<>();

    factory.setConsumerFactory(consumerFactory());
    factory.setCommonErrorHandler(kafkaErrorHandler());

    // Manual acknowledgement — offset committed only after listener returns successfully
    factory.getContainerProperties().setAckMode(ContainerProperties.AckMode.MANUAL_IMMEDIATE);

    factory.setConcurrency(3);

    // Micrometer observation for distributed tracing
    factory.getContainerProperties().setObservationEnabled(true);

    log.info("KafkaListenerContainerFactory configured: concurrency=3, ackMode=MANUAL_IMMEDIATE");
    return factory;
  }

  // =========================================================================
  // TOPIC AUTO-PROVISIONING
  // =========================================================================

  @Bean
  public NewTopic topicIngestRaw() {
    return TopicBuilder.name(TOPIC_INGEST_RAW)
        .partitions(6)
        .replicas(replicationFactor)
        .config("retention.ms", String.valueOf(7 * 24 * 60 * 60 * 1000L)) // 7 days
        .config("compression.type", "snappy")
        .build();
  }

  @Bean
  public NewTopic topicIngestValid() {
    return TopicBuilder.name(TOPIC_INGEST_VALID)
        .partitions(defaultPartitions)
        .replicas(replicationFactor)
        .config("retention.ms", String.valueOf(7 * 24 * 60 * 60 * 1000L))
        .build();
  }

  @Bean
  public NewTopic topicEntityResolved() {
    return TopicBuilder.name(TOPIC_ENTITY_RESOLVED)
        .partitions(defaultPartitions)
        .replicas(replicationFactor)
        .config("retention.ms", String.valueOf(14 * 24 * 60 * 60 * 1000L)) // 14 days
        .build();
  }

  @Bean
  public NewTopic topicEntityUpdated() {
    return TopicBuilder.name(TOPIC_ENTITY_UPDATED)
        .partitions(defaultPartitions)
        .replicas(replicationFactor)
        .config("retention.ms", String.valueOf(14 * 24 * 60 * 60 * 1000L))
        .build();
  }

  @Bean
  public NewTopic topicAuditLog() {
    return TopicBuilder.name(TOPIC_AUDIT_LOG)
        .partitions(defaultPartitions)
        .replicas(replicationFactor)
        .config("cleanup.policy", "compact")
        .config("retention.ms", String.valueOf(90 * 24 * 60 * 60 * 1000L)) // 90 days
        .config("min.cleanable.dirty.ratio", "0.1")
        .build();
  }

  @Bean
  public NewTopic topicAlertsTriggered() {
    return TopicBuilder.name(TOPIC_ALERTS_TRIGGERED)
        .partitions(defaultPartitions)
        .replicas(replicationFactor)
        .config("retention.ms", String.valueOf(3 * 24 * 60 * 60 * 1000L)) // 3 days
        .build();
  }

  @Bean
  public NewTopic topicDeadLetter() {
    return TopicBuilder.name(TOPIC_DEAD_LETTER)
        .partitions(1)
        .replicas(replicationFactor)
        .config("retention.ms", String.valueOf(30 * 24 * 60 * 60 * 1000L)) // 30 days
        .config("compression.type", "gzip")
        .build();
  }
}
