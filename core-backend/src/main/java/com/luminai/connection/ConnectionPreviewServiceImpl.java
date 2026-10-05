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
  private static final int MAX_ROWS = 100;

  private final ConnectionRepository connectionRepository;
  private final PostgresConnectorService postgresConnectorService;
  private final MinioClient minioClient;
  private final ObjectMapper objectMapper;

  @Value("${minio.bucket:luminai-raw}")
  private String bucket;

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
    Optional<Connection> connOpt = connectionRepository.findById(connectionId);
    if (connOpt.isEmpty()) {
      UUID currentTenant = com.luminai.common.tenant.TenantContext.getTenantUuid();
      if (currentTenant != null) {
        connOpt = connectionRepository.findByIdAndTenantId(connectionId, currentTenant);
        if (connOpt.isEmpty()) {
          List<Connection> all = connectionRepository.findAllByTenantId(currentTenant);
          if (!all.isEmpty()) {
            connOpt = Optional.of(all.get(0));
          }
        }
      }
    }
    if (connOpt.isEmpty()) {
      log.warn("Connection '{}' not found for file preview", connectionId);
      return List.of();
    }

    Connection connection = connOpt.get();

    // 1. Primary fast path: Check if connection config already contains cached parsed sample rows
    if (connection.getConfig() != null && !connection.getConfig().isBlank()) {
      try {
        JsonNode root = objectMapper.readTree(connection.getConfig());
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
        return parseJsonPreview(stream);
      } else {
        return parseCsvPreview(stream);
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
  public List<Map<String, Object>> previewTable(UUID connectionId, String table) {
    Optional<Connection> connOpt = connectionRepository.findById(connectionId);
    if (connOpt.isEmpty()) {
      log.warn("Connection '{}' not found for table preview", connectionId);
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
      if (connection.getConfig() != null && !connection.getConfig().isBlank()) {
        JsonNode root = objectMapper.readTree(connection.getConfig());
        if (root.has("fileKey") && !root.get("fileKey").asText().isBlank()) {
          return root.get("fileKey").asText();
        }
        if (root.has("objectKey") && !root.get("objectKey").asText().isBlank()) {
          return root.get("objectKey").asText();
        }
        if (root.has("fileName") && !root.get("fileName").asText().isBlank()) {
          return String.format(
              "%s/raw/%s/%s",
              connection.getTenantId(), connection.getId(), root.get("fileName").asText());
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

  private List<Map<String, Object>> parseCsvPreview(InputStream inputStream) {
    List<Map<String, Object>> rows = new ArrayList<>(MAX_ROWS);
    try (BufferedReader reader =
        new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {

      String headerLine = reader.readLine();
      if (headerLine == null || headerLine.isBlank()) {
        return rows;
      }

      String[] headers = headerLine.split(",");
      for (int i = 0; i < headers.length; i++) {
        headers[i] = headers[i].trim().replaceAll("^\"|\"$", "");
      }

      String line;
      int count = 0;
      while ((line = reader.readLine()) != null && count < MAX_ROWS) {
        if (line.isBlank()) continue;
        String[] values = line.split(",", -1);
        Map<String, Object> row = new LinkedHashMap<>();
        for (int h = 0; h < headers.length; h++) {
          String val = h < values.length ? values[h].trim().replaceAll("^\"|\"$", "") : "";
          row.put(headers[h], val);
        }
        rows.add(row);
        count++;
      }
    } catch (Exception e) {
      log.warn("Failed to parse CSV preview: {}", e.getMessage());
    }
    return rows;
  }

  private List<Map<String, Object>> parseJsonPreview(InputStream inputStream) {
    List<Map<String, Object>> rows = new ArrayList<>(MAX_ROWS);
    try {
      JsonNode node = objectMapper.readTree(inputStream);
      if (node.isArray()) {
        int count = 0;
        for (JsonNode element : node) {
          if (count >= MAX_ROWS) break;
          if (element.isObject()) {
            @SuppressWarnings("unchecked")
            Map<String, Object> map = objectMapper.convertValue(element, Map.class);
            rows.add(map);
            count++;
          }
        }
      }
    } catch (Exception e) {
      log.warn("Failed to parse JSON preview: {}", e.getMessage());
    }
    return rows;
  }
}
