package com.luminai.dataset.service;

import com.luminai.common.tenant.TenantContext;
import com.luminai.dataset.dto.SavedQueryDto;
import com.luminai.dataset.dto.SqlQueryRequest;
import com.luminai.dataset.dto.SqlQueryResultDto;
import com.luminai.dataset.model.SavedQuery;
import com.luminai.dataset.repository.SavedQueryRepository;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.Statement;
import java.util.*;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SqlAnalyticsService {

  private static final Logger log = LoggerFactory.getLogger(SqlAnalyticsService.class);

  private final JdbcTemplate jdbcTemplate;
  private final SavedQueryRepository savedQueryRepository;

  public SqlAnalyticsService(DataSource dataSource, SavedQueryRepository savedQueryRepository) {
    this.jdbcTemplate = new JdbcTemplate(dataSource);
    this.savedQueryRepository = savedQueryRepository;
  }

  private UUID requireTenant() {
    UUID tenantId = TenantContext.getTenantUuid();
    if (tenantId == null) {
      throw new AccessDeniedException("Unauthorized: missing tenant context");
    }
    return tenantId;
  }

  private static final java.util.regex.Pattern DISALLOWED_KEYWORDS =
      java.util.regex.Pattern.compile(
          "\\b(DROP|DELETE|UPDATE|INSERT|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|EXECUTE|COPY|INTO|PG_SLEEP|PG_READ_FILE)\\b",
          java.util.regex.Pattern.CASE_INSENSITIVE);

  private static final java.util.regex.Pattern CROSS_SCHEMA_PATTERN =
      java.util.regex.Pattern.compile(
          "\\b(PUBLIC|VAULT_CREDENTIALS|USERS|TENANTS|INFORMATION_SCHEMA|PG_CATALOG|TENANT_[A-Z0-9_\\-]+)\\.",
          java.util.regex.Pattern.CASE_INSENSITIVE);

  public SqlQueryResultDto executeQuery(SqlQueryRequest req) {
    requireTenant();
    String query = req.query().trim();

    // Disallow multi-statement injection
    String cleanSql = query.replaceAll(";+\\s*$", "").trim();
    if (cleanSql.contains(";")) {
      throw new IllegalArgumentException("Multi-statement SQL queries are strictly prohibited.");
    }

    // Security check: Enforce read-only SELECT/WITH queries
    String cleanUpper = cleanSql.toUpperCase();
    if (!cleanUpper.startsWith("SELECT") && !cleanUpper.startsWith("WITH")) {
      throw new IllegalArgumentException(
          "Only read-only SELECT and WITH analytical queries are permitted.");
    }

    if (DISALLOWED_KEYWORDS.matcher(cleanSql).find()) {
      throw new IllegalArgumentException(
          "Destructive DDL/DML or privileged operations are strictly prohibited.");
    }

    if (CROSS_SCHEMA_PATTERN.matcher(cleanSql).find()) {
      throw new IllegalArgumentException(
          "Cross-schema references and queries targeting system/credential tables are prohibited.");
    }

    int limit = req.limit() > 0 && req.limit() <= 1000 ? req.limit() : 100;
    String boundedQuery = cleanSql;
    if (!cleanUpper.contains("LIMIT")) {
      boundedQuery = cleanSql + " LIMIT " + limit;
    }

    final String sqlToRun = boundedQuery;
    String currentSchema = TenantContext.getCurrentSchema();
    if (currentSchema == null || !currentSchema.matches("^[a-zA-Z0-9_\\-]+$")) {
      currentSchema = TenantContext.DEFAULT_SCHEMA;
    }
    final String targetSchema = currentSchema;

    long start = System.currentTimeMillis();
    try {
      return jdbcTemplate.execute(
          (Connection conn) -> {
            boolean originalAutoCommit = conn.getAutoCommit();
            boolean originalReadOnly = conn.isReadOnly();
            try {
              conn.setReadOnly(true);

              // Set tenant-specific search_path for strict schema isolation (exclude public)
              try (Statement setStmt = conn.createStatement()) {
                setStmt.execute("SET search_path = \"" + targetSchema + "\"");
              }

              try (Statement queryStmt = conn.createStatement()) {
                queryStmt.setQueryTimeout(10); // 10 second execution guard
                try (ResultSet rs = queryStmt.executeQuery(sqlToRun)) {
                  ResultSetMetaData meta = rs.getMetaData();
                  int colCount = meta.getColumnCount();
                  List<String> columns = new ArrayList<>(colCount);
                  for (int i = 1; i <= colCount; i++) {
                    columns.add(meta.getColumnLabel(i));
                  }

                  List<Map<String, Object>> rows = new ArrayList<>();
                  while (rs.next()) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    for (int i = 1; i <= colCount; i++) {
                      row.put(columns.get(i - 1), rs.getObject(i));
                    }
                    rows.add(row);
                  }

                  long elapsed = System.currentTimeMillis() - start;
                  return new SqlQueryResultDto(columns, rows, rows.size(), elapsed, "SUCCESS");
                }
              }
            } finally {
              // Always restore connection state before returning to pool
              try {
                conn.setReadOnly(originalReadOnly);
                try (Statement resetStmt = conn.createStatement()) {
                  resetStmt.execute("SET search_path = \"" + TenantContext.DEFAULT_SCHEMA + "\"");
                }
              } catch (Exception e) {
                log.warn(
                    "Failed to restore search_path in SqlAnalyticsService; aborting connection to prevent reuse: {}",
                    e.getMessage());
                try {
                  conn.abort(Runnable::run);
                } catch (Exception ignored) {
                }
              }
            }
          });
    } catch (Exception e) {
      long elapsed = System.currentTimeMillis() - start;
      log.warn("SQL execution error: {}", e.getMessage());
      return new SqlQueryResultDto(List.of(), List.of(), 0, elapsed, "ERROR: " + e.getMessage());
    }
  }

  @Transactional(readOnly = true)
  public List<SavedQuery> listSavedQueries(UUID datasetId) {
    UUID tenantId = requireTenant();
    if (datasetId != null) {
      return savedQueryRepository.findAllByTenantIdAndDatasetId(tenantId, datasetId);
    }
    return savedQueryRepository.findAllByTenantIdOrderByUpdatedAtDesc(tenantId);
  }

  @Transactional
  public SavedQuery saveQuery(
      String title, String description, String sql, UUID datasetId, String visualConfig) {
    UUID tenantId = requireTenant();
    SavedQuery sq = new SavedQuery();
    sq.setTenantId(tenantId);
    sq.setTitle(title);
    sq.setDescription(description);
    sq.setSqlQuery(sql);
    sq.setDatasetId(datasetId);
    if (visualConfig != null) sq.setVisualConfig(visualConfig);
    return savedQueryRepository.save(sq);
  }

  @Transactional
  public SavedQueryDto createSavedQuery(SavedQueryDto.UpsertRequest req) {
    UUID tenantId = requireTenant();
    SavedQuery sq = new SavedQuery();
    sq.setTenantId(tenantId);
    sq.setTitle(req.resolveTitle());
    sq.setDescription(req.description());
    sq.setSqlQuery(req.resolveSql());
    sq.setDatasetId(req.datasetId());
    sq.setVisualConfig(req.resolveConfig());
    SavedQuery saved = savedQueryRepository.save(sq);
    log.info("Saved query '{}' (id={}) for tenant {}", saved.getTitle(), saved.getId(), tenantId);
    return SavedQueryDto.fromEntity(saved);
  }

  @Transactional
  public SavedQueryDto updateSavedQuery(UUID id, SavedQueryDto.UpsertRequest req) {
    UUID tenantId = requireTenant();
    SavedQuery sq =
        savedQueryRepository
            .findByIdAndTenantId(id, tenantId)
            .orElseThrow(
                () -> new com.luminai.common.exception.ResourceNotFoundException("SavedQuery", id));

    if (req.name() != null || req.title() != null) {
      sq.setTitle(req.resolveTitle());
    }
    if (req.description() != null) {
      sq.setDescription(req.description());
    }
    if (req.sqlText() != null || req.sqlQuery() != null) {
      sq.setSqlQuery(req.resolveSql());
    }
    if (req.datasetId() != null) {
      sq.setDatasetId(req.datasetId());
    }
    if (req.chartConfig() != null || req.visualConfig() != null) {
      sq.setVisualConfig(req.resolveConfig());
    }

    SavedQuery updated = savedQueryRepository.save(sq);
    log.info("Updated saved query {} for tenant {}", id, tenantId);
    return SavedQueryDto.fromEntity(updated);
  }

  @Transactional
  public void deleteSavedQuery(UUID id) {
    UUID tenantId = requireTenant();
    savedQueryRepository.deleteByIdAndTenantId(id, tenantId);
    log.info("Deleted saved query {} for tenant {}", id, tenantId);
  }

  @Transactional(readOnly = true)
  public SavedQueryDto getSavedQuery(UUID id) {
    UUID tenantId = requireTenant();
    return savedQueryRepository
        .findByIdAndTenantId(id, tenantId)
        .map(SavedQueryDto::fromEntity)
        .orElseThrow(
            () -> new com.luminai.common.exception.ResourceNotFoundException("SavedQuery", id));
  }
}
