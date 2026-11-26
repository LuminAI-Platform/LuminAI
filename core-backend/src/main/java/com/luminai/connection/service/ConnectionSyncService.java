package com.luminai.connection.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luminai.common.tenant.TenantContext;
import com.luminai.connection.dto.ConnectionDto;
import com.luminai.connection.model.Connection;
import com.luminai.connection.model.PipelineRun;
import com.luminai.connection.model.PipelineRun.PipelineRunStatus;
import com.luminai.connection.producer.ConnectionProducer;
import com.luminai.connection.repository.ConnectionPreviewService;
import com.luminai.connection.repository.ConnectionRepository;
import com.luminai.connection.repository.PipelineRunRepository;
import com.luminai.engine.service.DataEngineClient;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Orchestrates real connector synchronization triggered by {@code POST
 * /api/v1/connections/{id}/sync}. Extracts rows from PostgreSQL/file sources, publishes batches to
 * Kafka ({@code ingest.raw}), falls back cleanly when Kafka listeners are disabled, updates {@link
 * PipelineRun} state (never leaving runs permanently stuck at {@code RUNNING}), and streams live
 * progress/completion/error frames via {@link PipelineSseService}.
 */
@Service
public class ConnectionSyncService {

  private static final Logger log = LoggerFactory.getLogger(ConnectionSyncService.class);
  private static final int BATCH_SIZE = 1000;

  private final ConnectionService connectionService;
  private final ConnectionRepository connectionRepository;
  private final ConnectionPreviewService connectionPreviewService;
  private final PostgresConnectorService postgresConnectorService;
  private final ConnectionProducer connectionProducer;
  private final PipelineRunRepository pipelineRunRepository;
  private final PipelineSseService pipelineSseService;
  private final DataEngineClient dataEngineClient;
  private final ObjectMapper objectMapper;
  private final boolean kafkaListenerEnabled;
  private org.springframework.cache.CacheManager cacheManager;

  @Autowired(required = false)
  public void setCacheManager(org.springframework.cache.CacheManager cacheManager) {
    this.cacheManager = cacheManager;
  }

  @Autowired
  public ConnectionSyncService(
      ConnectionService connectionService,
      ConnectionRepository connectionRepository,
      @Autowired(required = false) ConnectionPreviewService connectionPreviewService,
      @Autowired(required = false) PostgresConnectorService postgresConnectorService,
      @Autowired(required = false) ConnectionProducer connectionProducer,
      @Autowired(required = false) PipelineRunRepository pipelineRunRepository,
      @Autowired(required = false) PipelineSseService pipelineSseService,
      @Autowired(required = false) DataEngineClient dataEngineClient,
      ObjectMapper objectMapper,
      @Value("${spring.kafka.listener.auto-startup:false}") boolean kafkaListenerEnabled) {
    this.connectionService = connectionService;
    this.connectionRepository = connectionRepository;
    this.connectionPreviewService = connectionPreviewService;
    this.postgresConnectorService = postgresConnectorService;
    this.connectionProducer = connectionProducer;
    this.pipelineRunRepository = pipelineRunRepository;
    this.pipelineSseService = pipelineSseService;
    this.dataEngineClient = dataEngineClient;
    this.objectMapper = objectMapper;
    this.kafkaListenerEnabled = kafkaListenerEnabled;
  }

  /**
   * Creates an initial {@link PipelineRun} and launches asynchronous connector synchronization.
   *
   * @param connectionId target connection UUID
   * @param requestBody optional sync parameters
   * @return immediate response map containing {@code runId} and initial status
   */
  public Map<String, Object> triggerSync(UUID connectionId, Map<String, Object> requestBody) {
    ConnectionDto.Response conn = connectionService.getById(connectionId);
    UUID contextTenant = TenantContext.getTenantUuid();
    UUID runTenantId = contextTenant != null ? contextTenant : conn.tenantId();
    String tenantSlug = TenantContext.getTenantSlug();

    PipelineRun run = new PipelineRun();
    run.setTenantId(runTenantId);
    run.setConnectionId(conn.id());
    run.setPipelineType(conn.type() != null ? conn.type().name() + "_SYNC" : "CONNECTOR_SYNC");
    run.setStatus(PipelineRunStatus.RUNNING);
    run.setStartedAt(Instant.now());
    run.setRecordsInput(0);
    run.setRecordsOutput(0);
    run.setRecordsFailed(0);
    run.setMetadata(buildInitialMetadata(conn.name(), requestBody));

    PipelineRun saved = pipelineRunRepository != null ? pipelineRunRepository.save(run) : run;
    UUID runId = saved.getId() != null ? saved.getId() : UUID.randomUUID();
    if (saved.getId() == null) {
      saved.setId(runId);
    }

    log.info(
        "Queued real sync for connector '{}' (id={}, type={}), runId={}",
        conn.name(),
        conn.id(),
        conn.type(),
        runId);

    Thread.ofVirtual()
        .name("conn-sync-" + runId)
        .start(() -> executeSync(saved, conn, runTenantId, tenantSlug, requestBody));

    return Map.of("runId", runId.toString(), "status", "RUNNING");
  }

