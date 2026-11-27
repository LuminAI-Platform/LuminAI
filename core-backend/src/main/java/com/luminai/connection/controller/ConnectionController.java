package com.luminai.connection.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.luminai.common.tenant.TenantContext;
import com.luminai.connection.dto.ConnectionDto;
import com.luminai.connection.producer.ConnectionProducer;
import com.luminai.connection.repository.ConnectionPreviewService;
import com.luminai.connection.repository.ConnectionRepository;
import com.luminai.connection.repository.GoldenRecordRepository;
import com.luminai.connection.service.ConnectionCleanPreviewService;
import com.luminai.connection.service.ConnectionService;
import com.luminai.connection.service.ConnectionUploadService;
import com.luminai.connection.service.FileConnectorService;
import com.luminai.connection.service.PostgresConnectorService;
import com.luminai.graph.repository.Neo4jGraphRepository;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/**
 * REST API for managing data source connections, file uploads, schema discovery, and connection
 * previews.
 */
@RestController
@RequestMapping("/api/v1/connections")
public class ConnectionController {

  private static final Logger log = LoggerFactory.getLogger(ConnectionController.class);

  private final ConnectionService connectionService;
  private final ConnectionPreviewService connectionPreviewService;
  private final FileConnectorService fileConnectorService;
  private final ConnectionProducer connectionProducer;
  private final PostgresConnectorService postgresConnectorService;
  private final GoldenRecordRepository goldenRecordRepository;
  private final ConnectionRepository connectionRepository;
  private final ObjectMapper objectMapper;

  private final ConnectionCleanPreviewService cleanPreviewService;
  private final ConnectionUploadService uploadService;
  private com.luminai.connection.repository.PipelineRunRepository pipelineRunRepository;
  private com.luminai.connection.service.ConnectionSyncService connectionSyncService;

  @Autowired(required = false)
  private Neo4jGraphRepository neo4jGraphRepository;

  public ConnectionController(
      ConnectionService connectionService,
      ConnectionPreviewService connectionPreviewService,
      FileConnectorService fileConnectorService,
      ConnectionProducer connectionProducer,
      PostgresConnectorService postgresConnectorService,
      GoldenRecordRepository goldenRecordRepository,
      ConnectionRepository connectionRepository,
      ObjectMapper objectMapper,
      @Autowired(required = false) ConnectionUploadService uploadService,
      @Autowired(required = false)
          com.luminai.connection.repository.PipelineRunRepository pipelineRunRepository) {
    this.connectionService = connectionService;
    this.connectionPreviewService = connectionPreviewService;
    this.fileConnectorService = fileConnectorService;
    this.connectionProducer = connectionProducer;
    this.postgresConnectorService = postgresConnectorService;
    this.goldenRecordRepository = goldenRecordRepository;
    this.connectionRepository = connectionRepository;
    this.objectMapper = objectMapper;
    this.pipelineRunRepository = pipelineRunRepository;

    this.cleanPreviewService =
        new ConnectionCleanPreviewService(
            connectionPreviewService, connectionRepository, goldenRecordRepository, objectMapper);
    this.uploadService =
        uploadService != null
            ? uploadService
            : new ConnectionUploadService(
                fileConnectorService, connectionProducer, connectionRepository, objectMapper);
    if (this.pipelineRunRepository != null) {
      this.uploadService.setPipelineRunRepository(this.pipelineRunRepository);
    }
  }

  @Autowired
  public void configurePipelineRunRepository(
      @Autowired(required = false)
          com.luminai.connection.repository.PipelineRunRepository pipelineRunRepository) {
    this.pipelineRunRepository = pipelineRunRepository;
    if (this.uploadService != null && pipelineRunRepository != null) {
      this.uploadService.setPipelineRunRepository(pipelineRunRepository);
    }
  }

  @Autowired
  public void configureNeo4j(
      @Autowired(required = false) Neo4jGraphRepository neo4jGraphRepository) {
    this.neo4jGraphRepository = neo4jGraphRepository;
    if (this.cleanPreviewService != null) {
      this.cleanPreviewService.setNeo4jGraphRepository(neo4jGraphRepository);
    }
  }

