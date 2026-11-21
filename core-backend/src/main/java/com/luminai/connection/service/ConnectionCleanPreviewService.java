package com.luminai.connection.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luminai.common.tenant.TenantContext;
import com.luminai.connection.model.Connection;
import com.luminai.connection.repository.ConnectionPreviewService;
import com.luminai.connection.repository.ConnectionRepository;
import com.luminai.connection.repository.GoldenRecordRepository;
import com.luminai.connection.util.ConnectionFileParser;
import com.luminai.engine.service.DataEngineClient;
import com.luminai.graph.repository.Neo4jGraphRepository;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

/**
 * Service managing dataset cleaning preview and golden record persistence by strictly delegating
 * data cleaning, standardization, and quality profiling to the Python Data Engine (:8000).
 */
@Service
public class ConnectionCleanPreviewService {

  private static final Logger log = LoggerFactory.getLogger(ConnectionCleanPreviewService.class);

  private final ConnectionPreviewService connectionPreviewService;
  private final ConnectionRepository connectionRepository;
  private final ObjectMapper objectMapper;
  private final GoldenRecordPersistenceService persistenceService;

  @Autowired(required = false)
  private DataEngineClient dataEngineClient;

  public ConnectionCleanPreviewService(
      ConnectionPreviewService connectionPreviewService,
      ConnectionRepository connectionRepository,
      GoldenRecordRepository goldenRecordRepository,
      ObjectMapper objectMapper) {
    this(
        connectionPreviewService, connectionRepository, goldenRecordRepository, objectMapper, null);
  }

  @Autowired
  public ConnectionCleanPreviewService(
      ConnectionPreviewService connectionPreviewService,
      ConnectionRepository connectionRepository,
      GoldenRecordRepository goldenRecordRepository,
      ObjectMapper objectMapper,
      @Autowired(required = false) DataEngineClient dataEngineClient) {
    this.connectionPreviewService = connectionPreviewService;
    this.connectionRepository = connectionRepository;
    this.objectMapper = objectMapper;
    this.persistenceService =
        new GoldenRecordPersistenceService(
            goldenRecordRepository, connectionRepository, objectMapper);
    this.dataEngineClient = dataEngineClient;
  }

  public void setNeo4jGraphRepository(Neo4jGraphRepository repo) {
    if (this.persistenceService != null) {
      this.persistenceService.setNeo4jGraphRepository(repo);
    }
  }

  public void setDataEngineClient(DataEngineClient client) {
    this.dataEngineClient = client;
  }

  public ResponseEntity<Map<String, Object>> getCleanPreview(UUID id) {
    UUID currentTenant = TenantContext.getTenantUuid();
    if (currentTenant == null) {
      log.warn(
          "Unauthorized clean preview request for connection '{}': missing tenant context", id);
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("error", "Unauthorized: missing tenant context"));
    }

    if (connectionRepository != null) {
      Optional<Connection> existingOpt = connectionRepository.findById(id);
      if (existingOpt.isPresent() && !currentTenant.equals(existingOpt.get().getTenantId())) {
        log.warn("Forbidden: connection '{}' does not belong to tenant '{}'", id, currentTenant);
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(Map.of("error", "Access denied to connection " + id));
      }
    }

    List<Map<String, Object>> rawRows = connectionPreviewService.previewFile(id);
    String configuredEntityType = null;