  /** Executes connector extraction, publishing, and completion/failure tracking. */
  void executeSync(
      PipelineRun run,
      ConnectionDto.Response conn,
      UUID tenantId,
      String tenantSlug,
      Map<String, Object> requestBody) {
    String runIdStr = run.getId() != null ? run.getId().toString() : "";
    Instant syncStart = run.getStartedAt() != null ? run.getStartedAt() : Instant.now();

    try {
      bindTenantContext(tenantId, tenantSlug);
      ConnectionCleanPreviewService.evictPreviewCache(cacheManager, tenantId, conn.id());
      emitProgress(
          tenantId, runIdStr, "ingest", 10, "Starting sync for connector '" + conn.name() + "'");

      long totalExtracted = 0L;
      List<Map<String, Object>> sampleRows = new ArrayList<>();

      if (isDatabaseConnector(conn.type())) {
        totalExtracted = extractAndPublishDatabase(conn, tenantId, runIdStr, sampleRows);
      } else {
        totalExtracted = extractAndPublishFileOrApi(conn, tenantId, runIdStr, sampleRows);
      }

      run.setRecordsInput(totalExtracted);
      emitProgress(
          tenantId,
          runIdStr,
          "clean",
          50,
          "Extracted and queued " + totalExtracted + " records for processing");

      // When Kafka listeners are disabled, run synchronous Data Engine cleaning or mark completion
      // directly so PipelineRun does not stay stuck in RUNNING indefinitely.
      if (!kafkaListenerEnabled) {
        completeWithoutKafkaConsumer(
            run, conn, tenantId, tenantSlug, runIdStr, syncStart, totalExtracted, sampleRows);
      } else {
        run.setStatus(PipelineRunStatus.INGESTING);
        saveRunQuietly(run);
        emitProgress(
            tenantId,
            runIdStr,
            "clean",
            60,
            "Batches published to Kafka pipeline; awaiting Data Engine completion");
      }
    } catch (Exception e) {
      log.error(
          "Sync failed for connector '{}' (id={}, runId={}): {}",
          conn.name(),
          conn.id(),
          runIdStr,
          e.getMessage(),
          e);
      run.setStatus(PipelineRunStatus.FAILED);
      run.setErrorMessage(e.getMessage() != null ? e.getMessage() : "Sync execution failed");
      run.setCompletedAt(Instant.now());
      saveRunQuietly(run);
      emitError(tenantId, runIdStr, "ingest", run.getErrorMessage(), "error");
    } finally {
      TenantContext.clear();
    }
  }

  private long extractAndPublishDatabase(
      ConnectionDto.Response conn,
      UUID tenantId,
      String runIdStr,
      List<Map<String, Object>> sampleRowsOut) {
    if (postgresConnectorService == null) {
      throw new IllegalStateException("PostgreSQL connector service is unavailable");
    }

    List<String> targetTables = extractConfiguredTables(conn.config());
    if (targetTables.isEmpty()) {
      Map<String, List<String>> discovered =
          postgresConnectorService.discoverSchemas(tenantId, conn.id());
      for (Map.Entry<String, List<String>> entry : discovered.entrySet()) {
        for (String tbl : entry.getValue()) {
          targetTables.add(entry.getKey() + "." + tbl);
        }
      }
    }

    if (targetTables.isEmpty()) {
      throw new IllegalStateException(
          "No tables configured or discovered for connection '" + conn.name() + "'");
    }

    long totalRows = 0L;
    int tableIdx = 0;
    for (String qualifiedTable : targetTables) {
      tableIdx++;
      String schema = "public";
      String table = qualifiedTable;
      if (qualifiedTable.contains(".")) {
        String[] parts = qualifiedTable.split("\\.", 2);
        schema = parts[0];
        table = parts[1];
      }
      final String sourceLabel = schema + "." + table;
      final boolean isFinalTable = tableIdx == targetTables.size();
      final AtomicLong tableCount = new AtomicLong(0L);
      final AtomicReference<List<Map<String, Object>>> pendingChunk = new AtomicReference<>();

      postgresConnectorService.extractRows(
          tenantId,
          conn.id(),
          schema,
          table,
          chunk -> {
            if (chunk == null || chunk.isEmpty()) return;
            tableCount.addAndGet(chunk.size());
            if (sampleRowsOut.size() < BATCH_SIZE) {
              int remaining = BATCH_SIZE - sampleRowsOut.size();
              sampleRowsOut.addAll(chunk.subList(0, Math.min(chunk.size(), remaining)));
            }
            List<Map<String, Object>> previous = pendingChunk.getAndSet(chunk);
            if (previous != null && connectionProducer != null) {
              connectionProducer.publishRows(
                  tenantId, conn.id(), sourceLabel, previous, false, null);
            }
          });

      List<Map<String, Object>> tail = pendingChunk.getAndSet(null);
      if (tail != null && connectionProducer != null) {
        connectionProducer.publishRows(tenantId, conn.id(), sourceLabel, tail, isFinalTable, null);
      } else if (isFinalTable && totalRows + tableCount.get() > 0 && connectionProducer != null) {
        connectionProducer.publishRows(
            tenantId, conn.id(), sourceLabel, List.of(), true, conn.name());
      }

      totalRows += tableCount.get();
      int pct = 10 + (int) Math.round((35.0 * tableIdx) / targetTables.size());
      emitProgress(
          tenantId,
          runIdStr,
          "ingest",
          pct,
          "Extracted " + tableCount.get() + " rows from " + sourceLabel);
    }

    return totalRows;
  }

