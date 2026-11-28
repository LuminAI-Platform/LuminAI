package com.luminai.connection.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.luminai.dataset.service.DatasetService;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/** Helper to register raw datasets and versions during connection ingestion. */
@Component
public class DatasetRegistrationHelper {

  private static final Logger log = LoggerFactory.getLogger(DatasetRegistrationHelper.class);

  private final DatasetService datasetService;
  private final ObjectMapper objectMapper;
  private final SchemaDetector schemaDetector;

  public DatasetRegistrationHelper(DatasetService datasetService, ObjectMapper objectMapper) {
    this(datasetService, objectMapper, new SchemaDetector());
  }

  @Autowired
  public DatasetRegistrationHelper(
      @Autowired(required = false) DatasetService datasetService,
      ObjectMapper objectMapper,
      @Autowired(required = false) SchemaDetector schemaDetector) {
    this.datasetService = datasetService;
    this.objectMapper = objectMapper;
    this.schemaDetector = schemaDetector != null ? schemaDetector : new SchemaDetector();
  }

  public void registerRawFileDataset(
      UUID tenantId,
      UUID connectionId,
      String fileName,
      String fileKey,
      long rowCount,
      long byteSize,
      List<String> columns) {
    registerRawFileDataset(
        tenantId, connectionId, fileName, fileKey, rowCount, byteSize, columns, null);
  }

  public void registerRawFileDataset(
      UUID tenantId,
      UUID connectionId,
      String fileName,
      String fileKey,
      long rowCount,
      long byteSize,
      List<String> columns,
      List<Map<String, Object>> sampleRows) {
    if (datasetService == null) return;
    try {
      String cleanName =
          sanitizeDatasetName(fileName != null ? fileName : "raw_dataset_" + connectionId);
      String schemaJson = inferSchemaJson(columns, sampleRows);
      datasetService.registerRawDataset(
          tenantId, connectionId, cleanName, fileName, fileKey, rowCount, byteSize, schemaJson);
      log.info("Auto-registered RAW dataset '{}' for connection {}", cleanName, connectionId);
    } catch (Exception e) {
      log.warn(
          "Failed to auto-register RAW dataset for connection {}: {}",
          connectionId,
          e.getMessage());
    }
  }

  public void registerRawArchiveTables(
      UUID tenantId, UUID connectionId, String archiveName, List<Map<String, Object>> tables) {
    if (datasetService == null || tables == null) return;
    for (Map<String, Object> tbl : tables) {
      try {
        String tblFileName = (String) tbl.get("fileName");
        String tblKey = (String) tbl.get("fileKey");
        long records = tbl.get("recordsCount") instanceof Number n ? n.longValue() : 0L;
        @SuppressWarnings("unchecked")
        List<String> cols = (List<String>) tbl.get("columns");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> sampleRows = (List<Map<String, Object>>) tbl.get("sampleRows");
        String cleanName = sanitizeDatasetName(tblFileName != null ? tblFileName : "table");
        String schemaJson = inferSchemaJson(cols, sampleRows);
        datasetService.registerRawDataset(
            tenantId,
            connectionId,
            cleanName,
            tblFileName,
            tblKey,
            records,
            records * 100L,
            schemaJson,
            true);
      } catch (Exception e) {
        log.warn("Failed to register table dataset from archive: {}", e.getMessage());
      }
    }
  }

  public void registerDatabaseTableDataset(
      UUID tenantId,
      UUID connectionId,
      String qualifiedTable,
      long rowCount,
      List<Map<String, Object>> sampleRows) {
    if (datasetService == null || qualifiedTable == null || qualifiedTable.isBlank()) return;
    try {
      String cleanName = sanitizeDatasetName(qualifiedTable);
      String schemaJson = inferSchemaJson(null, sampleRows);
      datasetService.registerRawDataset(
          tenantId,
          connectionId,
          cleanName,
          qualifiedTable,
          null,
          rowCount,
          Math.max(0L, rowCount * 128L),
          schemaJson,
          true);
      log.info(
          "Auto-registered DB table dataset '{}' ({} rows) for connection {}",
          cleanName,
          rowCount,
          connectionId);
    } catch (Exception e) {
      log.warn(
          "Failed to auto-register DB table dataset '{}' for connection {}: {}",
          qualifiedTable,
          connectionId,
          e.getMessage());
    }
  }

  String inferSchemaJson(List<String> columns, List<Map<String, Object>> sampleRows) {
    try {
      Set<String> orderedCols = new LinkedHashSet<>();
      if (columns != null) {
        for (String col : columns) {
          if (col != null && !col.isBlank()) {
            orderedCols.add(col);
          }
        }
      }
      if (sampleRows != null) {
        for (Map<String, Object> row : sampleRows) {
          if (row != null) {
            orderedCols.addAll(row.keySet());
          }
        }
      }
      if (orderedCols.isEmpty()) {
        return "{}";
      }

      Map<String, List<String>> colValues = new LinkedHashMap<>();
      for (String col : orderedCols) {
        colValues.put(col, new ArrayList<>());
      }
      if (sampleRows != null) {
        for (Map<String, Object> row : sampleRows) {
          if (row == null) continue;
          for (String col : orderedCols) {
            Object val = row.get(col);
            if (val != null) {
              colValues.get(col).add(String.valueOf(val));
            }
          }
        }
      }

      Map<String, String> schemaMap = new LinkedHashMap<>();
      for (Map.Entry<String, List<String>> entry : colValues.entrySet()) {
        SchemaDetector.DataType dt = schemaDetector.inferColumnType(entry.getValue());
        String typeLabel =
            switch (dt) {
              case INTEGER -> "integer";
              case DOUBLE -> "float";
              case BOOLEAN -> "boolean";
              case TIMESTAMP -> "datetime";
              case STRING -> "string";
            };
        schemaMap.put(entry.getKey(), typeLabel);
      }
      return objectMapper.writeValueAsString(schemaMap);
    } catch (Exception e) {
      return "{}";
    }
  }

  public static void populateArchiveCombinedSamples(
      Map<String, Object> configMap, List<Map<String, Object>> tables) {
    List<Map<String, Object>> combined = new java.util.ArrayList<>();
    java.util.LinkedHashSet<String> cols = new java.util.LinkedHashSet<>();
    cols.add("_table");

    for (Map<String, Object> tbl : tables) {
      String tblName = (String) tbl.get("fileName");
      @SuppressWarnings("unchecked")
      List<Map<String, Object>> tRows = (List<Map<String, Object>>) tbl.get("sampleRows");
      if (tRows != null) {
        for (Map<String, Object> r : tRows) {
          Map<String, Object> rowWithTable = new java.util.LinkedHashMap<>();
          rowWithTable.put("_table", tblName);
          rowWithTable.putAll(r);
          combined.add(rowWithTable);
          cols.addAll(r.keySet());
          if (combined.size() >= 150) break;
        }
      }
      if (combined.size() >= 150) break;
    }

    if (!combined.isEmpty()) {
      configMap.put("columns", new java.util.ArrayList<>(cols));
      configMap.put("sampleRows", combined);
    }
  }

  private String sanitizeDatasetName(String name) {
    String clean = name.toLowerCase().replaceAll("[^a-z0-9_]+", "_").replaceAll("^_+|_+$", "");
    return clean.isBlank() ? "dataset" : clean;
  }
}