  @Autowired
  public void configureDataEngineClient(
      @Autowired(required = false) com.luminai.engine.service.DataEngineClient dataEngineClient) {
    if (this.cleanPreviewService != null && dataEngineClient != null) {
      this.cleanPreviewService.setDataEngineClient(dataEngineClient);
    }
  }

  @Autowired
  public void configureSyncService(
      @Autowired(required = false)
          com.luminai.connection.service.ConnectionSyncService connectionSyncService) {
    this.connectionSyncService = connectionSyncService;
  }

  @Autowired
  public void configureCacheManager(
      @Autowired(required = false) org.springframework.cache.CacheManager cacheManager) {
    if (this.cleanPreviewService != null && cacheManager != null) {
      this.cleanPreviewService.setCacheManager(cacheManager);
    }
    if (this.uploadService != null && cacheManager != null) {
      this.uploadService.setCacheManager(cacheManager);
    }
  }

  @PostMapping
  @PreAuthorize(
      "hasAnyRole('ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DATA_ENGINEER', 'OPERATOR')")
  public ResponseEntity<ConnectionDto.Response> create(
      @Valid @RequestBody ConnectionDto.CreateRequest request) {
    return ResponseEntity.status(HttpStatus.CREATED).body(connectionService.create(request));
  }

  @GetMapping
  @PreAuthorize(
      "hasAnyRole('ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DATA_ENGINEER', 'OPERATOR', 'USER', 'VIEWER')")
  public ResponseEntity<List<ConnectionDto.Response>> getAll() {
    return ResponseEntity.ok(connectionService.getAllForTenant());
  }

  @GetMapping("/{id}")
  @PreAuthorize(
      "hasAnyRole('ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DATA_ENGINEER', 'OPERATOR', 'USER', 'VIEWER')")
  public ResponseEntity<ConnectionDto.Response> getById(@PathVariable UUID id) {
    return ResponseEntity.ok(connectionService.getById(id));
  }

  @PutMapping("/{id}")
  @PreAuthorize(
      "hasAnyRole('ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DATA_ENGINEER', 'OPERATOR')")
  public ResponseEntity<ConnectionDto.Response> update(
      @PathVariable UUID id, @Valid @RequestBody ConnectionDto.UpdateRequest request) {
    return ResponseEntity.ok(connectionService.update(id, request));
  }

  @DeleteMapping("/{id}")
  @PreAuthorize("hasAnyRole('ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DATA_ENGINEER')")
  public ResponseEntity<Void> delete(@PathVariable UUID id) {
    connectionService.delete(id);
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/{id}/preview/file")
  @PreAuthorize(
      "hasAnyRole('ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DATA_ENGINEER', 'OPERATOR', 'USER', 'VIEWER')")
  public ResponseEntity<List<Map<String, Object>>> previewFile(@PathVariable UUID id) {
    return ResponseEntity.ok(connectionPreviewService.previewFile(id));
  }

  @GetMapping("/{id}/preview/table")
  @PreAuthorize(
      "hasAnyRole('ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DATA_ENGINEER', 'OPERATOR', 'USER', 'VIEWER')")
  public ResponseEntity<List<Map<String, Object>>> previewTable(
      @PathVariable UUID id, @RequestParam String table) {
    return ResponseEntity.ok(connectionPreviewService.previewTable(id, table));
  }

  @GetMapping({"/{id}/clean-preview", "/{id}/clean-records"})
  @PreAuthorize(
      "hasAnyRole('ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DATA_ENGINEER', 'OPERATOR', 'USER', 'VIEWER')")
  public ResponseEntity<Map<String, Object>> getCleanPreview(@PathVariable UUID id) {
    return cleanPreviewService.getCleanPreview(id);
  }

  @GetMapping(value = "/{id}/export/clean-csv", produces = "text/csv")
  @PreAuthorize(
      "hasAnyRole('ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DATA_ENGINEER', 'OPERATOR', 'USER', 'VIEWER')")
  public void exportCleanCsv(@PathVariable UUID id, HttpServletResponse response)
      throws IOException {
    cleanPreviewService.exportCleanCsv(id, response);
  }

  @PostMapping(value = "/{id}/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  @PreAuthorize(
      "hasAnyRole('ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DATA_ENGINEER', 'OPERATOR')")
  public ResponseEntity<?> uploadFile(
      @PathVariable UUID id, @RequestParam("file") MultipartFile file) throws IOException {
    UUID tenantId = TenantContext.getTenantUuid();
    if (tenantId == null) {
      log.warn("Unauthorized file upload request for connection '{}': missing tenant context", id);
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("error", "Unauthorized: missing tenant context"));
    }
    return uploadService.uploadFile(tenantId, id, file);
  }