  private long extractAndPublishFileOrApi(
      ConnectionDto.Response conn,
      UUID tenantId,
      String runIdStr,
      List<Map<String, Object>> sampleRowsOut) {
    List<Map<String, Object>> rows =
        connectionPreviewService != null
            ? connectionPreviewService.previewFile(conn.id())
            : List.of();

    if (rows == null || rows.isEmpty()) {
      throw new IllegalStateException(
          "No source records found for connection '" + conn.name() + "'");
    }

    sampleRowsOut.addAll(rows.subList(0, Math.min(rows.size(), BATCH_SIZE)));
    String sourceLabel = extractFileName(conn.config(), conn.name());
    String objectKey = extractObjectKey(conn.config());

    int total = rows.size();
    for (int i = 0; i < total; i += BATCH_SIZE) {
      int end = Math.min(i + BATCH_SIZE, total);
      List<Map<String, Object>> chunk = rows.subList(i, end);
      boolean isLast = end == total;
      if (connectionProducer != null) {
        connectionProducer.publishRows(tenantId, conn.id(), sourceLabel, chunk, isLast, objectKey);
      }
    }

    emitProgress(
        tenantId,
        runIdStr,
        "ingest",
        40,
        "Published " + total + " records from '" + sourceLabel + "'");
    return total;
  }

  private void completeWithoutKafkaConsumer(
      PipelineRun run,
      ConnectionDto.Response conn,
      UUID tenantId,
      String tenantSlug,
      String runIdStr,
      Instant syncStart,
      long totalExtracted,
      List<Map<String, Object>> sampleRows) {
    long cleanedCount = totalExtracted;
    long failedCount = 0L;

    if (dataEngineClient != null && !sampleRows.isEmpty()) {
      Map<String, Object> req = new LinkedHashMap<>();
      String effectiveTenant =
          tenantSlug != null && !tenantSlug.isBlank()
              ? tenantSlug
              : (tenantId != null ? tenantId.toString() : "acme");
      req.put("tenant_id", effectiveTenant);
      req.put("source_id", conn.id().toString());
      if (runIdStr != null && !runIdStr.isBlank()) {
        req.put("run_id", runIdStr);
      }
      req.put("entity_type", "Entity");
      req.put("rows", sampleRows);

      emitProgress(tenantId, runIdStr, "resolve", 75, "Running Data Engine cleaning & resolution");

      Map<String, Object> engineRes = dataEngineClient.cleanDatasetDirect(req);
      if (engineRes != null && "ERROR".equals(engineRes.get("status"))) {
        String err =
            engineRes.get("error") != null
                ? String.valueOf(engineRes.get("error"))
                : "Data Engine processing failed";
        throw new IllegalStateException(err);
      }
      if (engineRes != null) {
        if (engineRes.get("totalCleanRecords") instanceof Number n
            && totalExtracted <= sampleRows.size()) {
          cleanedCount = n.longValue();
        }
        if (engineRes.get("rejectedRecords") instanceof Number n) {
          failedCount = n.longValue();
        }
      }
    }

    Instant completedAt = Instant.now();
    run.setStatus(PipelineRunStatus.COMPLETED);
    run.setRecordsOutput(cleanedCount);
    run.setRecordsFailed(failedCount);
    run.setCompletedAt(completedAt);
    saveRunQuietly(run);

    ConnectionCleanPreviewService.evictPreviewCache(cacheManager, tenantId, conn.id());
    updateConnectionSyncTimestamp(conn.id(), tenantId, completedAt);

    long elapsedSec = Math.max(1L, Duration.between(syncStart, completedAt).getSeconds());
    emitProgress(tenantId, runIdStr, "resolve", 100, "Sync completed");
    emitComplete(tenantId, runIdStr, totalExtracted, cleanedCount, failedCount, elapsedSec + "s");
  }

