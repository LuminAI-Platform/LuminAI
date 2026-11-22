package com.luminai.dataset.service;

import com.luminai.common.tenant.TenantContext;
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

  public SqlQueryResultDto executeQuery(SqlQueryRequest req) {
    requireTenant();
    String query = req.query().trim();

    // Security check: Enforce read-only SELECT queries
    String cleanUpper = query.toUpperCase();
    if (!cleanUpper.startsWith("SELECT") && !cleanUpper.startsWith("WITH")) {
      throw new IllegalArgumentException(
          "Only read-only SELECT and WITH analytical queries are permitted.");
    }
    if (cleanUpper.contains("DROP ")
        || cleanUpper.contains("DELETE ")
        || cleanUpper.contains("UPDATE ")
        || cleanUpper.contains("INSERT ")
        || cleanUpper.contains("TRUNCATE ")
        || cleanUpper.contains("ALTER ")) {
      throw new IllegalArgumentException("Destructive DDL/DML statements are strictly prohibited.");
    }

    int limit = req.limit() > 0 && req.limit() <= 1000 ? req.limit() : 100;
    String boundedQuery = query;
    if (!cleanUpper.contains("LIMIT")) {
      boundedQuery = query + " LIMIT " + limit;
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
            try {
              // Set tenant-specific search_path for schema isolation
              try (Statement setStmt = conn.createStatement()) {
                setStmt.execute("SET search_path = \"" + targetSchema + "\", public");
              }

              try (Statement queryStmt = conn.createStatement();
                  ResultSet rs = queryStmt.executeQuery(sqlToRun)) {
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
            } finally {
              // Always restore connection search_path before returning to pool
              try (Statement resetStmt = conn.createStatement()) {
                resetStmt.execute(
                    "SET search_path = \"" + TenantContext.DEFAULT_SCHEMA + "\", public");
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
}
