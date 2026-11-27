package com.luminai.connection.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.luminai.connection.dto.ConnectionDto;
import com.luminai.connection.model.Connection;
import com.luminai.connection.model.PipelineRun;
import com.luminai.connection.model.PipelineRun.PipelineRunStatus;
import com.luminai.connection.producer.ConnectionProducer;
import com.luminai.connection.repository.ConnectionPreviewService;
import com.luminai.connection.repository.ConnectionRepository;
import com.luminai.connection.repository.PipelineRunRepository;
import com.luminai.engine.service.DataEngineClient;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Consumer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ConnectionSyncServiceTest {

  @Mock private ConnectionService connectionService;
  @Mock private ConnectionRepository connectionRepository;
  @Mock private ConnectionPreviewService connectionPreviewService;
  @Mock private PostgresConnectorService postgresConnectorService;
  @Mock private ConnectionProducer connectionProducer;
  @Mock private PipelineRunRepository pipelineRunRepository;
  @Mock private PipelineSseService pipelineSseService;
  @Mock private DataEngineClient dataEngineClient;

  private ConnectionSyncService syncService;
  private UUID tenantId;
  private UUID connId;

  @BeforeEach
  void setUp() {
    tenantId = UUID.randomUUID();
    connId = UUID.randomUUID();
    syncService =
        new ConnectionSyncService(
            connectionService,
            connectionRepository,
            connectionPreviewService,
            postgresConnectorService,
            connectionProducer,
            pipelineRunRepository,
            pipelineSseService,
            dataEngineClient,
            new ObjectMapper(),
            false);
  }

  @Test
  @DisplayName("executeSync extracts Postgres rows, publishes batches, emits SSE, and completes")
  @SuppressWarnings("unchecked")
  void executeSyncPostgresSuccess() {
    ConnectionDto.Response conn =
        new ConnectionDto.Response(
            connId,
            tenantId,
            "Prod PG",
            Connection.Type.POSTGRESQL,
            "{\"tables\":[\"public.customers\"]}",
            "vault-key",
            Connection.Status.ACTIVE,
            null,
            null,
            Instant.now(),
            Instant.now());

    doAnswer(
            inv -> {
              Consumer<List<Map<String, Object>>> consumer = inv.getArgument(4);
              consumer.accept(
                  List.of(Map.of("id", 1, "name", "Alice"), Map.of("id", 2, "name", "Bob")));
              return null;
            })
        .when(postgresConnectorService)
        .extractRows(eq(tenantId), eq(connId), eq("public"), eq("customers"), any());

    when(dataEngineClient.cleanDatasetDirect(any()))
        .thenReturn(Map.of("status", "COMPLETED", "totalCleanRecords", 2, "rejectedRecords", 0));
    when(connectionRepository.findByIdAndTenantId(connId, tenantId)).thenReturn(Optional.empty());

    PipelineRun run = new PipelineRun();
    run.setId(UUID.randomUUID());
    run.setTenantId(tenantId);
    run.setConnectionId(connId);
    run.setStatus(PipelineRunStatus.RUNNING);
    run.setStartedAt(Instant.now());

    syncService.executeSync(run, conn, tenantId, "acme", Map.of());

    assertThat(run.getStatus()).isEqualTo(PipelineRunStatus.COMPLETED);
    assertThat(run.getRecordsInput()).isEqualTo(2L);
    assertThat(run.getRecordsOutput()).isEqualTo(2L);
    assertThat(run.getCompletedAt()).isNotNull();

    verify(connectionProducer)
        .publishRows(eq(tenantId), eq(connId), eq("public.customers"), any(), eq(true), eq(null));
    verify(pipelineSseService, atLeastOnce())
        .emitProgress(eq(tenantId), eq(run.getId().toString()), anyString(), anyInt(), anyString());
    verify(pipelineSseService)
        .emitComplete(
            eq(tenantId), eq(run.getId().toString()), eq(2L), eq(2L), eq(0L), anyString());
  }

  @Test
  @DisplayName("executeSync marks run FAILED and emits SSE error when no source records exist")
  void executeSyncFailureMarksFailedAndEmitsError() {
    ConnectionDto.Response conn =
        new ConnectionDto.Response(
            connId,
            tenantId,
            "Empty File",
            Connection.Type.FILE,
            "{}",
            null,
            Connection.Status.ACTIVE,
            null,
            null,
            Instant.now(),
            Instant.now());

    when(connectionPreviewService.previewFile(connId)).thenReturn(List.of());

    PipelineRun run = new PipelineRun();
    run.setId(UUID.randomUUID());
    run.setTenantId(tenantId);
    run.setConnectionId(connId);
    run.setStatus(PipelineRunStatus.RUNNING);
    run.setStartedAt(Instant.now());

    syncService.executeSync(run, conn, tenantId, "acme", Map.of());

    assertThat(run.getStatus()).isEqualTo(PipelineRunStatus.FAILED);
    assertThat(run.getErrorMessage()).contains("No source records found");
    assertThat(run.getCompletedAt()).isNotNull();

    verify(pipelineRunRepository, atLeastOnce()).save(run);
    verify(pipelineSseService)
        .emitError(
            eq(tenantId), eq(run.getId().toString()), eq("ingest"), anyString(), eq("error"));
  }

  @Test
  @DisplayName(
      "executeSync persists Data Engine goldenRecords with configured targetEntityType when Kafka listener disabled")
  void executeSyncPersistsGoldenRecordsDirectlyWithConfiguredEntityType() {
    GoldenRecordPersistenceService persistenceService =
        org.mockito.Mockito.mock(GoldenRecordPersistenceService.class);
    syncService.setGoldenRecordPersistenceService(persistenceService);

    ConnectionDto.Response conn =
        new ConnectionDto.Response(
            connId,
            tenantId,
            "Orders DB",
            Connection.Type.POSTGRESQL,
            "{\"tables\":[\"public.orders\"],\"targetEntityType\":\"Order\"}",
            "vault-key",
            Connection.Status.ACTIVE,
            null,
            null,
            Instant.now(),
            Instant.now());

    doAnswer(
            inv -> {
              Consumer<List<Map<String, Object>>> consumer = inv.getArgument(4);
              consumer.accept(List.of(Map.of("order_id", "ORD-101", "amount", 250)));
              return null;
            })
        .when(postgresConnectorService)
        .extractRows(eq(tenantId), eq(connId), eq("public"), eq("orders"), any());

    List<Map<String, Object>> returnedGolden =
        List.of(
            Map.of(
                "golden_id",
                "gr-1",
                "canonical_name",
                "ORD-101",
                "entity_type",
                "Order",
                "attributes",
                Map.of("order_id", "ORD-101", "amount", 250)));

    when(dataEngineClient.cleanDatasetDirect(any()))
        .thenReturn(
            Map.of(
                "status",
                "COMPLETED",
                "totalCleanRecords",
                1,
                "rejectedRecords",
                0,
                "goldenRecords",
                returnedGolden));
    when(connectionRepository.findByIdAndTenantId(connId, tenantId)).thenReturn(Optional.empty());

    PipelineRun run = new PipelineRun();
    run.setId(UUID.randomUUID());
    run.setTenantId(tenantId);
    run.setConnectionId(connId);
    run.setStatus(PipelineRunStatus.RUNNING);
    run.setStartedAt(Instant.now());

    syncService.executeSync(run, conn, tenantId, "luminex", Map.of());

    assertThat(run.getStatus()).isEqualTo(PipelineRunStatus.COMPLETED);
    verify(persistenceService)
        .syncGoldenRecords(
            eq(connId), eq(tenantId), eq("Orders DB"), eq("Order"), eq(returnedGolden), eq(true));
  }

  @Test
  @DisplayName(
      "executeSync falls back to direct persistence when Kafka producer throws LinkageError")
  void executeSyncFallsBackWhenKafkaThrowsLinkageError() {
    ConnectionSyncService kafkaEnabledSync =
        new ConnectionSyncService(
            connectionService,
            connectionRepository,
            connectionPreviewService,
            postgresConnectorService,
            connectionProducer,
            pipelineRunRepository,
            pipelineSseService,
            dataEngineClient,
            new ObjectMapper(),
            true);
    GoldenRecordPersistenceService persistenceService =
        org.mockito.Mockito.mock(GoldenRecordPersistenceService.class);
    kafkaEnabledSync.setGoldenRecordPersistenceService(persistenceService);

    ConnectionDto.Response conn =
        new ConnectionDto.Response(
            connId,
            tenantId,
            "Shipments File",
            Connection.Type.FILE,
            "{\"fileName\":\"shipments.csv\"}",
            null,
            Connection.Status.ACTIVE,
            null,
            null,
            Instant.now(),
            Instant.now());

    List<Map<String, Object>> fileRows = List.of(Map.of("shipment_id", "SHP-1", "origin", "Accra"));
    when(connectionPreviewService.previewFile(connId)).thenReturn(fileRows);
    org.mockito.Mockito.doThrow(new UnsatisfiedLinkError("libsnappyjava.so missing"))
        .when(connectionProducer)
        .publishRows(eq(tenantId), eq(connId), eq("shipments.csv"), any(), eq(true), any());
    when(dataEngineClient.cleanDatasetDirect(any()))
        .thenReturn(
            Map.of(
                "status",
                "COMPLETED",
                "totalCleanRecords",
                1,
                "rejectedRecords",
                0,
                "goldenRecords",
                List.of(
                    Map.of(
                        "golden_id",
                        "gr-shp-1",
                        "canonical_name",
                        "SHP-1",
                        "entity_type",
                        "Shipment",
                        "attributes",
                        fileRows.get(0)))));
    when(connectionRepository.findByIdAndTenantId(connId, tenantId)).thenReturn(Optional.empty());

    PipelineRun run = new PipelineRun();
    run.setId(UUID.randomUUID());
    run.setTenantId(tenantId);
    run.setConnectionId(connId);
    run.setStatus(PipelineRunStatus.RUNNING);
    run.setStartedAt(Instant.now());

    kafkaEnabledSync.executeSync(run, conn, tenantId, "luminex", Map.of());

    assertThat(run.getStatus()).isEqualTo(PipelineRunStatus.COMPLETED);
    verify(persistenceService)
        .syncGoldenRecords(eq(connId), eq(tenantId), eq("shipments.csv"), any(), any(), eq(true));
  }
}