    if (connectionRepository != null) {
      Optional<Connection> connOpt = connectionRepository.findByIdAndTenantId(id, currentTenant);
      if (connOpt.isPresent() && connOpt.get().getConfig() != null) {
        try {
          JsonNode root = objectMapper.readTree(connOpt.get().getConfig());
          if (root.has("targetEntityType") && !root.get("targetEntityType").asText().isBlank()) {
            configuredEntityType = root.get("targetEntityType").asText();
          } else if (root.has("entityType") && !root.get("entityType").asText().isBlank()) {
            configuredEntityType = root.get("entityType").asText();
          }

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
              rawRows = archiveRows;
            }
          } else if (rawRows.isEmpty()
              && root.has("sampleRows")
              && root.get("sampleRows").isArray()) {
            List<Map<String, Object>> cached = new ArrayList<>();
            for (JsonNode rowNode : root.get("sampleRows")) {
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

    if (rawRows.isEmpty()) {
      Map<String, Object> emptyRes = new LinkedHashMap<>();
      emptyRes.put("connectionId", id.toString());
      emptyRes.put("totalRawRecords", 0);
      emptyRes.put("totalCleanRecords", 0);
      emptyRes.put("duplicatesMerged", 0);
      emptyRes.put("verifiedRecords", 0);
      emptyRes.put("needsReviewRecords", 0);
      emptyRes.put("rejectedRecords", 0);
      emptyRes.put("dataQualityScore", 100.0);
      emptyRes.put("status", "COMPLETED");
      emptyRes.put("columns", List.of());
      emptyRes.put("rows", List.of());
      return ResponseEntity.ok(emptyRes);
    }

    if (dataEngineClient == null) {
      log.error("Data Engine client is null. Cannot perform clean preview.");
      return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
          .body(
              Map.of(
                  "error", "Data Engine service is offline or not configured.",
                  "status", "SERVICE_UNAVAILABLE"));
    }

    Map<String, Object> remoteReq = new HashMap<>();
    remoteReq.put("tenant_id", currentTenant.toString());
    remoteReq.put("source_id", id.toString());
    remoteReq.put("entity_type", configuredEntityType != null ? configuredEntityType : "Person");
    remoteReq.put("rows", rawRows);

    Map<String, Object> engineRes;
    try {
      engineRes = dataEngineClient.cleanDatasetDirect(remoteReq);
    } catch (Exception ex) {
      log.error("Data Engine cleaning request failed for connection {}: {}", id, ex.getMessage());
      return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
          .body(
              Map.of(
                  "error",
                  "Data Engine service is offline or failed: " + ex.getMessage(),
                  "status",
                  "SERVICE_UNAVAILABLE"));
    }

    if (engineRes == null
        || engineRes.containsKey("error")
        || !"COMPLETED".equals(engineRes.get("status"))) {
      String errorMsg =
          engineRes != null && engineRes.get("error") != null
              ? String.valueOf(engineRes.get("error"))
              : "Data Engine did not return completed clean preview results.";
      log.warn("Data Engine returned error or invalid status: {}", errorMsg);
      return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
          .body(Map.of("error", errorMsg, "status", "SERVICE_UNAVAILABLE"));
    }

    if (engineRes.containsKey("rows") && engineRes.get("rows") instanceof List) {
      @SuppressWarnings("unchecked")
      List<Map<String, Object>> rRows = (List<Map<String, Object>>) engineRes.get("rows");
      if (!rRows.isEmpty()) {
        persistenceService.persistGoldenRecords(id, currentTenant, rRows);
      }
    }

    return ResponseEntity.ok(engineRes);
  }

  public void exportCleanCsv(UUID id, HttpServletResponse response) throws IOException {
    response.setContentType("text/csv; charset=UTF-8");
    response.setHeader(
        "Content-Disposition", "attachment; filename=\"luminai-clean-dataset-" + id + ".csv\"");

    ResponseEntity<Map<String, Object>> previewRes = getCleanPreview(id);
    List<Map<String, Object>> cleanRows = new ArrayList<>();
    if (previewRes.getStatusCode().is2xxSuccessful()
        && previewRes.getBody() != null
        && previewRes.getBody().get("rows") instanceof List) {
      @SuppressWarnings("unchecked")
      List<Map<String, Object>> rowsList =
          (List<Map<String, Object>>) previewRes.getBody().get("rows");
      cleanRows = rowsList;
    }

    PrintWriter writer = response.getWriter();
    if (!cleanRows.isEmpty()) {
      ConnectionFileParser.writeMapsToCsv(cleanRows, writer);
    } else {
      writer.println(
          "id,canonical_name,entity_type,confidence_score,quality_state,quality_score,status");
    }
  }
}
