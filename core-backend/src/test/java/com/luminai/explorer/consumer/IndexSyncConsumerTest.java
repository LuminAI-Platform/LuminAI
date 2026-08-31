package com.luminai.explorer.consumer;

import static org.mockito.Mockito.*;

import com.luminai.explorer.service.OpenSearchIndexingService;
import com.luminai.graph.EntityResolvedEvent;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.support.Acknowledgment;

@ExtendWith(MockitoExtension.class)
class IndexSyncConsumerTest {

  @Mock private OpenSearchIndexingService indexingService;
  @Mock private Acknowledgment acknowledgment;

  @InjectMocks private IndexSyncConsumer consumer;

  @Test
  @DisplayName("onEntityResolved delegates to OpenSearchIndexingService and acknowledges message")
  void onEntityResolvedSuccess() {
    EntityResolvedEvent event =
        new EntityResolvedEvent(
            "tenant-123", "golden-456", "Person", Map.of("name", "Alice Smith"));

    consumer.onEntityResolved(event, acknowledgment);

    verify(indexingService).indexEntity(event);
    verify(acknowledgment).acknowledge();
  }
}
