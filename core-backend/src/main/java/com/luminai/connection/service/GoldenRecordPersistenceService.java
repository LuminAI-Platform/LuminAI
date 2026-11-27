package com.luminai.connection.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luminai.common.tenant.TenantContext;
import com.luminai.config.CacheConfig;
import com.luminai.connection.model.Connection;
import com.luminai.connection.model.GoldenRecord;
import com.luminai.connection.model.ProvenanceEntry;
import com.luminai.connection.model.SchemaMapping;
import com.luminai.connection.repository.ConnectionRepository;
import com.luminai.connection.repository.GoldenRecordRepository;
import com.luminai.connection.repository.SchemaMappingRepository;
import com.luminai.connection.util.ConnectionFileParser;
import com.luminai.graph.repository.Neo4jGraphRepository;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Service;

/**
 * Service managing persistence of resolved Golden Records to PostgreSQL, Explorer cache
 * invalidation, and asynchronous synchronization to the Neo4j knowledge graph.
 */
@Service
public class GoldenRecordPersistenceService {

  private static final Logger log = LoggerFactory.getLogger(GoldenRecordPersistenceService.class);
  private static final int PERSIST_CHUNK_SIZE = 200;
  private static final int MAX_PROVENANCE_FIELDS_PER_RECORD = 25;
  private static final Set<String> EXCLUDED_PROPERTY_KEYS =
      Set.of(
          "id",
          "golden_id",
          "tenant_id",
          "canonicalName",
          "canonical_name",
          "entityType",
          "entity_type",
          "confidenceScore",
          "confidence_score",
          "sourceCount",
          "source_count",
          "cluster_size",
          "version",
          "created_at",
          "updated_at",
          "source_record_ids",
          "attributes",
          "_field_provenance",
          "_conflicts",
          "_validationErrors",
          "_validationWarnings");

  private final GoldenRecordRepository goldenRecordRepository;
  private final ConnectionRepository connectionRepository;
  private final ObjectMapper objectMapper;

  @Autowired(required = false)
  private SchemaMappingRepository schemaMappingRepository;

  @Autowired(required = false)
  private CacheManager cacheManager;

  @Autowired(required = false)
  private Neo4jGraphRepository neo4jGraphRepository;

  @Autowired
  public GoldenRecordPersistenceService(
      GoldenRecordRepository goldenRecordRepository,
      ConnectionRepository connectionRepository,
      ObjectMapper objectMapper) {
    this.goldenRecordRepository = goldenRecordRepository;
    this.connectionRepository = connectionRepository;
    this.objectMapper = objectMapper;
  }

  public void setNeo4jGraphRepository(Neo4jGraphRepository repo) {
    this.neo4jGraphRepository = repo;
  }

  public void setSchemaMappingRepository(SchemaMappingRepository schemaMappingRepository) {
    this.schemaMappingRepository = schemaMappingRepository;
  }

  public void setCacheManager(CacheManager cacheManager) {
    this.cacheManager = cacheManager;
  }

  public void persistGoldenRecords(
      UUID id, UUID currentTenant, List<Map<String, Object>> cleanRows) {
    syncGoldenRecords(id, currentTenant, null, null, cleanRows, false);
  }

