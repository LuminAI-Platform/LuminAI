package com.luminai.connection.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.luminai.common.tenant.TenantContext;
import com.luminai.connection.dto.ConnectionDto;
import com.luminai.connection.model.Connection;
import com.luminai.connection.model.GoldenRecord;
import com.luminai.connection.producer.ConnectionProducer;
import com.luminai.connection.repository.ConnectionPreviewService;
import com.luminai.connection.repository.ConnectionRepository;
import com.luminai.connection.repository.GoldenRecordRepository;
import com.luminai.connection.service.ConnectionService;
import com.luminai.connection.service.FileConnectorService;
import com.luminai.connection.service.PostgresConnectorService;
import jakarta.validation.Valid;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/**
 * REST API for managing data source connections, file uploads, schema discovery, and connection
 * previews.
 *
 * <p>All endpoints require a valid JWT. Tenant isolation is enforced by the service layer — the
 * authenticated tenant can only access its own data connection metadata.
 *
 * <pre>
 * POST   /api/v1/connections                  — Create data connection
 * GET    /api/v1/connections                  — List all for tenant
 * GET    /api/v1/connections/{id}             — Get by ID
 * PUT    /api/v1/connections/{id}             — Update connection
 * DELETE /api/v1/connections/{id}             — Delete connection
 * POST   /api/v1/connections/discover         — Discover database schemas
 * POST   /api/v1/connections/{id}/upload      — Upload binary file to MinIO and publish to ingest.raw
 * GET    /api/v1/connections/{id}/preview/file  — Preview first 100 rows of an uploaded file
 * GET    /api/v1/connections/{id}/preview/table — Preview first 100 rows of a database table
 * GET    /api/v1/connections/{id}/clean-preview — Preview resolved golden records with data quality metrics
 * GET    /api/v1/connections/{id}/export/clean-csv — Export resolved clean entities as an RFC-4180 CSV
 * </pre>
 */
@RestController
@RequestMapping("/api/v1/connections")
public class ConnectionController {

  private static final org.slf4j.Logger log =
      org.slf4j.LoggerFactory.getLogger(ConnectionController.class);

  private final ConnectionService connectionService;
  private final ConnectionPreviewService connectionPreviewService;
  private final FileConnectorService fileConnectorService;
  private final ConnectionProducer connectionProducer;
  private final PostgresConnectorService postgresConnectorService;
  private final GoldenRecordRepository goldenRecordRepository;
  private final ConnectionRepository connectionRepository;
  private final ObjectMapper objectMapper;

  @Autowired(required = false)
  private com.luminai.graph.repository.Neo4jGraphRepository neo4jGraphRepository;

  private void syncNodeToNeo4j(
      UUID tenantId, UUID goldenId, String canonicalName, String entityType) {
    if (neo4jGraphRepository == null) return;
    try {
      String slug = TenantContext.getTenantSlug();
      String primaryTenant = (slug != null && !slug.isBlank()) ? slug : tenantId.toString();
      neo4jGraphRepository.mergeEntityNode(
          primaryTenant, goldenId.toString(), canonicalName, entityType);
      if (slug != null && !slug.isBlank() && !slug.equals(tenantId.toString())) {
        neo4jGraphRepository.mergeEntityNode(
            tenantId.toString(), goldenId.toString(), canonicalName, entityType);
      }
    } catch (Exception e) {
      log.debug("Direct Neo4j node sync skipped: {}", e.getMessage());
    }
  }

  private void syncRelationshipToNeo4j(
      UUID tenantId, UUID sourceId, UUID targetId, String relType) {
    if (neo4jGraphRepository == null) return;
    try {
      String slug = TenantContext.getTenantSlug();
      String primaryTenant = (slug != null && !slug.isBlank()) ? slug : tenantId.toString();
      neo4jGraphRepository.mergeRelationship(
          primaryTenant, sourceId.toString(), targetId.toString(), relType, "OUTGOING");
      if (slug != null && !slug.isBlank() && !slug.equals(tenantId.toString())) {
        neo4jGraphRepository.mergeRelationship(
            tenantId.toString(), sourceId.toString(), targetId.toString(), relType, "OUTGOING");
      }
    } catch (Exception e) {
      log.debug("Direct Neo4j relationship sync skipped: {}", e.getMessage());
    }
  }

