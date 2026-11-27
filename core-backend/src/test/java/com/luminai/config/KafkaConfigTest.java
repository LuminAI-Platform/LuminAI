package com.luminai.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.core.ProducerFactory;
import org.springframework.test.util.ReflectionTestUtils;

class KafkaConfigTest {

  @Test
  void usesAlpineSafeGzipCompressionForProducerAndIngestRawTopic() {
    KafkaConfig config = new KafkaConfig();
    ReflectionTestUtils.setField(config, "bootstrapServers", "localhost:9092");
    ReflectionTestUtils.setField(config, "defaultPartitions", 3);
    ReflectionTestUtils.setField(config, "replicationFactor", (short) 1);

    ProducerFactory<String, Object> pf = config.producerFactory();
    assertThat(pf.getConfigurationProperties())
        .containsEntry(ProducerConfig.COMPRESSION_TYPE_CONFIG, "gzip");

    NewTopic ingestRaw = config.topicIngestRaw();
    assertThat(ingestRaw.configs()).containsEntry("compression.type", "gzip");
  }
}
