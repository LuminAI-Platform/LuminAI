package com.luminai.connection;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luminai.connection.model.Connection;
import com.luminai.connection.repository.ConnectionPreviewService;
import com.luminai.connection.repository.ConnectionRepository;
import com.luminai.connection.service.PostgresConnectorService;
import io.minio.GetObjectArgs;
import io.minio.ListObjectsArgs;
import io.minio.MinioClient;
import io.minio.messages.Item;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Production implementation of {@link ConnectionPreviewService}.
 *
 * <p>Streams raw file samples from MinIO object storage (CSV, JSON) and queries relational tables
 * via JDBC cursors (LIMIT 100) with SQL injection safeguards.
 */
@Service
public class ConnectionPreviewServiceImpl implements ConnectionPreviewService {

  private static final Logger log = LoggerFactory.getLogger(ConnectionPreviewServiceImpl.class);
  private static final int MAX_ROWS = 1000;

  private final ConnectionRepository connectionRepository;
  private final PostgresConnectorService postgresConnectorService;
  private final MinioClient minioClient;
  private final ObjectMapper objectMapper;

  @Value("${minio.bucket:luminai-raw}")
  private String bucket = "luminai-raw";

  public ConnectionPreviewServiceImpl(
      ConnectionRepository connectionRepository,
      PostgresConnectorService postgresConnectorService,
      MinioClient minioClient,
      ObjectMapper objectMapper) {
    this.connectionRepository = connectionRepository;
    this.postgresConnectorService = postgresConnectorService;
    this.minioClient = minioClient;
    this.objectMapper = objectMapper;
  }

  @Override
  public List<Map<String, Object>> previewFile(UUID connectionId) {
    UUID currentTenant = com.luminai.common.tenant.TenantContext.getTenantUuid();
    if (currentTenant == null) {
      log.warn("Tenant context missing for file preview (connection: {})", connectionId);
      return List.of();
    }
    Optional<Connection> connOpt =
        connectionRepository.findByIdAndTenantId(connectionId, currentTenant);

    if (connOpt.isEmpty()) {
      log.warn(
          "Connection '{}' not found for file preview (tenant: {})", connectionId, currentTenant);
      return List.of();
    }

    Connection connection = connOpt.get();

    // 1. Primary fast path: Check if connection config already contains cached parsed sample rows
    if (connection.getConfig() != null && !connection.getConfig().isBlank()) {
      try {
        JsonNode root = objectMapper.readTree(connection.getConfig());
        if (root.has("tables") && root.get("tables").isArray() && root.get("tables").size() > 0) {
          List<Map<String, Object>> archiveRows = new ArrayList<>();
          for (JsonNode tblNode : root.get("tables")) {
            String tblName = tblNode.has("fileName") ? tblNode.get("fileName").asText() : "";
            if (tblNode.has("sampleRows") && tblNode.get("sampleRows").isArray()) {
              for (JsonNode rNode : tblNode.get("sampleRows")) {
                @SuppressWarnings("unchecked")
                Map<String, Object> rMap = objectMapper.convertValue(rNode, Map.class);
                Map<String, Object> enriched = new LinkedHashMap<>();
                if (!tblName.isBlank()) {
                  enriched.put("_table", tblName);
                }
                enriched.putAll(rMap);
                archiveRows.add(enriched);
              }
            }
          }
          if (!archiveRows.isEmpty()) {
            return archiveRows;
          }
        }
        if (root.has("sampleRows")
            && root.get("sampleRows").isArray()
            && root.get("sampleRows").size() > 0) {
          List<Map<String, Object>> cached = new ArrayList<>();
          for (JsonNode rowNode : root.get("sampleRows")) {
            @SuppressWarnings("unchecked")
            Map<String, Object> map = objectMapper.convertValue(rowNode, Map.class);
            cached.add(map);
          }
          if (!cached.isEmpty()) {
            return cached;
          }
        }
      } catch (Exception e) {
        log.debug(
            "Could not parse config sampleRows for connection '{}': {}",
            connectionId,
            e.getMessage());
      }
    }

    // 2. Secondary path: Stream from MinIO object storage if available
    String objectKey = resolveObjectKey(connection);
    if (objectKey == null) {
      log.warn("No stored object key found for connection '{}'", connectionId);
      return List.of();
    }

    try (InputStream stream =
        minioClient.getObject(GetObjectArgs.builder().bucket(bucket).object(objectKey).build())) {

      if (objectKey.toLowerCase().endsWith(".json")) {
        return parseJsonPreview(stream, MAX_ROWS);
      } else {
        return parseCsvPreview(stream, MAX_ROWS);
      }

    } catch (Exception e) {
      log.warn(
          "Could not stream preview for connection '{}' at key '{}': {}",
          connectionId,
          objectKey,
          e.getMessage());
      return List.of();
    }
  }

