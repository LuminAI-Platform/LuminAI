package com.luminai.connection.consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.luminai.connection.model.PipelineRun;
import com.luminai.connection.model.PipelineRun.PipelineRunStatus;
import com.luminai.connection.repository.PipelineRunRepository;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.support.Acknowledgment;

@ExtendWith(MockitoExtension.class)
class EntityResolvedConsumerTest {

  @Mock private PipelineRunRepository pipelineRunRepository;
  @Mock private Acknowledgment acknowledgment;

  private EntityResolvedConsumer consumer;
  private UUID connectionId;
  private PipelineRun existingRun;

  @BeforeEach
  void setUp() {
    consumer = new EntityResolvedConsumer(pipelineRunRepository);
    connectionId = UUID.randomUUID();

    existingRun = new PipelineRun();
    existingRun.setId(UUID.randomUUID());
    existingRun.setTenantId(UUID.randomUUID());
    existingRun.setConnectionId(connectionId);
    existingRun.setPipelineType("FILE");
    existingRun.setStatus(PipelineRunStatus.VALIDATED);
    existingRun.setRecordsInput(100);
    existingRun.setRecordsOutput(95);
  }

  @Test
  void shouldMarkPipelineRunCompletedWhenEntityResolved() {
    when(pipelineRunRepository.findByConnectionId(connectionId)).thenReturn(List.of(existingRun));

    Map<String, Object> payload = new HashMap<>();
    payload.put("connectionId", connectionId.toString());
    payload.put("resolvedEntities", 90);

    consumer.onEntityResolved(payload, 0, 0L, acknowledgment);

    ArgumentCaptor<PipelineRun> captor = ArgumentCaptor.forClass(PipelineRun.class);
    verify(pipelineRunRepository).save(captor.capture());
    PipelineRun saved = captor.getValue();

    assertThat(saved.getStatus()).isEqualTo(PipelineRunStatus.COMPLETED);
    assertThat(saved.getMetadata()).contains("90");
    assertThat(saved.getCompletedAt()).isNotNull();
    verify(acknowledgment).acknowledge();
  }

  @Test
  void shouldSafelyAcknowledgeWhenConnectionIdIsMissing() {
    Map<String, Object> payload = new HashMap<>();
    payload.put("golden_id", "gr-123");
    payload.put("entity_type", "Person");

    consumer.onEntityResolved(payload, 0, 0L, acknowledgment);

    verify(pipelineRunRepository, never()).save(any());
    verify(acknowledgment).acknowledge();
  }

  @Test
  void shouldRejectNegativeResolvedEntities() {
    Map<String, Object> payload = new HashMap<>();
    payload.put("connectionId", connectionId.toString());
    payload.put("resolvedEntities", -5);

    consumer.onEntityResolved(payload, 0, 0L, acknowledgment);

    verify(pipelineRunRepository, never()).save(any());
    verify(acknowledgment).acknowledge();
  }
}