  /**
   * Resolves and persists cleaned or ER-merged records for a connection as tenant-scoped {@link
   * GoldenRecord} entities, populating deterministic source lineage, clearing Explorer caches, and
   * triggering Neo4j sync.
   *
   * @return number of golden records persisted
   */
  public int syncGoldenRecords(
      UUID connectionId,
      UUID currentTenant,
      String sourceNameHint,
      String entityTypeHint,
      List<Map<String, Object>> rows,
      boolean replaceExisting) {
    if (goldenRecordRepository == null || currentTenant == null || rows == null || rows.isEmpty()) {
      return 0;
    }

    try {
      Optional<Connection> connOpt =
          (connectionRepository != null && connectionId != null)
              ? connectionRepository.findByIdAndTenantId(connectionId, currentTenant)
              : Optional.empty();

      Connection conn = connOpt.orElse(null);
      String resolvedSourceName = resolveSourceName(conn, sourceNameHint);
      String configuredEntityType =
          resolveConfiguredEntityType(conn, connectionId, currentTenant, entityTypeHint);

      if (!replaceExisting) {
        boolean flagPersisted = isGoldenRecordsFlagged(conn);
        boolean dbHasRecords =
            connectionId != null && hasExistingConnectionRecords(currentTenant, connectionId);
        if (flagPersisted && dbHasRecords) {
          return 0;
        }
        // Recover from stale config flag when golden_records actually has no rows for this
        // connection
        if (flagPersisted && connectionId != null && !dbHasRecords) {
          log.info(
              "Connection '{}' flagged goldenRecordsPersisted=true but has no live golden_records rows; persisting {} records",
              connectionId,
              rows.size());
        }
      } else if (connectionId != null) {
        deleteExistingConnectionRecords(currentTenant, connectionId);
      }

      List<GoldenRecord> savedAll = new ArrayList<>(rows.size());
      Instant now = Instant.now();

      for (int start = 0; start < rows.size(); start += PERSIST_CHUNK_SIZE) {
        int end = Math.min(start + PERSIST_CHUNK_SIZE, rows.size());
        List<GoldenRecord> chunk = new ArrayList<>(end - start);

        for (int i = start; i < end; i++) {
          Map<String, Object> rawRow = rows.get(i);
          if (rawRow == null || rawRow.isEmpty()) {
            continue;
          }
          chunk.add(
              buildGoldenRecord(
                  rawRow,
                  i,
                  connectionId,
                  currentTenant,
                  resolvedSourceName,
                  configuredEntityType,
                  now));
        }

        if (!chunk.isEmpty()) {
          List<GoldenRecord> savedChunk = goldenRecordRepository.saveAll(chunk);
          if (savedChunk != null) {
            savedAll.addAll(savedChunk);
          }
        }
      }

      if (savedAll.isEmpty()) {
        return 0;
      }

      markConnectionPersisted(conn, configuredEntityType);
      evictTenantExplorerCaches(currentTenant);

      final UUID tenantForAsync = currentTenant;
      final String tenantSlug = TenantContext.getTenantSlug();
      CompletableFuture.runAsync(
          () -> {
            try {
              if (tenantForAsync != null && tenantSlug != null && !tenantSlug.isBlank()) {
                TenantContext.setTenant(tenantForAsync, tenantSlug);
              }
              for (GoldenRecord saved : savedAll) {
                syncNodeToNeo4j(
                    tenantForAsync, saved.getId(), saved.getCanonicalName(), saved.getEntityType());
              }
            } catch (Exception asyncEx) {
              log.debug("Async Neo4j sync notice: {}", asyncEx.getMessage());
            } finally {
              TenantContext.clear();
            }
          });

      log.info(
          "Persisted {} golden records for connection '{}' (source='{}', tenant={})",
          savedAll.size(),
          connectionId,
          resolvedSourceName,
          currentTenant);
      return savedAll.size();
    } catch (Exception e) {
      log.warn(
          "Failed persisting golden records for connection '{}' (tenant={}): {}",
          connectionId,
          currentTenant,
          e.getMessage(),
          e);
      return 0;
    }
  }

