package com.luminai.connection.consumer;

import static org.assertj.core.api.Assertions.assertThat;

import com.luminai.TestcontainersConfig;
import com.luminai.connection.model.PipelineRun;
import com.luminai.connection.repository.PipelineRunRepository;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@Import(TestcontainersConfig.class)
@ActiveProfiles("test")
class PipelineEventConsumerTest {

  @Autowired private PipelineRunRepository pipelineRunRepository;

  @Autowired private KafkaTemplate<String, Object> kafkaTemplate;

  private UUID connectionId;

  @BeforeEach
  void setUp() {
    pipelineRunRepository.deleteAll();
    connectionId = UUID.randomUUID();

    PipelineRun run = new PipelineRun();
    run.setTenantId(UUID.randomUUID());
    run.setConnectionId(connectionId);
    run.setPipelineType("FILE");
    run.setStatus("INGESTING");
    run.setRecordsInput(100);
    pipelineRunRepository.save(run);
  }

  @Test
  void shouldUpdatePipelineRunStatusToValidated() throws Exception {
    Map<String, Object> payload = new HashMap<>();
    payload.put("connectionId", connectionId.toString());
    payload.put("status", "VALIDATED");
    payload.put("recordsOutput", 95);

    kafkaTemplate.send("ingest.valid", connectionId.toString(), payload);

    // Wait for listener to process
    Thread.sleep(3000);

    PipelineRun updated =
        pipelineRunRepository.findByConnectionId(connectionId).stream().findFirst().orElseThrow();

    assertThat(updated.getStatus()).isEqualTo("VALIDATED");
    assertThat(updated.getRecordsOutput()).isEqualTo(95);
  }

  @Test
  void shouldRejectInvalidStatus() throws Exception {
    Map<String, Object> payload = new HashMap<>();
    payload.put("connectionId", connectionId.toString());
    payload.put("status", "MALICIOUS'; DROP TABLE pipeline_runs;--");
    payload.put("recordsOutput", 0);

    kafkaTemplate.send("ingest.valid", connectionId.toString(), payload);

    // Wait for listener to process
    Thread.sleep(3000);

    PipelineRun unchanged =
        pipelineRunRepository.findByConnectionId(connectionId).stream().findFirst().orElseThrow();

    // Status should remain INGESTING — invalid status was rejected
    assertThat(unchanged.getStatus()).isEqualTo("INGESTING");
  }
}
