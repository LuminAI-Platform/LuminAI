package com.luminai.connection.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luminai.common.tenant.TenantContext;
import com.luminai.connection.model.Connection;
import com.luminai.connection.model.ErCandidate;
import com.luminai.connection.repository.ConnectionRepository;
import com.luminai.connection.repository.ErCandidateRepository;
import com.luminai.engine.service.DataEngineClient;
import java.util.*;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service for scanning active tenant datasets to discover entity resolution candidate pairs falling
 * within the human review similarity threshold [0.70, 0.90).
 */
@Service
public class CandidateScannerService {

  private static final Logger log = LoggerFactory.getLogger(CandidateScannerService.class);

  private final ErCandidateRepository candidateRepository;
  private final PairSimilarityMatcher similarityMatcher;

  @Autowired(required = false)
  private ConnectionRepository connectionRepository;

  @Autowired(required = false)
  private DataEngineClient dataEngineClient;

  @Autowired(required = false)
  private DataSource dataSource;

  @Autowired(required = false)
  private ObjectMapper objectMapper = new ObjectMapper();

  public CandidateScannerService(
      ErCandidateRepository candidateRepository, PairSimilarityMatcher similarityMatcher) {
    this.candidateRepository = candidateRepository;
    this.similarityMatcher = similarityMatcher;
  }

  @Transactional
  public Map<String, Object> scanCandidates() {
    UUID tenantUuid = TenantContext.getTenantUuid();
    String tenantSlug = TenantContext.getTenantSlug();
    if (tenantUuid == null || tenantSlug == null || tenantSlug.isBlank()) {
      log.warn("Candidate scan rejected: missing active tenant context");
      return Map.of(
          "status", "ERROR",
          "message", "Unauthorized: missing tenant context",
          "candidatesFound", 0);
    }

    try {
      String schemaName = "tenant_" + tenantSlug;
      ensureTableCompatibility(schemaName);

      if (dataEngineClient != null) {
        try {
          dataEngineClient.resolveEntities(
              Map.of("tenant_id", tenantSlug, "source_id", "connections"));
        } catch (Exception e) {
          log.debug("Remote Data Engine ER trigger skipped: {}", e.getMessage());
        }
      }

      List<Connection> connections =
          connectionRepository != null
              ? connectionRepository.findAllByTenantId(tenantUuid)
              : List.of();

      int generatedCount = 0;
      List<Map<String, Object>> candidatePool = new ArrayList<>();

      for (Connection conn : connections) {
        if (conn.getConfig() == null || conn.getConfig().isBlank()) {
          continue;
        }
        try {
          JsonNode root = objectMapper.readTree(conn.getConfig());
          String connName = conn.getName() != null ? conn.getName() : "Dataset";

          if (root.has("sampleRows") && root.get("sampleRows").isArray()) {
            for (JsonNode rowNode : root.get("sampleRows")) {
              @SuppressWarnings("unchecked")
              Map<String, Object> row = objectMapper.convertValue(rowNode, Map.class);
              if (row != null && !row.isEmpty()) {
                Map<String, Object> copy = new LinkedHashMap<>(row);
                copy.put("sourceSystem", connName);
                candidatePool.add(copy);
              }
            }
          }

          if (root.has("tables") && root.get("tables").isObject()) {
            Iterator<String> tableKeys = root.get("tables").fieldNames();
            while (tableKeys.hasNext()) {
              String tableName = tableKeys.next();
              JsonNode tableNode = root.get("tables").get(tableName);
              if (tableNode.has("sampleRows") && tableNode.get("sampleRows").isArray()) {
                for (JsonNode rowNode : tableNode.get("sampleRows")) {
                  @SuppressWarnings("unchecked")
                  Map<String, Object> row = objectMapper.convertValue(rowNode, Map.class);
                  if (row != null && !row.isEmpty()) {
                    Map<String, Object> copy = new LinkedHashMap<>(row);
                    copy.put("sourceSystem", connName + " [" + tableName + "]");
                    candidatePool.add(copy);
                  }
                }
              }
            }
          }
        } catch (Exception e) {
          log.warn("Error reading connection config during candidate scan: {}", e.getMessage());
        }
      }

      int poolSize = candidatePool.size();
      if (poolSize == 0) {
        return Map.of(
            "status", "SUCCESS",
            "message",
                "No records found in active connections to analyze. Upload a dataset to begin entity resolution.",
            "candidatesFound", 0);
      }

      for (int i = 0; i < poolSize && generatedCount < 50; i++) {
        Map<String, Object> rowA = candidatePool.get(i);
        String nameA = similarityMatcher.extractName(rowA);
        String emailA = similarityMatcher.extractString(rowA, "email");
        String phoneA = similarityMatcher.extractPhone(rowA);

        for (int j = i + 1; j < poolSize && generatedCount < 50; j++) {
          Map<String, Object> rowB = candidatePool.get(j);
          String nameB = similarityMatcher.extractName(rowB);
          String emailB = similarityMatcher.extractString(rowB, "email");
          String phoneB = similarityMatcher.extractPhone(rowB);

          double similarity =
              similarityMatcher.computeSimilarity(
                  nameA, nameB, emailA, emailB, phoneA, phoneB, rowA, rowB);
          if (similarity >= 0.70 && similarity < 0.90) {
            UUID recordAId = similarityMatcher.extractOrGenerateUuid(rowA, i);
            UUID recordBId = similarityMatcher.extractOrGenerateUuid(rowB, j);

            if (!candidateRepository.existsByRecordAIdAndRecordBId(recordAId, recordBId)) {
              String rationale = similarityMatcher.buildRationale(nameA, nameB, similarity);
              ErCandidate candidate = new ErCandidate(recordAId, recordBId, similarity, rationale);
              candidate.setTenantId(tenantUuid);
              candidate.setMatchMethod("JARO_WINKLER_LEVENSHTEIN");
              candidate.setRecordASnapshot(new LinkedHashMap<>(rowA));
              candidate.setRecordBSnapshot(new LinkedHashMap<>(rowB));
              candidate.setComparisonDetails(
                  Map.of(
                      "similarityScore",
                      similarity,
                      "matchedAlgorithm",
                      "JARO_WINKLER_LEVENSHTEIN",
                      "recordA_id",
                      recordAId.toString(),
                      "recordB_id",
                      recordBId.toString()));
              try {
                candidateRepository.saveAndFlush(candidate);
                generatedCount++;
              } catch (Exception se) {
                log.warn(
                    "Failed to persist candidate pair ({}, {}): {}",
                    recordAId,
                    recordBId,
                    se.getMessage());
              }
            }
          }
        }
      }

      String summaryMessage =
          generatedCount > 0
              ? String.format(
                  "Entity Resolution scan identified %d candidate duplicate pair(s) across %d records.",
                  generatedCount, poolSize)
              : String.format(
                  "Scan complete: 0 duplicate pairs detected across %d records in your active connections. All records appear distinct.",
                  poolSize);

      return Map.of(
          "status", "SUCCESS",
          "message", summaryMessage,
          "candidatesFound", generatedCount);
    } catch (Exception e) {
      log.error("Error during duplicate candidate scan: {}", e.getMessage(), e);
      return Map.of(
          "status",
          "ERROR",
          "message",
          "Candidate scan encountered an issue: " + e.getMessage(),
          "candidatesFound",
          0);
    }
  }

