package com.luminai.connection.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luminai.common.tenant.TenantContext;
import com.luminai.config.CacheConfig;
import com.luminai.connection.model.Connection;
import com.luminai.connection.repository.ConnectionPreviewService;
import com.luminai.connection.repository.ConnectionRepository;
import com.luminai.connection.repository.GoldenRecordRepository;
import com.luminai.connection.repository.SchemaMappingRepository;
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
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
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

  @Autowired(required = false)
  private CacheManager cacheManager;

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

  public void setSchemaMappingRepository(SchemaMappingRepository repo) {
    if (this.persistenceService != null) {
      this.persistenceService.setSchemaMappingRepository(repo);
    }
  }

  public void setCacheManager(CacheManager cacheManager) {
    this.cacheManager = cacheManager;
    if (this.persistenceService != null) {
      this.persistenceService.setCacheManager(cacheManager);
    }
  }

  public static String cacheKey(UUID tenantId, UUID connectionId) {
    return tenantId + ":" + connectionId;
  }

  public static void evictPreviewCache(CacheManager manager, UUID tenantId, UUID connectionId) {
    if (manager == null || tenantId == null || connectionId == null) return;
    try {
      Cache cache = manager.getCache(CacheConfig.CACHE_CLEAN_PREVIEW);
      if (cache != null) {
        cache.evict(cacheKey(tenantId, connectionId));
      }
    } catch (Exception e) {
      log.debug("Failed to evict clean-preview cache for {}: {}", connectionId, e.getMessage());
    }
  }

  public ResponseEntity<Map<String, Object>> getCleanPreview(UUID id) {
    UUID currentTenant = TenantContext.getTenantUuid();
    if (currentTenant == null) {
      log.warn(
          "Unauthorized clean preview request for connection '{}': missing tenant context", id);
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("error", "Unauthorized: missing tenant context"));
    }

    Optional<Connection> existingOpt = Optional.empty();
    if (connectionRepository != null) {
      existingOpt = connectionRepository.findById(id);
      if (existingOpt.isPresent() && !currentTenant.equals(existingOpt.get().getTenantId())) {
        log.warn("Forbidden: connection '{}' does not belong to tenant '{}'", id, currentTenant);
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(Map.of("error", "Access denied to connection " + id));
      }
    }

    Map<String, Object> cachedPreview = readCachedPreview(currentTenant, id);
    if (cachedPreview != null) {
      return ResponseEntity.ok(cachedPreview);
    }

    List<Map<String, Object>> rawRows = connectionPreviewService.previewFile(id);
    Optional<Connection> connOpt = existingOpt.filter(c -> currentTenant.equals(c.getTenantId()));
    if (connOpt.isEmpty() && connectionRepository != null) {
      connOpt = connectionRepository.findByIdAndTenantId(id, currentTenant);
    }

    String configuredEntityType =
        persistenceService.resolveConfiguredEntityType(
            connOpt.orElse(null), id, currentTenant, null);

    if (connOpt.isPresent() && connOpt.get().getConfig() != null) {
      try {
        JsonNode root = objectMapper.readTree(connOpt.get().getConfig());
        if (rawRows.isEmpty()) {
          rawRows = extractConfigSampleRows(root);
        }
      } catch (Exception ignored) {
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

    String resolvedRequestType =
        (configuredEntityType != null && !configuredEntityType.isBlank())
            ? configuredEntityType
            : ConnectionFileParser.inferEntityType(rawRows.get(0), null);
    Map<String, Object> remoteReq = new HashMap<>();
    remoteReq.put("tenant_id", currentTenant.toString());
    remoteReq.put("source_id", id.toString());
    remoteReq.put("entity_type", resolvedRequestType);
    remoteReq.put("rows", rawRows);
    remoteReq.put("options", Map.of("include_golden_records", false));

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
      HttpStatus errorStatus = resolveErrorStatus(engineRes);
      log.warn("Data Engine returned error or invalid status ({}): {}", errorStatus, errorMsg);
      return ResponseEntity.status(errorStatus)
          .body(Map.of("error", errorMsg, "status", errorStatus.name()));
    }

    if (engineRes.containsKey("rows") && engineRes.get("rows") instanceof List) {
      @SuppressWarnings("unchecked")
      List<Map<String, Object>> rRows = (List<Map<String, Object>>) engineRes.get("rows");
      if (!rRows.isEmpty()) {
        persistenceService.syncGoldenRecords(
            id, currentTenant, null, configuredEntityType, rRows, false);
      }
    }

    writeCachedPreview(currentTenant, id, engineRes);
    return ResponseEntity.ok(engineRes);
  }

  private List<Map<String, Object>> extractConfigSampleRows(JsonNode root) {
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
    if (root.has("sampleRows") && root.get("sampleRows").isArray()) {
      List<Map<String, Object>> cached = new ArrayList<>();
      for (JsonNode rowNode : root.get("sampleRows")) {
        @SuppressWarnings("unchecked")
        Map<String, Object> map = objectMapper.convertValue(rowNode, Map.class);
        cached.add(map);
      }
      return cached;
    }
    return List.of();
  }

  private static HttpStatus resolveErrorStatus(Map<String, Object> engineRes) {
    if (engineRes == null) {
      return HttpStatus.SERVICE_UNAVAILABLE;
    }
    if (Boolean.TRUE.equals(engineRes.get("timedOut"))) {
      return HttpStatus.GATEWAY_TIMEOUT;
    }
    Object codeObj = engineRes.get("statusCode");
    if (codeObj instanceof Number n) {
      int code = n.intValue();
      if (code == 504) return HttpStatus.GATEWAY_TIMEOUT;
      if (code == 429) return HttpStatus.TOO_MANY_REQUESTS;
    }
    return HttpStatus.SERVICE_UNAVAILABLE;
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> readCachedPreview(UUID tenantId, UUID connectionId) {
    if (cacheManager == null) return null;
    try {
      Cache cache = cacheManager.getCache(CacheConfig.CACHE_CLEAN_PREVIEW);
      if (cache == null) return null;
      Cache.ValueWrapper wrapper = cache.get(cacheKey(tenantId, connectionId));
      if (wrapper != null && wrapper.get() instanceof Map<?, ?> cachedMap) {
        if ("COMPLETED".equals(cachedMap.get("status"))) {
          return (Map<String, Object>) cachedMap;
        }
      }
    } catch (Exception e) {
      log.debug("Failed reading clean-preview cache for {}: {}", connectionId, e.getMessage());
    }
    return null;
  }

  private void writeCachedPreview(UUID tenantId, UUID connectionId, Map<String, Object> response) {
    if (cacheManager == null || response == null) return;
    try {
      Cache cache = cacheManager.getCache(CacheConfig.CACHE_CLEAN_PREVIEW);
      if (cache != null) {
        cache.put(cacheKey(tenantId, connectionId), new LinkedHashMap<>(response));
      }
    } catch (Exception e) {
      log.debug("Failed writing clean-preview cache for {}: {}", connectionId, e.getMessage());
    }
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
