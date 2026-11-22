package com.luminai.connection.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.luminai.dataset.service.DatasetService;
import java.util.List;
import java.util.Map;
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

  @Autowired
  public DatasetRegistrationHelper(
      @Autowired(required = false) DatasetService datasetService, ObjectMapper objectMapper) {
    this.datasetService = datasetService;
    this.objectMapper = objectMapper;
  }

  public void registerRawFileDataset(
      UUID tenantId,
      UUID connectionId,
      String fileName,
      String fileKey,
      long rowCount,
      long byteSize,
      List<String> columns) {
    if (datasetService == null) return;
    try {
      String cleanName =
          sanitizeDatasetName(fileName != null ? fileName : "raw_dataset_" + connectionId);
      String schemaJson = columns != null ? objectMapper.writeValueAsString(columns) : "[]";
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
      UUID tenantId,
      UUID connectionId,
      String archiveName,
      List<Map<String, Object>> tables) {
    if (datasetService == null || tables == null) return;
    for (Map<String, Object> tbl : tables) {
      try {
        String tblFileName = (String) tbl.get("fileName");
        String tblKey = (String) tbl.get("fileKey");
        long records = tbl.get("recordsCount") instanceof Number n ? n.longValue() : 0L;
        @SuppressWarnings("unchecked")
        List<String> cols = (List<String>) tbl.get("columns");
        String cleanName = sanitizeDatasetName(tblFileName != null ? tblFileName : "table");
        String schemaJson = cols != null ? objectMapper.writeValueAsString(cols) : "[]";
        datasetService.registerRawDataset(
            tenantId,
            connectionId,
            cleanName,
            tblFileName,
            tblKey,
            records,
            records * 100L,
            schemaJson);
      } catch (Exception e) {
        log.warn("Failed to register table dataset from archive: {}", e.getMessage());
      }
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