  @Override
  public List<Map<String, Object>> previewStorageObject(
      UUID tenantId, String objectKey, int maxRows) {
    if (tenantId == null || objectKey == null || objectKey.isBlank()) {
      return List.of();
    }
    String normalizedKey = normalizeStorageKey(objectKey);
    String expectedPrefix = tenantId.toString() + "/";
    if (!isSafeTenantKey(normalizedKey, expectedPrefix)) {
      log.warn(
          "Rejected unsafe or cross-tenant storage preview key '{}' for tenant '{}'",
          objectKey,
          tenantId);
      return List.of();
    }
    int capped = maxRows > 0 ? Math.min(maxRows, MAX_ROWS) : MAX_ROWS;
    String lower = normalizedKey.toLowerCase();
    if (lower.endsWith(".parquet") || lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      // Binary formats are decoded via Data Engine Polars loader rather than Java line streaming.
      return List.of();
    }
    try (InputStream stream =
        minioClient.getObject(
            GetObjectArgs.builder().bucket(bucket).object(normalizedKey).build())) {
      if (lower.endsWith(".json") || lower.endsWith(".ndjson")) {
        return parseJsonPreview(stream, capped);
      }
      return parseCsvPreview(stream, capped);
    } catch (Exception e) {
      log.warn(
          "Could not stream storage object preview '{}' for tenant '{}': {}",
          normalizedKey,
          tenantId,
          e.getMessage());
      return List.of();
    }
  }

  private String normalizeStorageKey(String rawKey) {
    String key = rawKey.trim();
    for (String scheme : List.of("s3://" + bucket + "/", "minio://" + bucket + "/", bucket + "/")) {
      if (key.startsWith(scheme)) {
        return key.substring(scheme.length());
      }
    }
    return key;
  }

  @Override
  public List<Map<String, Object>> previewTable(UUID connectionId, String table) {
    UUID currentTenant = com.luminai.common.tenant.TenantContext.getTenantUuid();
    if (currentTenant == null) {
      log.warn("Tenant context missing for table preview (connection: {})", connectionId);
      return List.of();
    }
    Optional<Connection> connOpt =
        connectionRepository.findByIdAndTenantId(connectionId, currentTenant);

    if (connOpt.isEmpty()) {
      log.warn(
          "Connection '{}' not found for table preview (tenant: {})", connectionId, currentTenant);
      return List.of();
    }

    Connection connection = connOpt.get();
    String schema = "public";
    String targetTable = table;

    if (table.contains(".")) {
      String[] parts = table.split("\\.", 2);
      schema = parts[0];
      targetTable = parts[1];
    }

    try {
      return postgresConnectorService.previewRows(
          connection.getTenantId(), connectionId, schema, targetTable, MAX_ROWS);
    } catch (Exception e) {
      log.error(
          "Failed to preview table '{}.{}' for connection '{}': {}",
          schema,
          targetTable,
          connectionId,
          e.getMessage());
      return List.of();
    }
  }