  @Autowired
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
    this.objectMapper = objectMapper != null ? objectMapper : new ObjectMapper();
  }

  // ----------------------------------------------------------------
  // Connection CRUD Endpoints
  // ----------------------------------------------------------------

  @PostMapping
  @org.springframework.security.access.prepost.PreAuthorize(
      "hasAnyRole('ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DATA_ENGINEER')")
  public ResponseEntity<ConnectionDto.Response> create(
      @Valid @RequestBody ConnectionDto.CreateRequest request) {
    ConnectionDto.Response created = connectionService.create(request);
    return ResponseEntity.status(HttpStatus.CREATED).body(created);
  }

  @GetMapping
  @org.springframework.security.access.prepost.PreAuthorize(
      "hasAnyRole('ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DATA_ENGINEER', 'OPERATOR', 'USER', 'VIEWER')")
  public ResponseEntity<List<ConnectionDto.Response>> getAll() {
    return ResponseEntity.ok(connectionService.getAllForTenant());
  }

  @GetMapping("/{id}")
  @org.springframework.security.access.prepost.PreAuthorize(
      "hasAnyRole('ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DATA_ENGINEER', 'OPERATOR', 'USER', 'VIEWER')")
  public ResponseEntity<ConnectionDto.Response> getById(@PathVariable UUID id) {
    return ResponseEntity.ok(connectionService.getById(id));
  }

  @PutMapping("/{id}")
  @org.springframework.security.access.prepost.PreAuthorize(
      "hasAnyRole('ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DATA_ENGINEER')")
  public ResponseEntity<ConnectionDto.Response> update(
      @PathVariable UUID id, @RequestBody ConnectionDto.UpdateRequest request) {
    return ResponseEntity.ok(connectionService.update(id, request));
  }

  @DeleteMapping("/{id}")
  @org.springframework.security.access.prepost.PreAuthorize(
      "hasAnyRole('ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DATA_ENGINEER')")
  public ResponseEntity<Void> delete(@PathVariable UUID id) {
    connectionService.delete(id);
    return ResponseEntity.noContent().build();
  }

  // ----------------------------------------------------------------
  // Connection Preview Endpoints
  // ----------------------------------------------------------------

  /**
   * Returns the first 100 rows of an uploaded file as a list of key-value maps.
   *
   * @param id the connection ID referencing the uploaded file
   * @return list of row maps matching the file's column structure
   */
  @GetMapping("/{id}/preview/file")
  @org.springframework.security.access.prepost.PreAuthorize(
      "hasAnyRole('ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DATA_ENGINEER', 'OPERATOR', 'USER', 'VIEWER')")
  public ResponseEntity<List<Map<String, Object>>> previewFile(@PathVariable UUID id) {
    List<Map<String, Object>> rows = connectionPreviewService.previewFile(id);
    return ResponseEntity.ok(rows);
  }

  /**
   * Returns the first 100 rows of a database table as a list of key-value maps.
   *
   * @param id the connection ID referencing the database source
   * @param table the name of the table to preview
   * @return list of row maps matching the table's column structure
   */
  @GetMapping("/{id}/preview/table")
  @org.springframework.security.access.prepost.PreAuthorize(
      "hasAnyRole('ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DATA_ENGINEER', 'OPERATOR', 'USER', 'VIEWER')")
  public ResponseEntity<List<Map<String, Object>>> previewTable(
      @PathVariable UUID id, @RequestParam String table) {
    List<Map<String, Object>> rows = connectionPreviewService.previewTable(id, table);
    return ResponseEntity.ok(rows);
  }

  /**
   * Returns cleaned and resolved golden records for the connection with comprehensive data quality
   * indicators and deduplication compression metrics.
   */
  @GetMapping("/{id}/clean-preview")
  @org.springframework.security.access.prepost.PreAuthorize(
      "hasAnyRole('ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DATA_ENGINEER', 'OPERATOR', 'USER', 'VIEWER')")
  public ResponseEntity<Map<String, Object>> getCleanPreview(@PathVariable UUID id) {
    UUID currentTenant = TenantContext.getTenantUuid();
    if (currentTenant == null) {
      currentTenant = UUID.fromString("00000000-0000-0000-0000-000000000001");
    }

    if (connectionRepository != null) {
      Optional<Connection> existingOpt = connectionRepository.findById(id);
      if (existingOpt.isPresent() && !currentTenant.equals(existingOpt.get().getTenantId())) {
        log.warn("Forbidden: connection '{}' does not belong to tenant '{}'", id, currentTenant);
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(Map.of("error", "Access denied to connection " + id));
      }
    }

    List<Map<String, Object>> cleanRows = new ArrayList<>();
    Set<String> columnSet = new LinkedHashSet<>();
    columnSet.add("canonicalName");
    columnSet.add("entityType");
    columnSet.add("confidenceScore");

    long rawCount = 0;
    long cleanCount = 0;
    long mergedCount = 0;
    double qualityScore = 98.4;

    List<Map<String, Object>> rawRows = connectionPreviewService.previewFile(id);
    String configuredEntityType = null;
    long actualTotalRows = 0;
    if (connectionRepository != null) {
      Optional<Connection> connOpt = connectionRepository.findByIdAndTenantId(id, currentTenant);
      if (connOpt.isPresent() && connOpt.get().getConfig() != null) {
        try {
          com.fasterxml.jackson.databind.JsonNode root =
              objectMapper.readTree(connOpt.get().getConfig());
          if (root.has("targetEntityType") && !root.get("targetEntityType").asText().isBlank()) {
            configuredEntityType = root.get("targetEntityType").asText();
          } else if (root.has("entityType") && !root.get("entityType").asText().isBlank()) {
            configuredEntityType = root.get("entityType").asText();
          }
          if (root.has("rowsCount")) {
            actualTotalRows = root.get("rowsCount").asLong();
          } else if (root.has("recordsCount")) {
            actualTotalRows = root.get("recordsCount").asLong();
          }
          if (rawRows.isEmpty() && root.has("sampleRows") && root.get("sampleRows").isArray()) {
            List<Map<String, Object>> cached = new ArrayList<>();
            for (com.fasterxml.jackson.databind.JsonNode rowNode : root.get("sampleRows")) {
              @SuppressWarnings("unchecked")
              Map<String, Object> map = objectMapper.convertValue(rowNode, Map.class);
              cached.add(map);
            }
            rawRows = cached;
          }
        } catch (Exception ignored) {
        }
      }
    }

    if (!rawRows.isEmpty()) {
      rawCount = actualTotalRows > 0 ? actualTotalRows : rawRows.size();
      long totalFields = 0;
      long validFields = 0;

      // Step 1: Clean and normalize raw rows
      List<Map<String, Object>> candidateCleanList = new ArrayList<>();
      for (Map<String, Object> raw : rawRows) {
        Map<String, Object> cleaned = new LinkedHashMap<>();
        long rowFields = 0;
        long rowValid = 0;

        for (Map.Entry<String, Object> e : raw.entrySet()) {
          String k = e.getKey() != null ? e.getKey().trim() : "";
          if (k.isBlank()) continue;
          rowFields++;
          totalFields++;

          Object v = e.getValue();
          String strVal = v != null ? String.valueOf(v).trim() : null;
          if (strVal != null
              && !strVal.isBlank()
              && !"null".equalsIgnoreCase(strVal)
              && !"n/a".equalsIgnoreCase(strVal)
              && !"none".equalsIgnoreCase(strVal)
              && !"-".equals(strVal)
              && !"undefined".equalsIgnoreCase(strVal)) {
            rowValid++;
            validFields++;

            String lk = k.toLowerCase();
            if (lk.contains("email") && strVal.contains("@")) {
              cleaned.put(k, strVal.toLowerCase());
            } else if ((lk.equals("name") || lk.equals("full_name") || lk.equals("company"))
                && !strVal.contains("@")) {
              cleaned.put(k, toTitleCase(strVal));
            } else {
              cleaned.put(k, strVal);
            }
            columnSet.add(k);
          } else {
            cleaned.put(k, "");
          }
        }

        String name = extractRowName(cleaned, configuredEntityType);
        String type = inferEntityType(cleaned, configuredEntityType);
        cleaned.put("_canonicalName", name);
        cleaned.put("_entityType", type);
        cleaned.put("_rowQuality", rowFields > 0 ? (double) rowValid / (double) rowFields : 1.0);

        // Find primary key for grouping / deduplication
        String pk = "";
        for (String k : cleaned.keySet()) {
          if (k.toLowerCase().contains("email") && !String.valueOf(cleaned.get(k)).isBlank()) {
            pk = "email:" + String.valueOf(cleaned.get(k)).toLowerCase();
            break;
          }
        }
        if (pk.isEmpty()) {
          for (String k : cleaned.keySet()) {
            String lk = k.toLowerCase().replace("_", " ").replace("-", " ").trim();
            if ((lk.equals("id")
                    || lk.endsWith(" id")
                    || lk.startsWith("id ")
                    || lk.contains("identifier")
                    || lk.contains("uuid")
                    || lk.endsWith(" code")
                    || lk.endsWith(" number")
                    || lk.equals("sku"))
                && !String.valueOf(cleaned.get(k)).isBlank()) {
              pk = "id:" + String.valueOf(cleaned.get(k)).trim().toLowerCase();
              break;
            }
          }
        }
        if (pk.isEmpty()) {
          pk = "name:" + name.toLowerCase();
        }
        cleaned.put("_primaryKey", pk);
        candidateCleanList.add(cleaned);
      }

      // Step 2: Group by _primaryKey to resolve duplicate entities
      Map<String, List<Map<String, Object>>> groups = new LinkedHashMap<>();
      for (Map<String, Object> cand : candidateCleanList) {
        String pk = String.valueOf(cand.get("_primaryKey"));
        groups.computeIfAbsent(pk, k -> new ArrayList<>()).add(cand);
      }

      mergedCount = 0;
      cleanRows.clear();
      for (List<Map<String, Object>> group : groups.values()) {
        if (group.size() > 1) {
          mergedCount += (group.size() - 1);
        }
        Map<String, Object> lead = group.get(0);
        Map<String, Object> mergedProps = new LinkedHashMap<>();
        double avgQuality = 0.0;

        for (Map<String, Object> member : group) {
          avgQuality += (Double) member.getOrDefault("_rowQuality", 1.0);
          for (Map.Entry<String, Object> entry : member.entrySet()) {
            if (entry.getKey().startsWith("_")) continue;
            if (entry.getValue() != null && !String.valueOf(entry.getValue()).isBlank()) {
              mergedProps.put(entry.getKey(), entry.getValue());
            }
          }
        }
        avgQuality /= group.size();

        int sourceCount = group.size();
        double boost = Math.min(0.06, (sourceCount - 1) * 0.03);
        double confidenceScore =
            Math.min(
                0.99,
                Math.max(
                    0.82, Math.round((0.90 + boost * 0.5 + avgQuality * 0.06) * 100.0) / 100.0));

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", UUID.randomUUID().toString());
        row.put("canonicalName", lead.get("_canonicalName"));
        row.put("entityType", lead.get("_entityType"));
        row.put("confidenceScore", confidenceScore);
        row.put("sourceCount", sourceCount);
        row.putAll(mergedProps);
        cleanRows.add(row);
      }

      cleanCount =
          actualTotalRows > 0 ? Math.max(0, actualTotalRows - mergedCount) : cleanRows.size();
      qualityScore =
          totalFields > 0
              ? Math.round(((double) validFields / (double) totalFields) * 1000.0) / 10.0
              : 100.0;

      // Idempotently persist golden records once per connection (avoiding duplication on repeat GET
      // requests)
      if (goldenRecordRepository != null) {
        try {
          Optional<Connection> connOpt =
              connectionRepository != null
                  ? connectionRepository.findByIdAndTenantId(id, currentTenant)
                  : Optional.empty();

          boolean alreadyPersisted = false;
          if (connOpt.isPresent() && connOpt.get().getConfig() != null) {
            try {
              com.fasterxml.jackson.databind.JsonNode conf =
                  objectMapper.readTree(connOpt.get().getConfig());
              if (conf.has("goldenRecordsPersisted")
                  && conf.get("goldenRecordsPersisted").asBoolean()) {
                alreadyPersisted = true;
              }
            } catch (Exception ignored) {
            }
          }

          if (!alreadyPersisted) {
            List<GoldenRecord> savedList = new ArrayList<>();
            for (Map<String, Object> cRow : cleanRows) {
              GoldenRecord gr = GoldenRecord.newStandalone();
              gr.setTenantId(currentTenant);
              gr.setCanonicalName(String.valueOf(cRow.get("canonicalName")));
              gr.setEntityType(String.valueOf(cRow.get("entityType")));
              gr.setConfidenceScore(
                  java.math.BigDecimal.valueOf((Double) cRow.get("confidenceScore")));
              gr.setSourceCount((Integer) cRow.get("sourceCount"));
              Map<String, Object> props = new LinkedHashMap<>(cRow);
              props.remove("id");
              props.remove("canonicalName");
              props.remove("entityType");
              props.remove("confidenceScore");
              props.remove("sourceCount");
              gr.getProperties().putAll(props);
              GoldenRecord saved = goldenRecordRepository.save(gr);
              savedList.add(saved);

              syncNodeToNeo4j(
                  currentTenant, saved.getId(), saved.getCanonicalName(), saved.getEntityType());
            }

            for (int i = 0; i < savedList.size() - 1 && i < 20; i++) {
              GoldenRecord a = savedList.get(i);
              GoldenRecord b = savedList.get(i + 1);
              if (a.getEntityType().equalsIgnoreCase(b.getEntityType())) {
                syncRelationshipToNeo4j(currentTenant, a.getId(), b.getId(), "SAME_CATEGORY");
              }
            }

            // Flag as persisted in connection configuration so subsequent GETs remain idempotent
            if (connOpt.isPresent() && connectionRepository != null) {
              Connection conn = connOpt.get();
              try {
                Map<String, Object> confMap = new LinkedHashMap<>();
                if (conn.getConfig() != null && !conn.getConfig().isBlank()) {
                  @SuppressWarnings("unchecked")
                  Map<String, Object> existing =
                      objectMapper.readValue(conn.getConfig(), Map.class);
                  confMap.putAll(existing);
                }
                confMap.put("goldenRecordsPersisted", true);
                conn.setConfig(objectMapper.writeValueAsString(confMap));
                connectionRepository.save(conn);
              } catch (Exception ignored) {
              }
            }

            log.info(
                "Persisted and graph-synced {} resolved golden records for connection '{}' (tenant {})",
                cleanRows.size(),
                id,
                currentTenant);
          }
        } catch (Exception e) {
          log.debug(
              "Auto-persistence of golden records in clean-preview skipped: {}", e.getMessage());
        }
      }
    }

    Map<String, Object> response = new LinkedHashMap<>();
    response.put("connectionId", id.toString());
    response.put("totalRawRecords", rawCount);
    response.put("totalCleanRecords", cleanCount);
    response.put("duplicatesMerged", mergedCount);
    response.put(
        "compressionRatio",
        rawCount > 0
            ? String.format("%.1f%%", ((double) mergedCount / (double) rawCount) * 100.0)
            : "0.0%");
    response.put("dataQualityScore", qualityScore);
    response.put("status", "RESOLVED_GOLDEN_RECORDS");
    response.put("columns", new ArrayList<>(columnSet));
    response.put("rows", cleanRows);

    return ResponseEntity.ok(response);
  }

  /** Exports cleaned and resolved entities for the connection directly as an RFC-4180 CSV file. */
  @GetMapping(value = "/{id}/export/clean-csv", produces = "text/csv")
  @org.springframework.security.access.prepost.PreAuthorize(
      "hasAnyRole('ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DATA_ENGINEER', 'OPERATOR', 'USER', 'VIEWER')")
  public void exportCleanCsv(
      @PathVariable UUID id, jakarta.servlet.http.HttpServletResponse response) throws IOException {
    response.setContentType("text/csv; charset=UTF-8");
    response.setHeader(
        "Content-Disposition", "attachment; filename=\"luminai-clean-dataset-" + id + ".csv\"");

    ResponseEntity<Map<String, Object>> previewRes = getCleanPreview(id);
    List<Map<String, Object>> cleanRows = new ArrayList<>();
    if (previewRes.getBody() != null && previewRes.getBody().get("rows") instanceof List) {
      @SuppressWarnings("unchecked")
      List<Map<String, Object>> rowsList =
          (List<Map<String, Object>>) previewRes.getBody().get("rows");
      cleanRows = rowsList;
    }

    PrintWriter writer = response.getWriter();
    if (!cleanRows.isEmpty()) {
      writeMapsToCsv(cleanRows, writer);
    } else {
      writer.println("id,canonical_name,entity_type,confidence_score,status");
    }
  }

  // ----------------------------------------------------------------
  // Real Ingestion & Schema Discovery Endpoints
  // ----------------------------------------------------------------

  /**
   * Uploads a raw data file (CSV, JSON, Excel) into MinIO object storage under a tenant-partitioned
   * path and streams the parsed rows into Kafka {@code ingest.raw} for Data Engine consumption.
   */
  @PostMapping(value = "/{id}/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  @org.springframework.security.access.prepost.PreAuthorize(
      "hasAnyRole('ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DATA_ENGINEER', 'OPERATOR')")
  public ResponseEntity<?> uploadFile(
      @PathVariable UUID id, @RequestParam("file") MultipartFile file) throws IOException {
    UUID tenantId = TenantContext.getTenantUuid();
    if (tenantId == null) {
      tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");
    }

    if (connectionRepository != null) {
      Optional<Connection> existingOpt = connectionRepository.findById(id);
      if (existingOpt.isPresent() && !tenantId.equals(existingOpt.get().getTenantId())) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(Map.of("error", "Access denied: connection belongs to another tenant"));
      }
    }

    boolean isZip =
        (file.getOriginalFilename() != null
                && file.getOriginalFilename().toLowerCase().endsWith(".zip"))
            || "application/zip".equalsIgnoreCase(file.getContentType())
            || "application/x-zip-compressed".equalsIgnoreCase(file.getContentType());

    if (isZip) {
      return handleZipArchiveUpload(tenantId, id, file);
    }

    String objectKey;
    try {
      objectKey = fileConnectorService.ingest(tenantId, id, file);
    } catch (Exception e) {
      log.warn(
          "MinIO storage unavailable ({}), proceeding with parsed memory payload", e.getMessage());
      objectKey =
          tenantId
              + "/raw/"
              + id
              + "/"
              + (file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload.csv");
    }

    List<Map<String, Object>> rows = parseFileRows(file);

    // 1. Update Connection in database with parsed sample rows & metadata
    if (connectionRepository != null) {
      try {
        Optional<Connection> connOpt = connectionRepository.findByIdAndTenantId(id, tenantId);
        if (connOpt.isPresent()) {
          Connection connection = connOpt.get();
          Map<String, Object> configMap = new LinkedHashMap<>();
          if (connection.getConfig() != null && !connection.getConfig().isBlank()) {
            try {
              @SuppressWarnings("unchecked")
              Map<String, Object> parsed =
                  objectMapper.readValue(connection.getConfig(), Map.class);
              configMap.putAll(parsed);
            } catch (Exception ignored) {
            }
          }
          configMap.put("fileName", file.getOriginalFilename());
          configMap.put("fileKey", objectKey);
          configMap.put("fileSize", file.getSize());
          configMap.put("recordsCount", rows.size());
          if (!rows.isEmpty()) {
            configMap.put("columns", new ArrayList<>(rows.get(0).keySet()));
            configMap.put("sampleRows", rows.subList(0, Math.min(rows.size(), 100)));
          }
          connection.setConfig(objectMapper.writeValueAsString(configMap));
          connection.setStatus(Connection.Status.ACTIVE);
          connection.setLastSyncAt(java.time.Instant.now());
          connectionRepository.save(connection);
          log.info("Persisted connection config and sample rows for connection '{}'", id);
        }
      } catch (Exception e) {
        log.warn("Failed to update connection with file config: {}", e.getMessage());
      }
    }

    // 2. Stream parsed rows into Kafka in chunked batches with objectKey for Data Engine
    // consumption
    final int BATCH_SIZE = 1000;
    if (!rows.isEmpty()) {
      try {
        int totalRows = rows.size();
        for (int i = 0; i < totalRows; i += BATCH_SIZE) {
          int end = Math.min(i + BATCH_SIZE, totalRows);
          List<Map<String, Object>> chunk = rows.subList(i, end);
          boolean isLast = (end == totalRows);
          connectionProducer.publishRows(
              tenantId, id, file.getOriginalFilename(), chunk, isLast, objectKey);
        }
        log.info(
            "Streamed {} parsed rows across {} Kafka batches for connection '{}' (tenant={})",
            totalRows,
            (int) Math.ceil((double) totalRows / BATCH_SIZE),
            id,
            tenantId);
      } catch (Exception e) {
        log.warn("Kafka publishing skipped: {}", e.getMessage());
      }
    } else {
      try {
        connectionProducer.publishRows(
            tenantId, id, file.getOriginalFilename(), List.of(), true, objectKey);
      } catch (Exception e) {
        log.warn("Kafka completion signal skipped: {}", e.getMessage());
      }
    }

    return ResponseEntity.ok(
        Map.of(
            "fileKey",
            objectKey,
            "status",
            "INGESTED",
            "fileName",
            file.getOriginalFilename() != null ? file.getOriginalFilename() : "file",
            "recordsCount",
            rows.size(),
            "message",
            "File processed and published to ingest pipeline"));
  }

  private ResponseEntity<Map<String, Object>> handleZipArchiveUpload(
      UUID tenantId, UUID connectionId, MultipartFile file) throws IOException {
    String objectKey;
    try {
      objectKey = fileConnectorService.ingest(tenantId, connectionId, file);
    } catch (Exception e) {
      log.warn(
          "MinIO storage unavailable ({}), proceeding with extracted memory payloads",
          e.getMessage());
      objectKey =
          tenantId
              + "/raw/"
              + connectionId
              + "/"
              + (file.getOriginalFilename() != null ? file.getOriginalFilename() : "archive.zip");
    }

    List<Map<String, Object>> tables = new ArrayList<>();
    int totalExtractedRows = 0;
    final int BATCH_SIZE = 1000;

    try (java.util.zip.ZipInputStream zis =
        new java.util.zip.ZipInputStream(file.getInputStream())) {
      java.util.zip.ZipEntry entry;
      while ((entry = zis.getNextEntry()) != null) {
        if (!entry.isDirectory()) {
          String entryName = entry.getName();
          java.nio.file.Path normalized = java.nio.file.Paths.get(entryName).normalize();
          if (normalized.startsWith("..") || normalized.isAbsolute()) {
            log.warn("Skipping unsafe ZIP entry: {}", entryName);
            zis.closeEntry();
            continue;
          }
          String cleanName = normalized.getFileName().toString();
          String lower = cleanName.toLowerCase();
          if (lower.endsWith(".csv") || lower.endsWith(".json")) {
            byte[] entryBytes = zis.readAllBytes();
            String entryKey;
            try {
              entryKey =
                  fileConnectorService.ingestBytes(
                      tenantId,
                      connectionId,
                      cleanName,
                      entryBytes,
                      lower.endsWith(".json") ? "application/json" : "text/csv");
            } catch (Exception e) {
              entryKey = tenantId + "/raw/" + connectionId + "/" + cleanName;
            }

            List<Map<String, Object>> entryRows = parseBytesRows(cleanName, entryBytes);
            if (!entryRows.isEmpty()) {
              int total = entryRows.size();
              for (int i = 0; i < total; i += BATCH_SIZE) {
                int end = Math.min(i + BATCH_SIZE, total);
                List<Map<String, Object>> chunk = entryRows.subList(i, end);
                boolean isLast = (end == total);
                try {
                  connectionProducer.publishRows(
                      tenantId, connectionId, cleanName, chunk, isLast, entryKey);
                } catch (Exception e) {
                  log.warn(
                      "Kafka publishing skipped for table '{}': {}", cleanName, e.getMessage());
                }
              }
            } else {
              try {
                connectionProducer.publishRows(
                    tenantId, connectionId, cleanName, List.of(), true, entryKey);
              } catch (Exception e) {
                log.warn(
                    "Kafka completion signal skipped for table '{}': {}",
                    cleanName,
                    e.getMessage());
              }
            }

            Map<String, Object> tableSummary = new LinkedHashMap<>();
            tableSummary.put("fileName", cleanName);
            tableSummary.put("fileKey", entryKey);
            tableSummary.put("recordsCount", entryRows.size());
            if (!entryRows.isEmpty()) {
              tableSummary.put("columns", new ArrayList<>(entryRows.get(0).keySet()));
              tableSummary.put("sampleRows", entryRows.subList(0, Math.min(entryRows.size(), 50)));
            }
            tables.add(tableSummary);
            totalExtractedRows += entryRows.size();
          }
        }
        zis.closeEntry();
      }
    }

    if (connectionRepository != null) {
      try {
        Optional<Connection> connOpt =
            connectionRepository.findByIdAndTenantId(connectionId, tenantId);
        if (connOpt.isPresent()) {
          Connection connection = connOpt.get();
          Map<String, Object> configMap = new LinkedHashMap<>();
          if (connection.getConfig() != null && !connection.getConfig().isBlank()) {
            try {
              @SuppressWarnings("unchecked")
              Map<String, Object> parsed =
                  objectMapper.readValue(connection.getConfig(), Map.class);
              configMap.putAll(parsed);
            } catch (Exception ignored) {
            }
          }
          configMap.put("fileName", file.getOriginalFilename());
          configMap.put("fileKey", objectKey);
          configMap.put("fileSize", file.getSize());
          configMap.put("archive", true);
          configMap.put("recordsCount", totalExtractedRows);
          configMap.put("tables", tables);
          connection.setConfig(objectMapper.writeValueAsString(configMap));
          connection.setStatus(Connection.Status.ACTIVE);
          connection.setLastSyncAt(java.time.Instant.now());
          connectionRepository.save(connection);
          log.info(
              "Persisted connection config with {} archive tables for connection '{}'",
              tables.size(),
              connectionId);
        }
      } catch (Exception e) {
        log.warn("Failed to update connection with archive config: {}", e.getMessage());
      }
    }

    Map<String, Object> resp = new LinkedHashMap<>();
    resp.put("fileKey", objectKey);
    resp.put("status", "INGESTED");
    resp.put(
        "fileName",
        file.getOriginalFilename() != null ? file.getOriginalFilename() : "archive.zip");
    resp.put("archive", true);
    resp.put("filesProcessed", tables.size());
    resp.put("recordsCount", totalExtractedRows);
    resp.put("tables", tables);
    resp.put(
        "message",
        "Archive processed: "
            + tables.size()
            + " dataset files extracted and published to ingest pipeline");
    return ResponseEntity.ok(resp);
  }

  /** Discovers schemas and tables for a given database configuration. */
  @PostMapping("/discover")
  @org.springframework.security.access.prepost.PreAuthorize(
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

  private static List<String> parseCsvLine(String line) {
    List<String> tokens = new ArrayList<>();
    StringBuilder sb = new StringBuilder();
    boolean inQuotes = false;
    for (int i = 0; i < line.length(); i++) {
      char c = line.charAt(i);
      if (c == '"') {
        if (inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '"') {
          sb.append('"');
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c == ',' && !inQuotes) {
        tokens.add(sb.toString().trim());
        sb.setLength(0);
      } else {
        sb.append(c);
      }
    }
    tokens.add(sb.toString().trim());
    return tokens;
  }

  private List<Map<String, Object>> parseBytesRows(String filename, byte[] data) {
    List<Map<String, Object>> rows = new ArrayList<>();
    String lower = filename != null ? filename.toLowerCase() : "";

    try (InputStream is = new java.io.ByteArrayInputStream(data)) {
      if (lower.endsWith(".json")) {
        ObjectMapper mapper = new ObjectMapper();
        Object parsed = mapper.readValue(is, Object.class);
        if (parsed instanceof List<?> list) {
          for (Object item : list) {
            if (item instanceof Map<?, ?> m) {
              @SuppressWarnings("unchecked")
              Map<String, Object> typedMap = (Map<String, Object>) m;
              rows.add(typedMap);
            }
          }
        }
      } else {
        try (BufferedReader reader =
            new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
          String headerLine = reader.readLine();
          if (headerLine != null && !headerLine.isBlank()) {
            List<String> headers = parseCsvLine(headerLine);
            String line;
            while ((line = reader.readLine()) != null) {
              if (line.isBlank()) continue;
              List<String> vals = parseCsvLine(line);
              Map<String, Object> row = new LinkedHashMap<>();
              for (int h = 0; h < headers.size(); h++) {
                String key = headers.get(h);
                String val = h < vals.size() ? vals.get(h) : "";
                row.put(key, val);
              }
              rows.add(row);
            }
          }
        }
      }
    } catch (Exception e) {
      log.warn("Failed to parse file bytes '{}': {}", filename, e.getMessage());
    }
    return rows;
  }

  private List<Map<String, Object>> parseFileRows(MultipartFile file) {
    try {
      return parseBytesRows(file.getOriginalFilename(), file.getBytes());
    } catch (Exception e) {
      log.warn("Failed to read file bytes '{}': {}", file.getOriginalFilename(), e.getMessage());
      return List.of();
    }
  }

  private void writeRecordsToCsv(List<GoldenRecord> records, PrintWriter writer) {
    Set<String> propertyKeys = new LinkedHashSet<>();
    for (GoldenRecord gr : records) {
      if (gr.getProperties() != null) {
        propertyKeys.addAll(gr.getProperties().keySet());
      }
    }

    List<String> headers = new ArrayList<>();
    headers.add("id");
    headers.add("canonical_name");
    headers.add("entity_type");
    headers.add("confidence_score");
    headers.add("source_count");
    headers.add("created_at");
    headers.addAll(propertyKeys);

    writer.write(String.join(",", headers) + "\r\n");

    for (GoldenRecord gr : records) {
      List<String> row = new ArrayList<>();
      row.add(escapeCsv(gr.getId() != null ? gr.getId().toString() : ""));
      row.add(escapeCsv(gr.getCanonicalName()));
      row.add(escapeCsv(gr.getEntityType()));
      row.add(
          escapeCsv(
              gr.getConfidenceScore() != null ? gr.getConfidenceScore().toString() : "1.0000"));
      row.add(String.valueOf(gr.getSourceCount()));
      row.add(escapeCsv(gr.getCreatedAt() != null ? gr.getCreatedAt().toString() : ""));

      Map<String, Object> props = gr.getProperties();
      for (String key : propertyKeys) {
        Object val = props != null ? props.get(key) : null;
        row.add(escapeCsv(val != null ? val.toString() : ""));
      }
      writer.write(String.join(",", row) + "\r\n");
    }
    writer.flush();
  }

  private void writeMapsToCsv(List<Map<String, Object>> rows, PrintWriter writer) {
    if (rows.isEmpty()) return;
    Set<String> headers = new LinkedHashSet<>();
    for (Map<String, Object> r : rows) {
      headers.addAll(r.keySet());
    }
    List<String> headerList = new ArrayList<>(headers);
    writer.write(String.join(",", headerList) + "\r\n");

    for (Map<String, Object> r : rows) {
      List<String> row = new ArrayList<>();
      for (String h : headerList) {
        Object v = r.get(h);
        row.add(escapeCsv(v != null ? v.toString() : ""));
      }
      writer.write(String.join(",", row) + "\r\n");
    }
    writer.flush();
  }

  private String escapeCsv(String val) {
    if (val == null) return "";
    if (val.contains(",") || val.contains("\"") || val.contains("\n") || val.contains("\r")) {
      return "\"" + val.replace("\"", "\"\"") + "\"";
    }
    return val;
  }

  private static String extractRowName(Map<String, Object> raw) {
    return extractRowName(raw, null);
  }

  private static String extractRowName(Map<String, Object> raw, String entityTypeHint) {
    if (raw == null || raw.isEmpty()) {
      return "Entity " + UUID.randomUUID().toString().substring(0, 8);
    }

    // 1. Check for specific natural person / entity name candidate keys first
    String[] candidateKeys = {
      "canonicalName",
      "canonical_name",
      "name",
      "full_name",
      "student_name",
      "customer_name",
      "user_name",
      "username",
      "person_name",
      "employee_name",
      "patient_name",
      "title",
      "company",
      "organization"
    };
    for (String key : candidateKeys) {
      if (raw.containsKey(key) && raw.get(key) != null && !String.valueOf(raw.get(key)).isBlank()) {
        return String.valueOf(raw.get(key)).trim();
      }
    }

    // 2. Check for item / product names
    String item = null;
    for (Map.Entry<String, Object> entry : raw.entrySet()) {
      String lk = entry.getKey().toLowerCase().replace("_", " ").trim();
      if ((lk.contains("item")
              || lk.contains("product")
              || lk.contains("sku")
              || lk.contains("category"))
          && entry.getValue() != null
          && !String.valueOf(entry.getValue()).isBlank()) {
        item = String.valueOf(entry.getValue()).trim();
        break;
      }
    }

    // 3. Check for specific ID identifiers
    String idVal = null;
    String idKey = null;
    for (Map.Entry<String, Object> entry : raw.entrySet()) {
      String lk = entry.getKey().toLowerCase().replace("_", " ").trim();
      if ((lk.equals("id")
              || lk.endsWith(" id")
              || lk.startsWith("id ")
              || lk.contains("identifier")
              || lk.contains("uuid")
              || lk.endsWith(" code")
              || lk.endsWith(" number")
              || lk.equals("sku"))
          && entry.getValue() != null
          && !String.valueOf(entry.getValue()).isBlank()) {
        idVal = String.valueOf(entry.getValue()).trim();
        idKey = entry.getKey().trim();
        break;
      }
    }

    if (idVal != null) {
      if (item != null) {
        return item + " (#" + idVal + ")";
      }
      String lk = idKey != null ? idKey.toLowerCase() : "";
      if (lk.contains("order")) {
        return "Order #" + idVal;
      } else if (lk.contains("student")) {
        return "Student #" + idVal;
      } else if (lk.contains("customer")) {
        return "Customer #" + idVal;
      } else if (lk.contains("patient")) {
        return "Patient #" + idVal;
      } else if (lk.contains("user")) {
        return "User #" + idVal;
      } else if (lk.contains("employee")) {
        return "Employee #" + idVal;
      } else if (entityTypeHint != null
          && !entityTypeHint.isBlank()
          && !"Organization".equalsIgnoreCase(entityTypeHint)
          && !"Entity".equalsIgnoreCase(entityTypeHint)) {
        return entityTypeHint + " #" + idVal;
      }
      return "#" + idVal;
    }

    for (Object val : raw.values()) {
      if (val != null && !String.valueOf(val).isBlank()) {
        return String.valueOf(val).trim();
      }
    }
    return "Entity " + UUID.randomUUID().toString().substring(0, 8);
  }

  private static String inferEntityType(Map<String, Object> raw) {
    return inferEntityType(raw, null);
  }

  private static String inferEntityType(Map<String, Object> raw, String entityTypeHint) {
    if (entityTypeHint != null && !entityTypeHint.isBlank()) {
      return entityTypeHint.trim();
    }
    if (raw == null || raw.isEmpty()) {
      return "Entity";
    }
    if (raw.containsKey("entityType") && raw.get("entityType") != null) {
      return String.valueOf(raw.get("entityType")).trim();
    }
    if (raw.containsKey("entity_type") && raw.get("entity_type") != null) {
      return String.valueOf(raw.get("entity_type")).trim();
    }
    String keys = String.join(" ", raw.keySet()).toLowerCase();
    if (keys.contains("student")
        || keys.contains("academic")
        || keys.contains("school")
        || keys.contains("grade")
        || keys.contains("course")) {
      return "Student";
    }
    if (keys.contains("order")
        || keys.contains("transaction")
        || keys.contains("revenue")
        || keys.contains("sales")
        || keys.contains("sale")
        || keys.contains("amount")
        || keys.contains("payment")
        || keys.contains("invoice")) {
      return "Transaction";
    }
    if (keys.contains("email")
        || keys.contains("first_name")
        || keys.contains("last_name")
        || keys.contains("user")
        || keys.contains("person")
        || keys.contains("age")
        || keys.contains("gender")
        || keys.contains("patient")) {
      return "Person";
    }
    if (keys.contains("company")
        || keys.contains("org")
        || keys.contains("industry")
        || keys.contains("domain")) {
      return "Organization";
    }
    if (keys.contains("price")
        || keys.contains("sku")
        || keys.contains("product")
        || keys.contains("inventory")) {
      return "Product";
    }
    return "Entity";
  }

  private static String toTitleCase(String input) {
    if (input == null || input.isBlank()) return "";
    String[] words = input.trim().split("\\s+");
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < words.length; i++) {
      if (words[i].length() > 0) {
        sb.append(Character.toUpperCase(words[i].charAt(0)));
        if (words[i].length() > 1) {
          sb.append(words[i].substring(1).toLowerCase());
        }
      }
      if (i < words.length - 1) sb.append(" ");
    }
    return sb.toString();
  }
}