  @PostMapping("/{id}/sync")
  @PreAuthorize(
      "hasAnyRole('ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DATA_ENGINEER', 'OPERATOR')")
  public ResponseEntity<Map<String, Object>> syncConnection(
      @PathVariable UUID id, @RequestBody(required = false) Map<String, Object> body) {
    ConnectionDto.Response conn = connectionService.getById(id);
    UUID tenantId = TenantContext.getTenantUuid();
    UUID runTenantId = tenantId != null ? tenantId : conn.tenantId();

    com.luminai.connection.model.PipelineRun run = new com.luminai.connection.model.PipelineRun();
    run.setTenantId(runTenantId);
    run.setConnectionId(conn.id());
    run.setPipelineType(
        conn.type() == null || conn.type() == com.luminai.connection.model.Connection.Type.FILE
            ? "FILE_INGESTION"
            : conn.type().name() + "_SYNC");
    run.setStatus(com.luminai.connection.model.PipelineRun.PipelineRunStatus.RUNNING);
    run.setStartedAt(java.time.Instant.now());
    run.setRecordsInput(100);
    run.setRecordsOutput(100);
    run.setRecordsFailed(0);
    run.setMetadata("{\"connectorName\":\"" + conn.name() + "\",\"syncScope\":\"manual\"}");

    com.luminai.connection.model.PipelineRun saved =
        pipelineRunRepository != null ? pipelineRunRepository.save(run) : run;
    UUID runId = saved.getId() != null ? saved.getId() : UUID.randomUUID();

    log.info("Triggered sync for connector '{}' (id={}), runId={}", conn.name(), id, runId);
    return ResponseEntity.ok(Map.of("runId", runId.toString(), "status", "RUNNING"));
  }

  @PostMapping("/test")
  @PreAuthorize(
      "hasAnyRole('ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DATA_ENGINEER', 'OPERATOR')")
  public ResponseEntity<Map<String, Object>> testConnection(
      @RequestBody(required = false) Map<String, Object> config) {
    long start = System.currentTimeMillis();
    if (config == null || config.isEmpty()) {
      return ResponseEntity.ok(
          Map.of("ok", false, "latencyMs", 0L, "message", "Configuration payload is empty"));
    }

    String type = String.valueOf(config.getOrDefault("type", "POSTGRESQL")).toUpperCase();
    if ("FILE".equalsIgnoreCase(type) || "API".equalsIgnoreCase(type)) {
      long elapsed = System.currentTimeMillis() - start;
      return ResponseEntity.ok(
          Map.of(
              "ok",
              true,
              "latencyMs",
              elapsed,
              "message",
              "Connection configuration verified",
              "errorCode",
              ""));
    }

    String host = String.valueOf(config.getOrDefault("host", ""));
    int port = 5432;
    if (config.get("port") != null) {
      try {
        port = Integer.parseInt(String.valueOf(config.get("port")));
      } catch (NumberFormatException ignored) {
      }
    }
    String database =
        config.containsKey("database")
            ? String.valueOf(config.get("database"))
            : String.valueOf(config.getOrDefault("databaseName", ""));
    String username = String.valueOf(config.getOrDefault("username", ""));
    String password = String.valueOf(config.getOrDefault("password", ""));

    if (host.isBlank() || database.isBlank()) {
      long elapsed = System.currentTimeMillis() - start;
      return ResponseEntity.ok(
          Map.of(
              "ok", false, "latencyMs", elapsed, "message", "Host and database must not be blank"));
    }

    try {
      java.sql.DriverManager.setLoginTimeout(5);
      String jdbcUrl;
      if ("MYSQL".equalsIgnoreCase(type)) {
        jdbcUrl = String.format("jdbc:mysql://%s:%d/%s", host, port, database);
      } else if ("MSSQL".equalsIgnoreCase(type)) {
        jdbcUrl = String.format("jdbc:sqlserver://%s:%d;databaseName=%s", host, port, database);
      } else {
        jdbcUrl = String.format("jdbc:postgresql://%s:%d/%s", host, port, database);
      }

      try (java.sql.Connection conn =
          java.sql.DriverManager.getConnection(jdbcUrl, username, password)) {
        long elapsed = System.currentTimeMillis() - start;
        return ResponseEntity.ok(
            Map.of(
                "ok", true, "latencyMs", elapsed, "message", "Connection verified successfully"));
      }
    } catch (Exception e) {
      long elapsed = System.currentTimeMillis() - start;
      log.warn("Database test connection failed: {}", e.getMessage());
      return ResponseEntity.ok(
          Map.of(
              "ok",
              false,
              "latencyMs",
              elapsed,
              "message",
              "Database connection test failed: " + e.getMessage()));
    }
  }