  private void updateConnectionSyncTimestamp(UUID connectionId, UUID tenantId, Instant syncedAt) {
    if (connectionRepository == null || tenantId == null) return;
    try {
      connectionRepository
          .findByIdAndTenantId(connectionId, tenantId)
          .ifPresent(
              entity -> {
                entity.setStatus(Connection.Status.ACTIVE);
                entity.setLastSyncAt(syncedAt);
                connectionRepository.save(entity);
              });
    } catch (Exception e) {
      log.warn("Failed to update connection lastSyncAt for '{}': {}", connectionId, e.getMessage());
    }
  }

  private boolean isDatabaseConnector(Connection.Type type) {
    return type == Connection.Type.POSTGRESQL
        || type == Connection.Type.MYSQL
        || type == Connection.Type.MSSQL
        || type == Connection.Type.SNOWFLAKE;
  }

  private List<String> extractConfiguredTables(String config) {
    List<String> tables = new ArrayList<>();
    if (config == null || config.isBlank()) return tables;
    try {
      JsonNode root = objectMapper.readTree(config);
      if (root.has("tables") && root.get("tables").isArray()) {
        for (JsonNode t : root.get("tables")) {
          if (t.isTextual() && !t.asText().isBlank()) {
            tables.add(t.asText().trim());
          } else if (t.isObject() && t.has("name")) {
            tables.add(t.get("name").asText().trim());
          }
        }
      }
    } catch (Exception ignored) {
    }
    return tables;
  }

  private String extractFileName(String config, String fallback) {
    if (config != null && !config.isBlank()) {
      try {
        JsonNode root = objectMapper.readTree(config);
        if (root.has("fileName") && !root.get("fileName").asText().isBlank()) {
          return root.get("fileName").asText();
        }
      } catch (Exception ignored) {
      }
    }
    return fallback != null ? fallback : "connection-sync";
  }

  private String extractObjectKey(String config) {
    if (config != null && !config.isBlank()) {
      try {
        JsonNode root = objectMapper.readTree(config);
        if (root.has("fileKey") && !root.get("fileKey").asText().isBlank()) {
          return root.get("fileKey").asText();
        }
        if (root.has("objectKey") && !root.get("objectKey").asText().isBlank()) {
          return root.get("objectKey").asText();
        }
      } catch (Exception ignored) {
      }
    }
    return null;
  }

  private String buildInitialMetadata(String connectorName, Map<String, Object> body) {
    try {
      Map<String, Object> meta = new LinkedHashMap<>();
      meta.put("connectorName", connectorName != null ? connectorName : "Connector");
      meta.put(
          "syncScope", body != null && body.containsKey("scope") ? body.get("scope") : "manual");
      return objectMapper.writeValueAsString(meta);
    } catch (Exception e) {
      return "{\"syncScope\":\"manual\"}";
    }
  }

  private void bindTenantContext(UUID tenantId, String tenantSlug) {
    if (tenantId != null && tenantSlug != null && !tenantSlug.isBlank()) {
      TenantContext.setTenant(tenantId, tenantSlug);
    } else if (tenantId != null) {
      TenantContext.setTenantId(tenantId.toString());
    }
  }

  private void saveRunQuietly(PipelineRun run) {
    if (pipelineRunRepository == null) return;
    try {
      pipelineRunRepository.save(run);
    } catch (Exception e) {
      log.warn("Failed to persist PipelineRun '{}': {}", run.getId(), e.getMessage());
    }
  }

  private void emitProgress(UUID tenantId, String runId, String step, int pct, String msg) {
    if (pipelineSseService != null && runId != null && !runId.isBlank()) {
      pipelineSseService.emitProgress(tenantId, runId, step, pct, msg);
    }
  }

  private void emitError(UUID tenantId, String runId, String step, String error, String severity) {
    if (pipelineSseService != null && runId != null && !runId.isBlank()) {
      pipelineSseService.emitError(tenantId, runId, step, error, severity);
    }
  }

  private void emitComplete(
      UUID tenantId,
      String runId,
      long totalRecords,
      long cleanedRecords,
      long errorsCount,
      String duration) {
    if (pipelineSseService != null && runId != null && !runId.isBlank()) {
      pipelineSseService.emitComplete(
          tenantId, runId, totalRecords, cleanedRecords, errorsCount, duration);
    }
  }
}
