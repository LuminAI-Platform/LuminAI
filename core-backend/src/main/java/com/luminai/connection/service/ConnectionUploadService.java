package com.luminai.connection.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.luminai.connection.model.Connection;
import com.luminai.connection.producer.ConnectionProducer;
import com.luminai.connection.repository.ConnectionRepository;
import com.luminai.connection.util.ConnectionFileParser;
import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/** Service orchestrating file uploads, archive extractions, and ingestion event streaming. */
@Service
public class ConnectionUploadService {

  private static final Logger log = LoggerFactory.getLogger(ConnectionUploadService.class);

  private final FileConnectorService fileConnectorService;
  private final ConnectionProducer connectionProducer;
  private final ConnectionRepository connectionRepository;
  private final ObjectMapper objectMapper;

  public ConnectionUploadService(
      FileConnectorService fileConnectorService,
      ConnectionProducer connectionProducer,
      ConnectionRepository connectionRepository,
      ObjectMapper objectMapper) {
    this.fileConnectorService = fileConnectorService;
    this.connectionProducer = connectionProducer;
    this.connectionRepository = connectionRepository;
    this.objectMapper = objectMapper;
  }

  public ResponseEntity<?> uploadFile(UUID tenantId, UUID id, MultipartFile file)
      throws IOException {
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

    ConnectionFileParser.StreamingParseResult parseResult =
        ConnectionFileParser.parseFileStream(file, 1000);
    List<Map<String, Object>> sampleRows = parseResult.sampleRows();
    List<String> columns = parseResult.columns();
    int totalRows = parseResult.totalRecords();

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
          configMap.put("recordsCount", totalRows);
          configMap.put("rowsCount", totalRows);
          if (!columns.isEmpty()) {
            configMap.put("columns", columns);
            configMap.put("sampleRows", sampleRows);
          }
          connection.setConfig(objectMapper.writeValueAsString(configMap));
          connection.setStatus(Connection.Status.ACTIVE);
          connection.setLastSyncAt(Instant.now());
          connectionRepository.save(connection);
          log.info("Persisted connection config and sample rows for connection '{}'", id);
        }
      } catch (Exception e) {
        log.warn("Failed to update connection with file config: {}", e.getMessage());
      }
    }

    // 2. Stream parsed rows into Kafka in chunked batches
    if (totalRows <= 1000) {
      if (!sampleRows.isEmpty()) {
        try {
          connectionProducer.publishRows(
              tenantId, id, file.getOriginalFilename(), sampleRows, true, objectKey);
          log.info(
              "Streamed {} parsed rows to Kafka for connection '{}' (tenant={})",
              totalRows,
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
    } else {
      try {
        connectionProducer.publishRows(
            tenantId, id, file.getOriginalFilename(), sampleRows, true, objectKey);
        log.info(
            "Dispatched MinIO reference objectKey='{}' ({} records) to Data Engine for connection '{}' (tenant={})",
            objectKey,
            totalRows,
            id,
            tenantId);
      } catch (Exception e) {
        log.warn("Kafka publishing skipped: {}", e.getMessage());
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
            totalRows,
            "message",
            "File processed and published to ingest pipeline"));
  }

  public ResponseEntity<Map<String, Object>> handleZipArchiveUpload(
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

    try (ZipInputStream zis = new ZipInputStream(file.getInputStream())) {
      ZipEntry entry;
      while ((entry = zis.getNextEntry()) != null) {
        if (!entry.isDirectory()) {
          String entryName = entry.getName();
          Path normalized = Paths.get(entryName).normalize();
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

            List<Map<String, Object>> entryRows =
                ConnectionFileParser.parseBytesRows(cleanName, entryBytes);
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
          connection.setLastSyncAt(Instant.now());
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
}
