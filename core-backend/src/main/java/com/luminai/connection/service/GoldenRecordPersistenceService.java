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
      final Connection connForAsync = conn;
      final List<Map<String, Object>> sourceRowsForAsync = new ArrayList<>(rows);
      CompletableFuture.runAsync(
          () -> {
            try {
              if (tenantForAsync != null && tenantSlug != null && !tenantSlug.isBlank()) {
                TenantContext.setTenant(tenantForAsync, tenantSlug);
              }
              syncRecordsAndRelationshipsToNeo4j(
                  tenantForAsync, tenantSlug, connForAsync, savedAll, sourceRowsForAsync);
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
      neo4jGraphRepository.ensureEntityTypeIndexes(entityType);
      neo4jGraphRepository.mergeEntityNode(
          primaryTenant, goldenId.toString(), canonicalName, entityType);
    } catch (Exception e) {
      log.debug("Direct Neo4j node sync skipped: {}", e.getMessage());
    }
  }

  /**
   * Synchronizes existing PostgreSQL golden records (and any schema-configured foreign-key links)
   * into Neo4j in batches.
   */
  public Map<String, Object> backfillExistingRecordsToNeo4j(
      UUID tenantId, UUID connectionIdOrNull) {
    if (neo4jGraphRepository == null || goldenRecordRepository == null || tenantId == null) {
      return Map.of("status", "SKIPPED", "nodesSynced", 0, "edgesSynced", 0);
    }
    String slug = TenantContext.getTenantSlug();
    String primaryTenant = (slug != null && !slug.isBlank()) ? slug : tenantId.toString();

    Connection conn = null;
    if (connectionIdOrNull != null && connectionRepository != null) {
      conn = connectionRepository.findByIdAndTenantId(connectionIdOrNull, tenantId).orElse(null);
    }

    List<GoldenRecord> records =
        connectionIdOrNull != null
            ? goldenRecordRepository.findByTenantIdAndConnectionId(
                tenantId, connectionIdOrNull.toString())
            : goldenRecordRepository.findAll();

    if (records == null || records.isEmpty()) {
      return Map.of("status", "COMPLETED", "nodesSynced", 0, "edgesSynced", 0);
    }

    Map<UUID, Connection> connectionCache = new LinkedHashMap<>();
    if (conn != null) {
      connectionCache.put(conn.getId(), conn);
    }
    int[] counts = syncWithConnections(tenantId, primaryTenant, records, null, connectionCache);
    return Map.of(
        "status",
        "COMPLETED",
        "tenantId",
        primaryTenant,
        "nodesSynced",
        counts[0],
        "edgesSynced",
        counts[1]);
  }

  private void syncRecordsAndRelationshipsToNeo4j(
      UUID tenantId,
      String tenantSlug,
      Connection conn,
      List<GoldenRecord> savedRecords,
      List<Map<String, Object>> sourceRows) {
    if (neo4jGraphRepository == null || savedRecords == null || savedRecords.isEmpty()) {
      return;
    }
    String primaryTenant =
        (tenantSlug != null && !tenantSlug.isBlank())
            ? tenantSlug
            : (tenantId != null ? tenantId.toString() : "default");
    Map<UUID, Connection> connectionCache = new LinkedHashMap<>();
    if (conn != null && conn.getId() != null) {
      connectionCache.put(conn.getId(), conn);
    }
    syncWithConnections(tenantId, primaryTenant, savedRecords, sourceRows, connectionCache);
  }

  private int[] syncWithConnections(
      UUID tenantId,
      String primaryTenant,
      List<GoldenRecord> records,
      List<Map<String, Object>> sourceRows,
      Map<UUID, Connection> connectionCache) {
    int nodesSynced = 0;
    int edgesSynced = 0;

    Set<String> seenTypes = new LinkedHashSet<>();
    List<Map<String, Object>> batchNodes = new ArrayList<>();
    Map<String, List<FkRule>> fkRulesByConn = new LinkedHashMap<>();
    Map<String, String> existingTargetLookup = buildTargetLookup(records);

    for (GoldenRecord rec : records) {
      if (rec == null || rec.getId() == null) continue;
      String entityType =
          rec.getEntityType() != null && !rec.getEntityType().isBlank()
              ? rec.getEntityType()
              : "Entity";
      if (seenTypes.add(entityType)) {
        neo4jGraphRepository.ensureEntityTypeIndexes(entityType);
      }

      Map<String, Object> cleanProps = extractPublicProperties(rec.getProperties());
      Map<String, Object> nodeItem = new LinkedHashMap<>();
      nodeItem.put("id", rec.getId().toString());
      nodeItem.put(
          "canonicalName",
          rec.getCanonicalName() != null ? rec.getCanonicalName() : rec.getId().toString());
      nodeItem.put("entityType", entityType);
      nodeItem.put("properties", cleanProps);
      batchNodes.add(nodeItem);
    }

    for (int i = 0; i < batchNodes.size(); i += PERSIST_CHUNK_SIZE) {
      int end = Math.min(i + PERSIST_CHUNK_SIZE, batchNodes.size());
      neo4jGraphRepository.mergeEntityNodesBatch(primaryTenant, batchNodes.subList(i, end));
      nodesSynced += (end - i);
    }

    List<Map<String, Object>> targetStubNodes = new ArrayList<>();
    List<EdgeSyncSpec> edgeSpecs = new ArrayList<>();
    Set<String> seenStubIds = new LinkedHashSet<>();

    for (int idx = 0; idx < records.size(); idx++) {
      GoldenRecord rec = records.get(idx);
      if (rec == null || rec.getId() == null) continue;
      String srcId = rec.getId().toString();
      Map<String, Object> recProps = rec.getProperties() != null ? rec.getProperties() : Map.of();

      Object rawConnId = recProps.get("_connection_id");
      if (rawConnId != null) {
        String connKey = String.valueOf(rawConnId);
        List<FkRule> fkRules =
            fkRulesByConn.computeIfAbsent(
                connKey, k -> loadForeignKeysForConnection(tenantId, k, connectionCache));
        for (FkRule fk : fkRules) {
          Object rawFkVal = resolveColumnValueCaseInsensitive(recProps, fk.columnName, fk.columnId);
          if (rawFkVal == null) continue;
          String fkVal = String.valueOf(rawFkVal).trim();
          if (fkVal.isEmpty() || "null".equalsIgnoreCase(fkVal)) continue;

          String lookupKey = fk.targetEntityType.toLowerCase() + ":" + fkVal.toLowerCase();
          String matchedExistingId = existingTargetLookup.get(lookupKey);
          String targetId =
              matchedExistingId != null
                  ? matchedExistingId
                  : UUID.nameUUIDFromBytes(
                          (primaryTenant + ":" + fk.targetEntityType + ":" + fkVal)
                              .getBytes(StandardCharsets.UTF_8))
                      .toString();
          if (targetId.equals(srcId)) continue;

          if (seenTypes.add(fk.targetEntityType)) {
            neo4jGraphRepository.ensureEntityTypeIndexes(fk.targetEntityType);
          }
          if (matchedExistingId == null && seenStubIds.add(targetId)) {
            Map<String, Object> targetNode = new LinkedHashMap<>();
            targetNode.put("id", targetId);
            targetNode.put("canonicalName", fkVal);
            targetNode.put("entityType", fk.targetEntityType);
            targetNode.put("properties", Map.of("key", fkVal));
            targetStubNodes.add(targetNode);
          }
          edgeSpecs.add(
              new EdgeSyncSpec(
                  srcId, targetId, sanitizeRelType(fk.relationshipType), fk.direction));
        }
      }

      if (sourceRows != null && idx < sourceRows.size()) {
        Map<String, Object> row = sourceRows.get(idx);
        if (row != null && row.get("relationships") instanceof List<?> rawRels) {
          for (Object rObj : rawRels) {
            if (!(rObj instanceof Map<?, ?> rMap)) continue;
            Object tRaw =
                rMap.get("target_id") != null ? rMap.get("target_id") : rMap.get("targetId");
            Object rTypeRaw = rMap.get("type");
            if (tRaw == null || rTypeRaw == null) continue;
            String targetId = Neo4jGraphRepository.normalizeEntityId(String.valueOf(tRaw));
            String relType = sanitizeRelType(String.valueOf(rTypeRaw));
            String dir =
                rMap.get("direction") != null ? String.valueOf(rMap.get("direction")) : "OUTGOING";
            Object tTypeRaw =
                rMap.get("target_type") != null ? rMap.get("target_type") : rMap.get("targetType");
            if (tTypeRaw != null) {
              String targetType = String.valueOf(tTypeRaw).trim();
              if (!targetType.isEmpty() && seenStubIds.add(targetId)) {
                if (seenTypes.add(targetType)) {
                  neo4jGraphRepository.ensureEntityTypeIndexes(targetType);
                }
                Map<String, Object> targetNode = new LinkedHashMap<>();
                targetNode.put("id", targetId);
                targetNode.put("canonicalName", targetId);
                targetNode.put("entityType", targetType);
                targetNode.put("properties", Map.of());
                targetStubNodes.add(targetNode);
              }
            }
            edgeSpecs.add(new EdgeSyncSpec(srcId, targetId, relType, dir));
          }
        }
      }
    }

    for (int i = 0; i < targetStubNodes.size(); i += PERSIST_CHUNK_SIZE) {
      int end = Math.min(i + PERSIST_CHUNK_SIZE, targetStubNodes.size());
      neo4jGraphRepository.mergeEntityNodesBatch(primaryTenant, targetStubNodes.subList(i, end));
      nodesSynced += (end - i);
    }

    for (EdgeSyncSpec spec : edgeSpecs) {
      if (Neo4jGraphRepository.isSafeRelationshipType(spec.relType)
          && neo4jGraphRepository.mergeRelationship(
              primaryTenant, spec.sourceId, spec.targetId, spec.relType, spec.direction)) {
        edgesSynced++;
      }
    }

    return new int[] {nodesSynced, edgesSynced};
  }

  private Map<String, Object> extractPublicProperties(Map<String, Object> raw) {
    Map<String, Object> clean = new LinkedHashMap<>();
    if (raw == null || raw.isEmpty()) {
      return clean;
    }
    for (Map.Entry<String, Object> entry : raw.entrySet()) {
      String k = entry.getKey();
      Object v = entry.getValue();
      if (k == null || k.isBlank() || k.startsWith("_") || v == null) continue;
      if (v instanceof String s) {
        if (!s.isBlank()) clean.put(k, s);
      } else if (v instanceof Number || v instanceof Boolean) {
        clean.put(k, v);
      }
    }
    return clean;
  }

  private List<FkRule> loadForeignKeysForConnection(
      UUID tenantId, String connIdStr, Map<UUID, Connection> connectionCache) {
    try {
      UUID cid = UUID.fromString(connIdStr);
      Connection conn = connectionCache.get(cid);
      if (conn == null && connectionRepository != null && tenantId != null) {
        conn = connectionRepository.findByIdAndTenantId(cid, tenantId).orElse(null);
        if (conn != null) {
          connectionCache.put(cid, conn);
        }
      }
      if (conn == null || conn.getConfig() == null || conn.getConfig().isBlank()) {
        return List.of();
      }
      JsonNode root = objectMapper.readTree(conn.getConfig());
      if (!root.has("foreignKeys") || !root.get("foreignKeys").isArray()) {
        return List.of();
      }
      List<FkRule> rules = new ArrayList<>();
      for (JsonNode node : root.get("foreignKeys")) {
        String colId = node.path("columnId").asText("");
        String colName = node.path("columnName").asText("");
        String targetType = node.path("targetEntityType").asText("");
        String relType = node.path("relationshipType").asText("");
        String dir = node.path("direction").asText("OUTGOING");
        if (!targetType.isBlank()
            && !relType.isBlank()
            && (!colId.isBlank() || !colName.isBlank())) {
          rules.add(new FkRule(colId, colName, targetType.trim(), relType.trim(), dir.trim()));
        }
      }
      return rules;
    } catch (Exception e) {
      return List.of();
    }
  }

  private Object resolveColumnValueCaseInsensitive(
      Map<String, Object> props, String primaryKey, String secondaryKey) {
    for (String candidate : List.of(primaryKey, secondaryKey)) {
      if (candidate == null || candidate.isBlank()) continue;
      if (props.containsKey(candidate)) {
        return props.get(candidate);
      }
      for (Map.Entry<String, Object> entry : props.entrySet()) {
        if (entry.getKey() != null && entry.getKey().equalsIgnoreCase(candidate)) {
          return entry.getValue();
        }
      }
    }
    return null;
  }

  private Map<String, String> buildTargetLookup(List<GoldenRecord> records) {
    Map<String, String> lookup = new LinkedHashMap<>();
    if (records == null || records.isEmpty()) {
      return lookup;
    }
    for (GoldenRecord rec : records) {
      if (rec == null || rec.getId() == null) continue;
      String entityType =
          rec.getEntityType() != null && !rec.getEntityType().isBlank()
              ? rec.getEntityType().trim().toLowerCase()
              : "entity";
      String idStr = rec.getId().toString();
      lookup.putIfAbsent(entityType + ":" + idStr.toLowerCase(), idStr);
      if (rec.getCanonicalName() != null && !rec.getCanonicalName().isBlank()) {
        lookup.putIfAbsent(entityType + ":" + rec.getCanonicalName().trim().toLowerCase(), idStr);
      }
      Map<String, Object> props = rec.getProperties();
      if (props != null) {
        for (String key :
            List.of("id", "code", "external_id", entityType + "_id", entityType + "Id")) {
          Object val = props.get(key);
          if (val != null) {
            String vStr = String.valueOf(val).trim();
            if (!vStr.isEmpty()) {
              lookup.putIfAbsent(entityType + ":" + vStr.toLowerCase(), idStr);
            }
          }
        }
      }
    }
    return lookup;
  }

  private static String sanitizeRelType(String raw) {
    if (raw == null || raw.isBlank()) return "RELATED_TO";
    String clean = raw.trim().toUpperCase().replaceAll("[^A-Z0-9_]", "_");
    if (clean.isEmpty() || !Character.isLetter(clean.charAt(0))) {
      clean = "REL_" + clean;
    }
    return clean;
  }

  private record FkRule(
      String columnId,
      String columnName,
      String targetEntityType,
      String relationshipType,
      String direction) {}

  private record EdgeSyncSpec(String sourceId, String targetId, String relType, String direction) {}
}
