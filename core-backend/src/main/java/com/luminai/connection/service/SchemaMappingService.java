package com.luminai.connection.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.luminai.common.exception.ResourceNotFoundException;
import com.luminai.common.security.JwtClaimsExtractor;
import com.luminai.config.CacheConfig;
import com.luminai.connection.dto.SchemaMappingDto;
import com.luminai.connection.model.SchemaMapping;
import com.luminai.connection.repository.ConnectionRepository;
import com.luminai.connection.repository.GoldenRecordRepository;
import com.luminai.connection.repository.SchemaMappingRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service layer for SchemaMapping CRUD operations.
 *
 * <p>Tenant isolation is enforced on every operation by extracting the tenant ID from the
 * authenticated JWT. A request from Tenant A can never read, update, or delete Tenant B's schema
 * mappings.
 */
@Service
public class SchemaMappingService {

  private static final Logger log = LoggerFactory.getLogger(SchemaMappingService.class);

  private final SchemaMappingRepository repository;
  private final ConnectionRepository connectionRepository;
  private final JwtClaimsExtractor claimsExtractor;

  @Autowired(required = false)
  private GoldenRecordRepository goldenRecordRepository;

  @Autowired(required = false)
  private ObjectMapper objectMapper;

  @Autowired(required = false)
  private CacheManager cacheManager;

  @Autowired(required = false)
  private GoldenRecordPersistenceService goldenRecordPersistenceService;

  @Autowired(required = false)
  public void setGoldenRecordRepository(GoldenRecordRepository goldenRecordRepository) {
    this.goldenRecordRepository = goldenRecordRepository;
  }

  @Autowired(required = false)
  public void setGoldenRecordPersistenceService(
      GoldenRecordPersistenceService goldenRecordPersistenceService) {
    this.goldenRecordPersistenceService = goldenRecordPersistenceService;
  }

