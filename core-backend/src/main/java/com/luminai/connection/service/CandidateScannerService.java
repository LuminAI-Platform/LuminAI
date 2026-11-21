package com.luminai.connection.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.luminai.common.tenant.TenantContext;
import com.luminai.connection.model.ErCandidate.CandidateStatus;
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
 * Service for scanning active tenant datasets to discover entity resolution candidate pairs
 * strictly through the Python Data Engine ER pipeline.
 */
@Service
public class CandidateScannerService {

  private static final Logger log = LoggerFactory.getLogger(CandidateScannerService.class);

  private final ErCandidateRepository candidateRepository;

  @Autowired(required = false)
  private ConnectionRepository connectionRepository;

  @Autowired(required = false)
  private DataEngineClient dataEngineClient;

  @Autowired(required = false)
  private DataSource dataSource;

  @Autowired(required = false)
  private ObjectMapper objectMapper = new ObjectMapper();

  public CandidateScannerService(ErCandidateRepository candidateRepository) {
    this(candidateRepository, null);
  }

  @Autowired
  public CandidateScannerService(
      ErCandidateRepository candidateRepository,
      @Autowired(required = false) DataEngineClient dataEngineClient) {
    this.candidateRepository = candidateRepository;
    this.dataEngineClient = dataEngineClient;
  }

  public void setDataEngineClient(DataEngineClient dataEngineClient) {
    this.dataEngineClient = dataEngineClient;
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

      if (dataEngineClient == null) {
        log.error("Data Engine client is null. Cannot perform ER candidate scan.");
        return Map.of(
            "status",
            "ERROR",
            "message",
            "Data Engine is offline or not configured. Candidate scanning must be processed by the Python Data Engine.",
            "candidatesFound",
            0);
      }

      Map<String, Object> erResult;
      try {
        erResult =
            dataEngineClient.resolveEntities(
                Map.of("tenant_id", tenantSlug, "source_id", "connections"));
      } catch (Exception e) {
        log.error("Failed to trigger entity resolution on Data Engine: {}", e.getMessage());
        return Map.of(
            "status",
            "ERROR",
            "message",
            "Data Engine ER service is unreachable: " + e.getMessage(),
            "candidatesFound",
            0);
      }

      if (erResult == null
          || "ERROR".equals(erResult.get("status"))
          || erResult.containsKey("error")) {
        String errMsg =
            erResult != null && erResult.get("error") != null
                ? String.valueOf(erResult.get("error"))
                : "Data Engine ER service returned an error.";
        return Map.of(
            "status",
            "ERROR",
            "message",
            "Data Engine ER service failed: " + errMsg,
            "candidatesFound",
            0);
      }

      long pendingCount =
          candidateRepository != null
              ? candidateRepository.countByStatus(CandidateStatus.PENDING)
              : 0;

      String summaryMessage =
          pendingCount > 0
              ? String.format(
                  "Data Engine ER scan complete: %d candidate duplicate pair(s) pending review.",
                  pendingCount)
              : "Data Engine ER scan complete: 0 duplicate pairs detected. All records appear distinct.";

      return Map.of(
          "status", "SUCCESS",
          "message", summaryMessage,
          "candidatesFound", pendingCount);
    } catch (Exception e) {
      log.error("Error during candidate scan: {}", e.getMessage(), e);
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