  /**
   * Resolves target entity type for a connection from explicit hint, connection config, or saved
   * schema mappings.
   */
  public String resolveConfiguredEntityType(
      Connection conn, UUID connectionId, UUID tenantId, String explicitHint) {
    if (isMeaningfulEntityType(explicitHint)) {
      return explicitHint.trim();
    }
    if (conn != null && conn.getConfig() != null && !conn.getConfig().isBlank()) {
      try {
        JsonNode root = objectMapper.readTree(conn.getConfig());
        for (String key : List.of("targetEntityType", "entityType")) {
          if (root.has(key)) {
            String candidate = root.get(key).asText("");
            if (isMeaningfulEntityType(candidate)) {
              return candidate.trim();
            }
          }
        }
      } catch (Exception ignored) {
      }
    }
    if (schemaMappingRepository != null && connectionId != null && tenantId != null) {
      try {
        List<SchemaMapping> mappings =
            schemaMappingRepository.findAllByConnectorIdAndTenantId(connectionId, tenantId);
        if (mappings != null) {
          for (SchemaMapping mapping : mappings) {
            if (mapping.isActive() && isMeaningfulEntityType(mapping.getTargetEntityType())) {
              return mapping.getTargetEntityType().trim();
            }
          }
        }
      } catch (Exception ignored) {
      }
    }
    return null;
  }

  private GoldenRecord buildGoldenRecord(
      Map<String, Object> row,
      int rowIndex,
      UUID connectionId,
      UUID tenantId,
      String sourceName,
      String configuredEntityType,
      Instant now) {
    Map<String, Object> flatAttrs = extractAttributes(row);

    String rowEntityType = firstNonBlank(row.get("entityType"), row.get("entity_type"));
    String resolvedEntityType;
    if (isMeaningfulEntityType(configuredEntityType)) {
      resolvedEntityType = configuredEntityType;
    } else if (isMeaningfulEntityType(rowEntityType)) {
      resolvedEntityType = rowEntityType;
    } else {
      resolvedEntityType = ConnectionFileParser.inferEntityType(flatAttrs, configuredEntityType);
    }

    String rawCanonical = firstNonBlank(row.get("canonicalName"), row.get("canonical_name"));
    String rawIdStr = firstNonBlank(row.get("id"), row.get("record_id"), row.get("raw_id"));
    String canonicalName;
    if (rawCanonical != null
        && !"null".equalsIgnoreCase(rawCanonical)
        && !"Unnamed Entity".equalsIgnoreCase(rawCanonical)
        && !(rawIdStr != null
            && rawCanonical.equals(rawIdStr)
            && rawCanonical.startsWith("rec-"))) {
      canonicalName = rawCanonical;
    } else {
      canonicalName = ConnectionFileParser.extractRowName(flatAttrs, resolvedEntityType);
    }

    double cScore = 1.0;
    Object rawScore =
        row.get("confidenceScore") != null
            ? row.get("confidenceScore")
            : row.get("confidence_score");
    if (rawScore instanceof Number n) {
      cScore = n.doubleValue();
    }

    int sCount = 1;
    Object rawSourceCount =
        row.get("sourceCount") != null
            ? row.get("sourceCount")
            : row.get("cluster_size") != null ? row.get("cluster_size") : row.get("source_count");
    if (rawSourceCount instanceof Number n) {
      sCount = Math.max(1, n.intValue());
    }

    GoldenRecord gr = GoldenRecord.newStandalone();
    gr.setTenantId(tenantId);
    gr.setCanonicalName(canonicalName);
    gr.setEntityType(resolvedEntityType);
    gr.setConfidenceScore(BigDecimal.valueOf(cScore));
    gr.setSourceCount(sCount);

    Map<String, Object> props = new LinkedHashMap<>();
    for (Map.Entry<String, Object> entry : flatAttrs.entrySet()) {
      String key = entry.getKey();
      if (key == null || EXCLUDED_PROPERTY_KEYS.contains(key) || key.startsWith("_")) {
        continue;
      }
      props.put(key, entry.getValue());
    }

    if (connectionId != null) {
      props.put("_connection_id", connectionId.toString());
    }
    props.put("_sync_persisted", true);
    if (sourceName != null && !sourceName.isBlank()) {
      props.put("_source_name", sourceName);
      props.put("_source_systems", List.of(sourceName));
    }
    if (row.get("qualityState") != null) {
      props.put("_quality_state", String.valueOf(row.get("qualityState")));
    } else if (row.get("quality_state") != null) {
      props.put("_quality_state", String.valueOf(row.get("quality_state")));
    }
    if (row.get("qualityScore") instanceof Number qn) {
      props.put("_quality_score", qn.doubleValue());
    } else if (row.get("quality_score") instanceof Number qn) {
      props.put("_quality_score", qn.doubleValue());
    }
    gr.getProperties().putAll(props);

    UUID primarySourceRecordUuid = populateSourceIds(gr, row, connectionId, rowIndex, rawIdStr);
    String action = row.containsKey("attributes") || sCount > 1 ? "ENTITY_RESOLUTION" : "INGESTED";
    int provAdded = 0;
    for (Map.Entry<String, Object> entry : props.entrySet()) {
      String key = entry.getKey();
      if (key.startsWith("_") || entry.getValue() == null) {
        continue;
      }
      gr.getProvenance().add(new ProvenanceEntry(primarySourceRecordUuid, key, null, now, action));
      provAdded++;
      if (provAdded >= MAX_PROVENANCE_FIELDS_PER_RECORD) {
        break;
      }
    }

    return gr;
  }

