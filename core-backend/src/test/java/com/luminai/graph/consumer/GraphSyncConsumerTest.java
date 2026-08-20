package com.luminai.graph.consumer;

import static org.mockito.Mockito.*;

import com.luminai.graph.EntityResolvedEvent;
import com.luminai.graph.service.Neo4jSyncService;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.support.Acknowledgment;

class GraphSyncConsumerTest {

  private Neo4jSyncService syncService;
  private GraphSyncConsumer consumer;

  @BeforeEach
  void setUp() {
    syncService = mock(Neo4jSyncService.class);
    consumer = new GraphSyncConsumer(syncService);
  }

  @Test
  void delegatesToSyncServiceAndAcknowledgesOnSuccess() {
    EntityResolvedEvent event =
        new EntityResolvedEvent("acme", "gr-100", "Person", Map.of("name", "Alice"));
    Acknowledgment acknowledgment = mock(Acknowledgment.class);

    consumer.onEntityResolved(event, acknowledgment);

    verify(syncService).sync(event);
    verify(acknowledgment).acknowledge();
  }

  @Test
  void doesNotAcknowledgeWhenSyncServiceThrows() {
    EntityResolvedEvent event = new EntityResolvedEvent("acme", "gr-100", "Person", Map.of());
    Acknowledgment acknowledgment = mock(Acknowledgment.class);
    doThrow(new IllegalArgumentException("bad event")).when(syncService).sync(event);

    org.junit.jupiter.api.Assertions.assertThrows(
        IllegalArgumentException.class, () -> consumer.onEntityResolved(event, acknowledgment));

    verify(acknowledgment, never()).acknowledge();
  }
}