  private String resolveObjectKey(Connection connection) {
    try {
      String expectedPrefix = connection.getTenantId().toString() + "/";
      if (connection.getConfig() != null && !connection.getConfig().isBlank()) {
        JsonNode root = objectMapper.readTree(connection.getConfig());
        if (root.has("fileKey") && !root.get("fileKey").asText().isBlank()) {
          String key = root.get("fileKey").asText();
          if (isSafeTenantKey(key, expectedPrefix)) {
            return key;
          }
          log.warn(
              "Invalid or cross-tenant fileKey '{}' rejected for tenant '{}'",
              key,
              connection.getTenantId());
        }
        if (root.has("objectKey") && !root.get("objectKey").asText().isBlank()) {
          String key = root.get("objectKey").asText();
          if (isSafeTenantKey(key, expectedPrefix)) {
            return key;
          }
          log.warn(
              "Invalid or cross-tenant objectKey '{}' rejected for tenant '{}'",
              key,
              connection.getTenantId());
        }
        if (root.has("fileName") && !root.get("fileName").asText().isBlank()) {
          String fileName = root.get("fileName").asText();
          if (!fileName.contains("..") && !fileName.contains("/") && !fileName.contains("\\")) {
            return String.format(
                "%s/raw/%s/%s", connection.getTenantId(), connection.getId(), fileName);
          }
        }
      }

      // Check MinIO prefix for uploaded file
      String prefix = String.format("%s/raw/%s/", connection.getTenantId(), connection.getId());
      var results =
          minioClient.listObjects(
              ListObjectsArgs.builder().bucket(bucket).prefix(prefix).maxKeys(1).build());
      for (var result : results) {
        Item item = result.get();
        if (item != null && !item.isDir()) {
          return item.objectName();
        }
      }
    } catch (Exception e) {
      log.debug("Error inspecting MinIO prefix: {}", e.getMessage());
    }

    return null;
  }

  private boolean isSafeTenantKey(String key, String expectedPrefix) {
    if (key == null || key.contains("..") || key.startsWith("/") || key.startsWith("\\")) {
      return false;
    }
    return key.startsWith(expectedPrefix);
  }

  private List<Map<String, Object>> parseCsvPreview(InputStream inputStream, int maxRows) {
    List<Map<String, Object>> rows = new ArrayList<>(Math.min(maxRows, MAX_ROWS));
    try (BufferedReader reader =
        new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {

      String headerLine = reader.readLine();
      if (headerLine == null || headerLine.isBlank()) {
        return rows;
      }

      List<String> headers =
          com.luminai.connection.util.ConnectionFileParser.parseCsvLine(headerLine);
      for (int i = 0; i < headers.size(); i++) {
        headers.set(i, headers.get(i).trim());
      }

      String line;
      int count = 0;
      while ((line = reader.readLine()) != null && count < maxRows) {
        if (line.isBlank()) continue;
        List<String> values = com.luminai.connection.util.ConnectionFileParser.parseCsvLine(line);
        Map<String, Object> row = new LinkedHashMap<>();
        for (int h = 0; h < headers.size(); h++) {
          String val = h < values.size() ? values.get(h).trim() : "";
          row.put(headers.get(h), val);
        }
        rows.add(row);
        count++;
      }
    } catch (Exception e) {
      log.warn("Failed to parse CSV preview: {}", e.getMessage());
    }
    return rows;
  }

  private List<Map<String, Object>> parseJsonPreview(InputStream inputStream, int maxRows) {
    List<Map<String, Object>> rows = new ArrayList<>(Math.min(maxRows, MAX_ROWS));
    try (com.fasterxml.jackson.core.JsonParser parser =
        objectMapper.getFactory().createParser(inputStream)) {
      com.fasterxml.jackson.core.JsonToken firstToken = parser.nextToken();
      if (firstToken == com.fasterxml.jackson.core.JsonToken.START_ARRAY) {
        while (parser.nextToken() != com.fasterxml.jackson.core.JsonToken.END_ARRAY
            && parser.currentToken() != null
            && rows.size() < maxRows) {
          if (parser.currentToken() == com.fasterxml.jackson.core.JsonToken.START_OBJECT) {
            @SuppressWarnings("unchecked")
            Map<String, Object> map = objectMapper.readValue(parser, Map.class);
            rows.add(map);
          } else {
            parser.skipChildren();
          }
        }
      } else if (firstToken == com.fasterxml.jackson.core.JsonToken.START_OBJECT) {
        @SuppressWarnings("unchecked")
        Map<String, Object> map = objectMapper.readValue(parser, Map.class);
        rows.add(map);
      }
    } catch (Exception e) {
      log.warn("Failed to parse JSON preview: {}", e.getMessage());
    }
    return rows;
  }
}