  private Map<String, Object> extractAttributes(Map<String, Object> row) {
    if (row.get("attributes") instanceof Map<?, ?> attrMap && !attrMap.isEmpty()) {
      Map<String, Object> flattened = new LinkedHashMap<>();
      for (Map.Entry<?, ?> entry : attrMap.entrySet()) {
        if (entry.getKey() != null) {
          flattened.put(String.valueOf(entry.getKey()), entry.getValue());
        }
      }
      return flattened;
    }
    return new LinkedHashMap<>(row);
  }

  private UUID populateSourceIds(
      GoldenRecord gr, Map<String, Object> row, UUID connectionId, int rowIndex, String rawIdStr) {
    UUID firstUuid = null;
    if (row.get("source_record_ids") instanceof Collection<?> srcIds) {
      for (Object rawSid : srcIds) {
        if (rawSid == null) continue;
        UUID parsed = coerceUuid(connectionId, String.valueOf(rawSid), rowIndex);
        if (firstUuid == null) firstUuid = parsed;
        gr.getSourceRecordIds().add(parsed);
      }
    }
    if (firstUuid == null) {
      String seed = rawIdStr != null ? rawIdStr : ("row-" + rowIndex);
      firstUuid = coerceUuid(connectionId, seed, rowIndex);
      gr.getSourceRecordIds().add(firstUuid);
    }
    return firstUuid;
  }

  private UUID coerceUuid(UUID connectionId, String seed, int rowIndex) {
    if (seed != null && !seed.isBlank()) {
      try {
        return UUID.fromString(seed.trim());
      } catch (IllegalArgumentException ignored) {
      }
    }
    String key =
        (connectionId != null ? connectionId.toString() : "standalone")
            + ":"
            + rowIndex
            + ":"
            + (seed != null ? seed : "");
    return UUID.nameUUIDFromBytes(key.getBytes(StandardCharsets.UTF_8));
  }

  private String resolveSourceName(Connection conn, String explicitSourceName) {
    if (explicitSourceName != null && !explicitSourceName.isBlank()) {
      return explicitSourceName.trim();
    }
    if (conn != null) {
      if (conn.getConfig() != null && !conn.getConfig().isBlank()) {
        try {
          JsonNode root = objectMapper.readTree(conn.getConfig());
          if (root.has("fileName") && !root.get("fileName").asText().isBlank()) {
            return root.get("fileName").asText().trim();
          }
        } catch (Exception ignored) {
        }
      }
      if (conn.getName() != null && !conn.getName().isBlank()) {
        return conn.getName().trim();
      }
    }
    return null;
  }

