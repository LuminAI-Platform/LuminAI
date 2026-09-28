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
class PipelineEventConsumerTest {

  @Mock private PipelineRunRepository pipelineRunRepository;
  @Mock private com.luminai.connection.repository.ConnectionRepository connectionRepository;
  @Mock private com.luminai.auth.repository.TenantRepository tenantRepository;
  @Mock private Acknowledgment acknowledgment;

  private PipelineEventConsumer consumer;
  private UUID connectionId;
  private PipelineRun existingRun;

  @BeforeEach
  void setUp() {
    consumer =
        new PipelineEventConsumer(pipelineRunRepository, connectionRepository, tenantRepository);
    connectionId = UUID.randomUUID();

    existingRun = new PipelineRun();
    existingRun.setId(UUID.randomUUID());
    existingRun.setTenantId(UUID.randomUUID());
    existingRun.setConnectionId(connectionId);
    existingRun.setPipelineType("FILE");
    existingRun.setStatus(PipelineRunStatus.INGESTING);
    existingRun.setRecordsInput(100);
    existingRun.setRecordsOutput(0);
  }

  @Test
  void shouldUpdatePipelineRunStatusToValidated() {
    when(pipelineRunRepository.findByConnectionId(connectionId)).thenReturn(List.of(existingRun));

    Map<String, Object> payload = new HashMap<>();
    payload.put("connectionId", connectionId.toString());
    payload.put("status", "VALIDATED");
    payload.put("recordsOutput", 95);

    consumer.onIngestValid(payload, null, 0, 0L, acknowledgment);

    ArgumentCaptor<PipelineRun> captor = ArgumentCaptor.forClass(PipelineRun.class);
    verify(pipelineRunRepository).save(captor.capture());
    PipelineRun saved = captor.getValue();

    assertThat(saved.getStatus()).isEqualTo(PipelineRunStatus.VALIDATED);
    assertThat(saved.getRecordsOutput()).isEqualTo(95);
    verify(acknowledgment).acknowledge();
  }

  @Test
  void shouldRejectInvalidStatus() {
    Map<String, Object> payload = new HashMap<>();
    payload.put("connectionId", connectionId.toString());
    payload.put("status", "MALICIOUS'; DROP TABLE pipeline_runs;--");
    payload.put("recordsOutput", 0);

    consumer.onIngestValid(payload, null, 0, 0L, acknowledgment);

    verify(pipelineRunRepository, never()).save(any());
    verify(acknowledgment).acknowledge();
  }

  @Test
  void shouldHandleSourceIdAndRecordCountFallback() {
    when(pipelineRunRepository.findByConnectionId(connectionId)).thenReturn(List.of(existingRun));

    Map<String, Object> payload = new HashMap<>();
    payload.put("source_id", connectionId.toString());
    payload.put("status", "valid");
    payload.put("record_count", 80);

    consumer.onIngestValid(payload, null, 0, 0L, acknowledgment);

    ArgumentCaptor<PipelineRun> captor = ArgumentCaptor.forClass(PipelineRun.class);
    verify(pipelineRunRepository).save(captor.capture());
    PipelineRun saved = captor.getValue();

    assertThat(saved.getStatus()).isEqualTo(PipelineRunStatus.VALIDATED);
    assertThat(saved.getRecordsOutput()).isEqualTo(80);
    verify(acknowledgment).acknowledge();
  }

  @Test
  void shouldRejectMissingConnectionId() {
    Map<String, Object> payload = new HashMap<>();
    payload.put("status", "VALIDATED");

    consumer.onIngestValid(payload, null, 0, 0L, acknowledgment);

    verify(pipelineRunRepository, never()).save(any());
    verify(acknowledgment).acknowledge();
  }
}
