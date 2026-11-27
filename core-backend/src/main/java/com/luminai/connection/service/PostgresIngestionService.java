package com.luminai.connection.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luminai.common.tenant.TenantContext;
import com.luminai.connection.model.Connection;
import com.luminai.connection.model.PipelineRun;
import com.luminai.connection.producer.ConnectionProducer;
import com.luminai.connection.repository.ConnectionRepository;
import com.luminai.connection.repository.PipelineRunRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/** Executes a PostgreSQL connection sync and publishes extracted rows to the raw ingest stream. */
@Service
public class PostgresIngestionService {

  private static final Logger log = LoggerFactory.getLogger(PostgresIngestionService.class);

  private final ConnectionRepository connectionRepository;
  private final PipelineRunRepository pipelineRunRepository;
  private final PostgresConnectorService postgresConnectorService;
  private final ConnectionProducer connectionProducer;
  private final ObjectMapper objectMapper;

  public PostgresIngestionService(
      ConnectionRepository connectionRepository,
      PipelineRunRepository pipelineRunRepository,
      PostgresConnectorService postgresConnectorService,
      ConnectionProducer connectionProducer,
      ObjectMapper objectMapper) {
    this.connectionRepository = connectionRepository;
    this.pipelineRunRepository = pipelineRunRepository;
    this.postgresConnectorService = postgresConnectorService;
    this.connectionProducer = connectionProducer;
    this.objectMapper = objectMapper;
  }

  /**
   * Extracts all configured PostgreSQL tables in bounded batches and publishes them to ingest.raw.
   * The method is intentionally synchronous so the persisted run is accurate when the API returns;
   * callers can move this invocation behind a job queue without changing the extraction contract.
   */
  public PipelineRun sync(UUID connectionId) {
    UUID tenantId = TenantContext.getTenantUuid();
    if (tenantId == null) {
      throw new IllegalStateException("No tenant resolved for PostgreSQL sync");
    }

    Connection connection =
        connectionRepository
            .findByIdAndTenantId(connectionId, tenantId)
            .orElseThrow(() -> new IllegalArgumentException("Connection not found"));
    if (connection.getType() != Connection.Type.POSTGRESQL) {
      throw new IllegalArgumentException(
          "Connection type " + connection.getType() + " is not supported by PostgreSQL sync");
    }

    List<String> tables = configuredTables(connection.getConfig());
    if (tables.isEmpty()) {
      throw new IllegalArgumentException(
          "No tables are configured for this connection; select at least one table first");
    }

    PipelineRun run = new PipelineRun();
    run.setTenantId(tenantId);
    run.setConnectionId(connectionId);
    run.setPipelineType("POSTGRESQL_SYNC");
    run.setStatus(PipelineRun.PipelineRunStatus.INGESTING);
    run.setStartedAt(Instant.now());
    run.setMetadata(objectMapper.createObjectNode().put("tableCount", tables.size()).toString());
    run = pipelineRunRepository.save(run);
    connection.setStatus(Connection.Status.SYNCING);
    connectionRepository.save(connection);
    final UUID pipelineRunId = run.getId();

    long extracted = 0;
    try {
      for (String table : tables) {
        String[] parts = splitTable(table);
        final String source = parts[0] + "." + parts[1];
        final long[] tableRows = {0};
        postgresConnectorService.extractRows(
            tenantId,
            connectionId,
            parts[0],
            parts[1],
            rows -> {
              tableRows[0] += rows.size();
              connectionProducer.publishRows(
                  tenantId,
                  connectionId,
                  source,
                  rows,
                  false,
                  null,
                  Map.of("pipelineRunId", pipelineRunId.toString(), "table", source));
            });
        extracted += tableRows[0];
      }

      run.setRecordsInput(extracted);
      run.setRecordsOutput(extracted);
      run.setStatus(PipelineRun.PipelineRunStatus.COMPLETED);
      run.setCompletedAt(Instant.now());
      connection.setLastSyncAt(run.getCompletedAt());
      connection.setStatus(Connection.Status.ACTIVE);
      connectionRepository.save(connection);
      return pipelineRunRepository.save(run);
    } catch (RuntimeException ex) {
      run.setRecordsInput(extracted);
      run.setRecordsOutput(0);
      run.setRecordsFailed(1);
      run.setStatus(PipelineRun.PipelineRunStatus.FAILED);
      run.setCompletedAt(Instant.now());
      run.setErrorMessage(ex.getMessage());
      connection.setStatus(Connection.Status.ERROR);
      connectionRepository.save(connection);
      pipelineRunRepository.save(run);
      log.error("PostgreSQL sync failed for connection {}", connectionId, ex);
      throw ex;
    }
  }

  private List<String> configuredTables(String config) {
    if (config == null || config.isBlank()) return List.of();
    try {
      JsonNode tables = objectMapper.readTree(config).path("tables");
      if (!tables.isArray()) return List.of();
      List<String> result = new ArrayList<>();
      tables.forEach(
          node -> {
            if (node.isTextual() && !node.asText().isBlank()) result.add(node.asText());
          });
      return result;
    } catch (Exception ex) {
      throw new IllegalArgumentException("Connection configuration contains invalid JSON", ex);
    }
  }

  private String[] splitTable(String configuredTable) {
    String[] parts = configuredTable.split("\\.", -1);
    String schema = parts.length == 2 ? parts[0] : "public";
    String table = parts.length == 2 ? parts[1] : parts[0];
    if (!schema.matches("[a-zA-Z0-9_]+") || !table.matches("[a-zA-Z0-9_]+")) {
      throw new IllegalArgumentException("Invalid PostgreSQL table identifier: " + configuredTable);
    }
    return new String[] {schema, table};
  }
}