  @Autowired(required = false)
  public void setObjectMapper(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  @Autowired(required = false)
  public void setCacheManager(CacheManager cacheManager) {
    this.cacheManager = cacheManager;
  }

  public SchemaMappingService(
      SchemaMappingRepository repository,
      ConnectionRepository connectionRepository,
      JwtClaimsExtractor claimsExtractor) {
    this.repository = repository;
    this.connectionRepository = connectionRepository;
    this.claimsExtractor = claimsExtractor;
  }

  /** Create a new schema mapping for the authenticated tenant. */
  @Transactional
  public SchemaMappingDto.Response create(SchemaMappingDto.CreateRequest request) {
    UUID tenantId = getCurrentTenantId();

    if (!connectionRepository.existsByIdAndTenantId(request.connectorId(), tenantId)) {
      log.warn(
          "Connector '{}' does not exist for tenant '{}' when creating schema mapping '{}'",
          request.connectorId(),
          tenantId,
          request.name());
      throw new ResourceNotFoundException("Connection", request.connectorId());
    }

    SchemaMapping mapping =
        new SchemaMapping(
            tenantId,
            request.connectorId(),
            request.name(),
            request.sourceColumn(),
            request.targetEntityType(),
            request.targetProperty(),
            request.transformation());

    SchemaMapping saved = repository.save(mapping);
    propagateTargetEntityType(tenantId, request.connectorId(), request.targetEntityType());
    log.info(
        "Created schema mapping '{}' (id={}) for tenant {}",
        saved.getName(),
        saved.getId(),
        tenantId);

    return SchemaMappingDto.Response.from(saved);
  }

  /**
   * Get a schema mapping by ID, scoped to the authenticated tenant.
   *
   * @throws ResourceNotFoundException if not found or belongs to another tenant
   */
  @Transactional(readOnly = true)
  public SchemaMappingDto.Response getById(UUID id) {
    UUID tenantId = getCurrentTenantId();

    SchemaMapping mapping =
        repository
            .findByIdAndTenantId(id, tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("SchemaMapping", id));

    return SchemaMappingDto.Response.from(mapping);
  }

  /** Get all schema mappings for the authenticated tenant. */
  @Transactional(readOnly = true)
  public List<SchemaMappingDto.Response> getAllForTenant() {
    UUID tenantId = getCurrentTenantId();

    return repository.findAllByTenantId(tenantId).stream()
        .map(SchemaMappingDto.Response::from)
        .toList();
  }

  /** Get all schema mappings for a specific connector, scoped to the authenticated tenant. */
  @Transactional(readOnly = true)
  public List<SchemaMappingDto.Response> getAllForConnector(UUID connectorId) {
    UUID tenantId = getCurrentTenantId();

    return repository.findAllByConnectorIdAndTenantId(connectorId, tenantId).stream()
        .map(SchemaMappingDto.Response::from)
        .toList();
  }

  /**
   * Update an existing schema mapping. Only non-null fields in the request are applied (partial
   * update).
   *
   * @throws ResourceNotFoundException if not found or belongs to another tenant
   */
  @Transactional
  public SchemaMappingDto.Response update(UUID id, SchemaMappingDto.UpdateRequest request) {
    UUID tenantId = getCurrentTenantId();

    SchemaMapping mapping =
        repository
            .findByIdAndTenantId(id, tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("SchemaMapping", id));

    // Apply partial updates — only overwrite if the field was provided
    if (request.name() != null) {
      mapping.setName(request.name());
    }
    if (request.sourceColumn() != null) {
      mapping.setSourceColumn(request.sourceColumn());
    }
    if (request.targetEntityType() != null) {
      mapping.setTargetEntityType(request.targetEntityType());
    }
    if (request.targetProperty() != null) {
      mapping.setTargetProperty(request.targetProperty());
    }
    if (request.transformation() != null) {
      mapping.setTransformation(request.transformation());
    }
    if (request.active() != null) {
      mapping.setActive(request.active());
    }

    SchemaMapping updated = repository.save(mapping);
    if (request.targetEntityType() != null) {
      propagateTargetEntityType(tenantId, updated.getConnectorId(), request.targetEntityType());
    }
    log.info(
        "Updated schema mapping '{}' (id={}) for tenant {}",
        updated.getName(),
        updated.getId(),
        tenantId);

    return SchemaMappingDto.Response.from(updated);
  }

  /**
   * Delete a schema mapping by ID, scoped to the authenticated tenant.
   *
   * @throws ResourceNotFoundException if not found or belongs to another tenant
   */
  @Transactional
  public void delete(UUID id) {
    UUID tenantId = getCurrentTenantId();

    long deleted = repository.deleteByIdAndTenantId(id, tenantId);
    if (deleted == 0) {
      throw new ResourceNotFoundException("SchemaMapping", id);
    }
    log.info("Deleted schema mapping (id={}) for tenant {}", id, tenantId);
  }

  @Transactional
  public SchemaMappingDto.BatchResponse saveBatch(SchemaMappingDto.BatchRequest request) {
    UUID tenantId = getCurrentTenantId();
    UUID connectorId = request.connectorId();

    if (connectorId != null) {
      repository.deleteAllByConnectorIdAndTenantId(connectorId, tenantId);
    }

    String resolvedBatchTarget = request.targetEntity();
    java.util.List<SchemaMappingDto.Response> savedList = new java.util.ArrayList<>();
    if (request.mappings() != null) {
      for (SchemaMappingDto.MappingItem item : request.mappings()) {
        String name =
            item.name() != null
                ? item.name()
                : (request.sourceTable() + " - " + item.sourceColumn());
        String targetEntity =
            item.targetEntityType() != null ? item.targetEntityType() : request.targetEntity();
        if ((resolvedBatchTarget == null || resolvedBatchTarget.isBlank())
            && targetEntity != null
            && !targetEntity.isBlank()) {
          resolvedBatchTarget = targetEntity;
        }
        SchemaMapping.Transformation trans =
            item.transformation() != null
                ? item.transformation()
                : SchemaMapping.Transformation.NONE;

        SchemaMapping mapping =
            new SchemaMapping(
                tenantId,
                connectorId != null ? connectorId : UUID.randomUUID(),
                name,
                item.sourceColumn(),
                targetEntity != null ? targetEntity : "Entity",
                item.targetProperty(),
                trans);
        SchemaMapping saved = repository.save(mapping);
        savedList.add(SchemaMappingDto.Response.from(saved));
      }
    }

    if (connectorId != null) {
      propagateConnectorMappingMetadata(
          tenantId, connectorId, resolvedBatchTarget, request.foreignKeys());
    }

    log.info(
        "Batch saved {} schema mappings for connector {} (tenant={})",
        savedList.size(),
        connectorId,
        tenantId);
    return new SchemaMappingDto.BatchResponse(
        savedList,
        request.foreignKeys() != null ? request.foreignKeys() : java.util.List.of(),
        savedList.size());
  }

  /** Reads persisted foreign-key graph link definitions stored on a connector's configuration. */
  @Transactional(readOnly = true)
  public List<SchemaMappingDto.ForeignKeyItem> getForeignKeysForConnector(UUID connectorId) {
    UUID tenantId = getCurrentTenantId();
    if (connectionRepository == null || connectorId == null) {
      return List.of();
    }
    return connectionRepository
        .findByIdAndTenantId(connectorId, tenantId)
        .map(conn -> parseForeignKeysFromConfig(conn.getConfig()))
        .orElse(List.of());
  }

  private void propagateTargetEntityType(UUID tenantId, UUID connectorId, String targetEntityType) {
    propagateConnectorMappingMetadata(tenantId, connectorId, targetEntityType, null);
  }

  private void propagateConnectorMappingMetadata(
      UUID tenantId,
      UUID connectorId,
      String targetEntityType,
      List<SchemaMappingDto.ForeignKeyItem> foreignKeys) {
    if (connectorId == null) {
      return;
    }
    String cleanType =
        targetEntityType != null
                && !targetEntityType.isBlank()
                && !"Entity".equalsIgnoreCase(targetEntityType.trim())
            ? targetEntityType.trim()
            : null;
    boolean hasForeignKeysUpdate = foreignKeys != null;

    if (cleanType == null && !hasForeignKeysUpdate) {
      return;
    }

    if (connectionRepository != null) {
      try {
        connectionRepository
            .findByIdAndTenantId(connectorId, tenantId)
            .ifPresent(
                conn -> {
                  try {
                    ObjectMapper mapper = objectMapper != null ? objectMapper : new ObjectMapper();
                    Map<String, Object> cfg = new LinkedHashMap<>();
                    if (conn.getConfig() != null && !conn.getConfig().isBlank()) {
                      @SuppressWarnings("unchecked")
                      Map<String, Object> parsed = mapper.readValue(conn.getConfig(), Map.class);
                      cfg.putAll(parsed);
                    }
                    boolean changed = false;
                    if (cleanType != null && !cleanType.equals(cfg.get("targetEntityType"))) {
                      cfg.put("targetEntityType", cleanType);
                      changed = true;
                    }
                    if (hasForeignKeysUpdate) {
                      cfg.put("foreignKeys", sanitizeForeignKeys(foreignKeys));
                      changed = true;
                    }
                    if (changed) {
                      conn.setConfig(mapper.writeValueAsString(cfg));
                      connectionRepository.save(conn);
                    }
                  } catch (Exception e) {
                    log.debug(
                        "Failed saving schema mapping metadata onto connection '{}': {}",
                        connectorId,
                        e.getMessage());
                  }
                });
      } catch (Exception ignored) {
      }
    }

    if (cleanType != null && goldenRecordRepository != null) {
      try {
        goldenRecordRepository.updateEntityTypeByConnectionId(
            tenantId, connectorId.toString(), cleanType);
      } catch (Exception e) {
        log.debug(
            "Skipping entityType backfill on golden records for '{}': {}",
            connectorId,
            e.getMessage());
      }
    }

    if (goldenRecordPersistenceService != null && (hasForeignKeysUpdate || cleanType != null)) {
      final UUID asyncTenant = tenantId;
      final UUID asyncConn = connectorId;
      final String tenantSlug = com.luminai.common.tenant.TenantContext.getTenantSlug();
      java.util.concurrent.CompletableFuture.runAsync(
          () -> {
            try {
              if (asyncTenant != null && tenantSlug != null && !tenantSlug.isBlank()) {
                com.luminai.common.tenant.TenantContext.setTenant(asyncTenant, tenantSlug);
              }
              goldenRecordPersistenceService.backfillExistingRecordsToNeo4j(asyncTenant, asyncConn);
            } catch (Exception e) {
              log.debug("Async Neo4j graph resync skipped: {}", e.getMessage());
            } finally {
              com.luminai.common.tenant.TenantContext.clear();
            }
          });
    }

    if (cacheManager != null) {
      for (String name :
          List.of(
              CacheConfig.CACHE_EXPLORER_SEARCH,
              CacheConfig.CACHE_EXPLORER_ENTITIES,
              CacheConfig.CACHE_CLEAN_PREVIEW,
              CacheConfig.CACHE_DASHBOARD)) {
        try {
          Cache cache = cacheManager.getCache(name);
          if (cache != null) cache.clear();
        } catch (Exception ignored) {
        }
      }
    }
  }

  private List<Map<String, Object>> sanitizeForeignKeys(
      List<SchemaMappingDto.ForeignKeyItem> foreignKeys) {
    if (foreignKeys == null || foreignKeys.isEmpty()) {
      return List.of();
    }
    List<Map<String, Object>> list = new java.util.ArrayList<>(foreignKeys.size());
    for (SchemaMappingDto.ForeignKeyItem fk : foreignKeys) {
      if (fk == null) continue;
      String colName =
          fk.columnName() != null && !fk.columnName().isBlank() ? fk.columnName().trim() : null;
      String colId =
          fk.columnId() != null && !fk.columnId().isBlank() ? fk.columnId().trim() : colName;
      if (colId == null && colName == null) continue;
      if (fk.targetEntityType() == null || fk.targetEntityType().isBlank()) continue;
      if (fk.relationshipType() == null || fk.relationshipType().isBlank()) continue;

      Map<String, Object> item = new LinkedHashMap<>();
      item.put("columnId", colId);
      item.put("columnName", colName != null ? colName : colId);
      item.put("targetEntityType", fk.targetEntityType().trim());
      item.put("relationshipType", fk.relationshipType().trim());
      item.put(
          "direction",
          fk.direction() != null && !fk.direction().isBlank()
              ? fk.direction().trim().toUpperCase()
              : "OUTGOING");
      list.add(item);
    }
    return list;
  }

  private List<SchemaMappingDto.ForeignKeyItem> parseForeignKeysFromConfig(String configJson) {
    if (configJson == null || configJson.isBlank()) {
      return List.of();
    }
    try {
      ObjectMapper mapper = objectMapper != null ? objectMapper : new ObjectMapper();
      com.fasterxml.jackson.databind.JsonNode root = mapper.readTree(configJson);
      if (!root.has("foreignKeys") || !root.get("foreignKeys").isArray()) {
        return List.of();
      }
      List<SchemaMappingDto.ForeignKeyItem> items = new java.util.ArrayList<>();
      for (com.fasterxml.jackson.databind.JsonNode node : root.get("foreignKeys")) {
        String colId = node.path("columnId").asText(null);
        String colName = node.path("columnName").asText(null);
        String targetType = node.path("targetEntityType").asText(null);
        String relType = node.path("relationshipType").asText(null);
        String direction = node.path("direction").asText("OUTGOING");
        if (targetType != null && !targetType.isBlank() && relType != null && !relType.isBlank()) {
          items.add(
              new SchemaMappingDto.ForeignKeyItem(colId, colName, targetType, relType, direction));
        }
      }
      return items;
    } catch (Exception e) {
      return List.of();
    }
  }

  // ----------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------

  private UUID getCurrentTenantId() {
    return UUID.fromString(claimsExtractor.getCurrentTenantId());
  }
}