  private boolean isGoldenRecordsFlagged(Connection conn) {
    if (conn == null || conn.getConfig() == null || conn.getConfig().isBlank()) {
      return false;
    }
    try {
      JsonNode conf = objectMapper.readTree(conn.getConfig());
      return conf.has("goldenRecordsPersisted") && conf.get("goldenRecordsPersisted").asBoolean();
    } catch (Exception ignored) {
      return false;
    }
  }

  private boolean hasExistingConnectionRecords(UUID tenantId, UUID connectionId) {
    try {
      List<GoldenRecord> existing =
          goldenRecordRepository.findByTenantIdAndConnectionId(tenantId, connectionId.toString());
      return existing != null && !existing.isEmpty();
    } catch (Exception e) {
      return false;
    }
  }

  private void deleteExistingConnectionRecords(UUID tenantId, UUID connectionId) {
    try {
      int deleted =
          goldenRecordRepository.deleteByTenantIdAndConnectionId(tenantId, connectionId.toString());
      if (deleted > 0) {
        log.info(
            "Replaced {} prior golden records for connection '{}' (tenant={})",
            deleted,
            connectionId,
            tenantId);
      }
    } catch (Exception e) {
      log.debug(
          "Native connection record cleanup skipped for '{}': {}", connectionId, e.getMessage());
    }
  }

  private void markConnectionPersisted(Connection conn, String configuredEntityType) {
    if (conn == null || connectionRepository == null) {
      return;
    }
    try {
      Map<String, Object> confMap = new LinkedHashMap<>();
      if (conn.getConfig() != null && !conn.getConfig().isBlank()) {
        @SuppressWarnings("unchecked")
        Map<String, Object> existing = objectMapper.readValue(conn.getConfig(), Map.class);
        confMap.putAll(existing);
      }
      confMap.put("goldenRecordsPersisted", true);
      if (isMeaningfulEntityType(configuredEntityType)
          && !confMap.containsKey("targetEntityType")) {
        confMap.put("targetEntityType", configuredEntityType);
      }
      conn.setConfig(objectMapper.writeValueAsString(confMap));
      connectionRepository.save(conn);
    } catch (Exception e) {
      log.debug("Failed updating connection persisted metadata: {}", e.getMessage());
    }
  }

  public void evictTenantExplorerCaches(UUID tenantId) {
    if (cacheManager == null) {
      return;
    }
    for (String cacheName :
        List.of(
            CacheConfig.CACHE_EXPLORER_SEARCH,
            CacheConfig.CACHE_EXPLORER_ENTITIES,
            CacheConfig.CACHE_DASHBOARD)) {
      try {
        Cache cache = cacheManager.getCache(cacheName);
        if (cache != null) {
          cache.clear();
        }
      } catch (Exception e) {
        log.debug("Cache eviction skipped for '{}': {}", cacheName, e.getMessage());
      }
    }
  }

  private static boolean isMeaningfulEntityType(String val) {
    return val != null
        && !val.isBlank()
        && !"null".equalsIgnoreCase(val.trim())
        && !"Entity".equalsIgnoreCase(val.trim());
  }

  private static String firstNonBlank(Object... candidates) {
    if (candidates == null) return null;
    for (Object c : candidates) {
      if (c != null) {
        String s = String.valueOf(c).trim();
        if (!s.isEmpty() && !"null".equalsIgnoreCase(s)) {
          return s;
        }
      }
    }
    return null;
  }

  public void syncNodeToNeo4j(
      UUID tenantId, UUID goldenId, String canonicalName, String entityType) {
    if (neo4jGraphRepository == null || goldenId == null) return;
    try {
      String slug = TenantContext.getTenantSlug();
      String primaryTenant = (slug != null && !slug.isBlank()) ? slug : tenantId.toString();
      neo4jGraphRepository.mergeEntityNode(
          primaryTenant, goldenId.toString(), canonicalName, entityType);
    } catch (Exception e) {
      log.debug("Direct Neo4j node sync skipped: {}", e.getMessage());
    }
  }
}
