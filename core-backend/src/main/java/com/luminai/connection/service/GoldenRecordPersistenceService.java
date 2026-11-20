package com.luminai.connection.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luminai.common.tenant.TenantContext;
import com.luminai.connection.model.Connection;
import com.luminai.connection.model.GoldenRecord;
import com.luminai.connection.repository.ConnectionRepository;
import com.luminai.connection.repository.GoldenRecordRepository;
import com.luminai.graph.repository.Neo4jGraphRepository;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Service managing persistence of resolved Golden Records to PostgreSQL and asynchronous
 * synchronization to the Neo4j knowledge graph.
 */
@Service
public class GoldenRecordPersistenceService {

  private static final Logger log = LoggerFactory.getLogger(GoldenRecordPersistenceService.class);

  private final GoldenRecordRepository goldenRecordRepository;
  private final ConnectionRepository connectionRepository;
  private final ObjectMapper objectMapper;

  @Autowired(required = false)
  private Neo4jGraphRepository neo4jGraphRepository;

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

  public void persistGoldenRecords(
      UUID id, UUID currentTenant, List<Map<String, Object>> cleanRows) {
    if (goldenRecordRepository == null) return;
    try {
      Optional<Connection> connOpt =
          connectionRepository != null
              ? connectionRepository.findByIdAndTenantId(id, currentTenant)
              : Optional.empty();

      boolean alreadyPersisted = false;
      if (connOpt.isPresent() && connOpt.get().getConfig() != null) {
        try {
          JsonNode conf = objectMapper.readTree(connOpt.get().getConfig());
          if (conf.has("goldenRecordsPersisted")
              && conf.get("goldenRecordsPersisted").asBoolean()) {
            alreadyPersisted = true;
          }
        } catch (Exception ignored) {
        }
      }

      if (!alreadyPersisted) {
        List<GoldenRecord> recordsToSave = new ArrayList<>();
        int maxToPersist = Math.min(cleanRows.size(), 50);
        for (int i = 0; i < maxToPersist; i++) {
          Map<String, Object> cRow = cleanRows.get(i);
          GoldenRecord gr = GoldenRecord.newStandalone();
          gr.setTenantId(currentTenant);
          gr.setCanonicalName(String.valueOf(cRow.get("canonicalName")));
          gr.setEntityType(String.valueOf(cRow.get("entityType")));

          double cScore = 1.0;
          if (cRow.get("confidenceScore") instanceof Number) {
            cScore = ((Number) cRow.get("confidenceScore")).doubleValue();
          }
          gr.setConfidenceScore(BigDecimal.valueOf(cScore));

          int sCount = 1;
          if (cRow.get("sourceCount") instanceof Number) {
            sCount = ((Number) cRow.get("sourceCount")).intValue();
          }
          gr.setSourceCount(sCount);

          Map<String, Object> props = new LinkedHashMap<>(cRow);
          props.remove("id");
          props.remove("canonicalName");
          props.remove("entityType");
          props.remove("confidenceScore");
          props.remove("sourceCount");
          props.remove("_validationErrors");
          props.remove("_validationWarnings");
          gr.getProperties().putAll(props);
          recordsToSave.add(gr);
        }

        List<GoldenRecord> savedList = goldenRecordRepository.saveAll(recordsToSave);

        if (connOpt.isPresent() && connectionRepository != null) {
          Connection conn = connOpt.get();
          try {
            Map<String, Object> confMap = new LinkedHashMap<>();
            if (conn.getConfig() != null && !conn.getConfig().isBlank()) {
              @SuppressWarnings("unchecked")
              Map<String, Object> existing = objectMapper.readValue(conn.getConfig(), Map.class);
              confMap.putAll(existing);
            }
            confMap.put("goldenRecordsPersisted", true);
            conn.setConfig(objectMapper.writeValueAsString(confMap));
            connectionRepository.save(conn);
          } catch (Exception ignored) {
          }
        }

        final UUID tenantForAsync = currentTenant;
        CompletableFuture.runAsync(
            () -> {
              try {
                for (GoldenRecord saved : savedList) {
                  syncNodeToNeo4j(
                      tenantForAsync,
                      saved.getId(),
                      saved.getCanonicalName(),
                      saved.getEntityType());
                }
              } catch (Exception asyncEx) {
                log.debug("Async Neo4j sync notice: {}", asyncEx.getMessage());
              }
            });

        log.info(
            "Persisted {} golden records for connection '{}' (tenant {})",
            savedList.size(),
            id,
            currentTenant);
      }
    } catch (Exception e) {
      log.debug("Auto-persistence notice: {}", e.getMessage());
    }
  }

  public void syncNodeToNeo4j(
      UUID tenantId, UUID goldenId, String canonicalName, String entityType) {
    if (neo4jGraphRepository == null) return;
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