  private void ensureTableCompatibility(String schemaName) {
    if (dataSource == null) return;
    List<String> targetSchemas = new ArrayList<>();
    if (schemaName != null && !schemaName.isBlank()) targetSchemas.add(schemaName);
    targetSchemas.add("public");
    targetSchemas.add("tenant_template");
    try {
      String current = TenantContext.getCurrentSchema();
      if (current != null && !targetSchemas.contains(current)) targetSchemas.add(current);
    } catch (Exception ignored) {
    }

    try (java.sql.Connection conn = dataSource.getConnection();
        java.sql.Statement stmt = conn.createStatement()) {
      for (String target : targetSchemas) {
        String safe = target.replace("\"", "\"\"");
        String[] cols = {
          "record_a_snapshot TEXT",
          "record_b_snapshot TEXT",
          "match_rationale VARCHAR(2000) DEFAULT ''",
          "comparison_details TEXT",
          "updated_at TIMESTAMPTZ DEFAULT now()"
        };
        for (String col : cols) {
          try {
            stmt.execute(
                String.format(
                    "ALTER TABLE IF EXISTS \"%s\".er_candidates ADD COLUMN IF NOT EXISTS %s;",
                    safe, col));
          } catch (Exception ignored) {
          }
        }
        String[] notNullCols = {"pipeline_run_id", "match_method", "golden_record_id"};
        for (String col : notNullCols) {
          try {
            stmt.execute(
                String.format(
                    "ALTER TABLE IF EXISTS \"%s\".er_candidates ALTER COLUMN %s DROP NOT NULL;",
                    safe, col));
          } catch (Exception ignored) {
          }
        }
      }
    } catch (Exception e) {
      log.debug("Schema compatibility check skipped or already satisfied: {}", e.getMessage());
    }
  }
}
