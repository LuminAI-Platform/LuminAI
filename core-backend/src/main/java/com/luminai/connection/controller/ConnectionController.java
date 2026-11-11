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
      ObjectMapper objectMapper) {
    this.connectionService = connectionService;
    this.connectionPreviewService = connectionPreviewService;
    this.fileConnectorService = fileConnectorService;
    this.connectionProducer = connectionProducer;
    this.postgresConnectorService = postgresConnectorService;
    this.goldenRecordRepository = goldenRecordRepository;
    this.connectionRepository = connectionRepository;
    this.objectMapper = objectMapper;

    this.cleanPreviewService =
        new ConnectionCleanPreviewService(
            connectionPreviewService, connectionRepository, goldenRecordRepository, objectMapper);
    this.uploadService =
        new ConnectionUploadService(
            fileConnectorService, connectionProducer, connectionRepository, objectMapper);
  }

  @Autowired
  public void configureNeo4j(
      @Autowired(required = false) Neo4jGraphRepository neo4jGraphRepository) {
    this.neo4jGraphRepository = neo4jGraphRepository;
    if (this.cleanPreviewService != null) {
      this.cleanPreviewService.setNeo4jGraphRepository(neo4jGraphRepository);
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

  @GetMapping("/{id}/clean-preview")
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

        Map<String, List<String>> discovered =
            postgresConnectorService.discoverSchemasDirect(
                host, port, database, username, password);
        List<Map<String, Object>> schemas = new ArrayList<>();
        discovered.forEach(
            (schema, tables) -> schemas.add(Map.of("schema", schema, "tables", tables)));
        return ResponseEntity.ok(schemas);
      } catch (Exception e) {
        log.warn("Direct database schema discovery failed: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(Map.of("message", "Database connection rejected: " + e.getMessage()));
      }
    }

    // Prototype schema discovery fallback when offline or demo config supplied
    List<Map<String, Object>> schemas =
        List.of(
            Map.of(
                "schema",
                "public",
                "tables",
                List.of("users", "orders", "customers", "transactions", "audit_logs")),
            Map.of(
                "schema",
                "analytics",
                "tables",
                List.of("daily_aggregates", "event_stream", "entity_matches")));
    return ResponseEntity.ok(schemas);
  }
}