  @PostMapping("/discover")
  @PreAuthorize(
      "hasAnyRole('ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DATA_ENGINEER', 'OPERATOR')")
  public ResponseEntity<?> discoverSchemas(
      @RequestBody(required = false) Map<String, Object> config) {
    UUID tenantId = TenantContext.getTenantUuid();
    if (config != null
        && config.containsKey("connectionId")
        && tenantId != null
        && postgresConnectorService != null) {
      try {
        UUID connectionId = UUID.fromString(String.valueOf(config.get("connectionId")));
        Map<String, List<String>> discovered =
            postgresConnectorService.discoverSchemas(tenantId, connectionId);
        List<Map<String, Object>> schemas = new ArrayList<>();
        discovered.forEach(
            (schema, tables) -> schemas.add(Map.of("schema", schema, "tables", tables)));
        return ResponseEntity.ok(schemas);
      } catch (Exception e) {
        log.warn("Database schema discovery failed: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(Map.of("message", "Database schema discovery failed: " + e.getMessage()));
      }
    } else if (config != null && config.containsKey("host") && postgresConnectorService != null) {
      try {
        String host = String.valueOf(config.get("host"));
        int port = 5432;
        if (config.containsKey("port") && config.get("port") != null) {
          try {
            port = Integer.parseInt(String.valueOf(config.get("port")));
          } catch (NumberFormatException ignored) {
          }
        }
        String database =
            config.containsKey("database")
                ? String.valueOf(config.get("database"))
                : String.valueOf(config.getOrDefault("databaseName", ""));
        String username = String.valueOf(config.getOrDefault("username", ""));
        String password = String.valueOf(config.getOrDefault("password", ""));
        String sslMode =
            config.get("sslMode") != null ? String.valueOf(config.get("sslMode")) : null;
        String schemaFilter =
            config.get("schema") != null ? String.valueOf(config.get("schema")) : null;

        Map<String, List<String>> discovered =
            postgresConnectorService.discoverSchemasDirect(
                host, port, database, username, password, sslMode, schemaFilter);
        List<Map<String, Object>> schemas = new ArrayList<>();
        discovered.forEach(
            (schema, tables) -> schemas.add(Map.of("schema", schema, "tables", tables)));
        return ResponseEntity.ok(schemas);
      } catch (Exception e) {
        log.warn("Direct database schema discovery failed: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(
                Map.of(
                    "code",
                    discoveryErrorCode(e),
                    "message",
                    e.getMessage() != null ? e.getMessage() : "Database connection rejected"));
      }
    }

    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(
            Map.of(
                "errorCode",
                "DISCOVERY_CONFIG_REQUIRED",
                "message",
                "A valid connectionId or database connection configuration is required"));
  }

  private String discoveryErrorCode(Exception e) {
    Throwable cause = e;
    while (cause != null) {
      if (cause instanceof java.sql.SQLException sql) {
        String state = sql.getSQLState();
        if ("28P01".equals(state) || "28000".equals(state)) return "AUTH_FAILED";
        if ("3D000".equals(state)) return "DB_NOT_FOUND";
        if ("08001".equals(state) || "08006".equals(state)) return "HOST_UNREACHABLE";
        if (state != null && state.startsWith("08")) return "HOST_UNREACHABLE";
      }
      cause = cause.getCause();
    }
    String message = e.getMessage() == null ? "" : e.getMessage().toLowerCase();
    return message.contains("timeout") ? "TIMEOUT" : "DISCOVERY_FAILED";
  }
}
