package com.luminai.dataset.service;

import com.luminai.common.exception.ResourceNotFoundException;
import com.luminai.common.tenant.TenantContext;
import com.luminai.dataset.dto.SavedQueryDto;
import com.luminai.dataset.dto.SqlColumnInfo;
import com.luminai.dataset.dto.SqlQueryRequest;
import com.luminai.dataset.dto.SqlQueryResultDto;
import com.luminai.dataset.model.Dataset;
import com.luminai.dataset.model.SavedQuery;
import com.luminai.dataset.repository.DatasetRepository;
import com.luminai.dataset.repository.SavedQueryRepository;
import com.luminai.engine.service.DataEngineClient;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.Statement;
import java.util.*;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SqlAnalyticsService {

  private static final Logger log = LoggerFactory.getLogger(SqlAnalyticsService.class);

  private final JdbcTemplate jdbcTemplate;
  private final SavedQueryRepository savedQueryRepository;
  private DatasetRepository datasetRepository;
  private DatasetService datasetService;
  private DataEngineClient dataEngineClient;

  public SqlAnalyticsService(DataSource dataSource, SavedQueryRepository savedQueryRepository) {
    this.jdbcTemplate = new JdbcTemplate(dataSource);
    this.savedQueryRepository = savedQueryRepository;
  }

  @Autowired(required = false)
  public void setDatasetRepository(DatasetRepository datasetRepository) {
    this.datasetRepository = datasetRepository;
  }

  @Autowired(required = false)
  public void setDatasetService(DatasetService datasetService) {
    this.datasetService = datasetService;
  }

  @Autowired(required = false)
  public void setDataEngineClient(DataEngineClient dataEngineClient) {
    this.dataEngineClient = dataEngineClient;
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
          "\\b(DROP|DELETE|UPDATE|INSERT|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|EXECUTE|COPY|INTO|PG_SLEEP|PG_READ_FILE|PG_READ_BINARY_FILE|PG_LS_DIR|PG_STAT_FILE|DBLINK|DBLINK_EXEC|LO_IMPORT|LO_EXPORT|SET_CONFIG|CURRENT_SETTING|QUERY_TO_XML|PG_TERMINATE_BACKEND|PG_CANCEL_BACKEND)\\b",
          java.util.regex.Pattern.CASE_INSENSITIVE);

  private static final java.util.regex.Pattern CROSS_SCHEMA_PATTERN =
      java.util.regex.Pattern.compile(
          "(?:\\b(PUBLIC|VAULT_CREDENTIALS|USERS|TENANTS|API_KEYS|FLYWAY_SCHEMA_HISTORY|INFORMATION_SCHEMA|PG_CATALOG|PG_TEMP|PG_TOAST|TENANT_[A-Z0-9_\\-]+)\\s*\\.|\"[^\"]+\"\\s*\\.|\\b(VAULT_CREDENTIALS|USERS|TENANTS|API_KEYS|FLYWAY_SCHEMA_HISTORY|PG_ROLES|PG_USER|PG_SHADOW|PG_AUTHID|PG_STAT_ACTIVITY)\\b)",
          java.util.regex.Pattern.CASE_INSENSITIVE);

  public SqlQueryResultDto executeQuery(SqlQueryRequest req) {
    UUID tenantId = requireTenant();
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

    int limit = req.limit() > 0 && req.limit() <= 5000 ? req.limit() : 500;
    if (req.datasetId() != null) {
      return executeDatasetDuckDbQuery(tenantId, req.datasetId(), cleanSql, limit);
    }

    if (CROSS_SCHEMA_PATTERN.matcher(cleanSql).find()) {
      throw new IllegalArgumentException(
          "Cross-schema references and queries targeting system/credential tables are prohibited.");
    }

    int pgLimit = req.limit() > 0 && req.limit() <= 1000 ? req.limit() : 100;
    String boundedQuery = cleanSql;
    if (!cleanUpper.contains("LIMIT")) {
      boundedQuery = cleanSql + " LIMIT " + pgLimit;
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

              // Set tenant-specific search_path for strict schema isolation
              try (Statement setStmt = conn.createStatement()) {
                setStmt.execute("SET search_path = \"" + targetSchema + "\"");
              }

              try (Statement queryStmt = conn.createStatement()) {
                queryStmt.setQueryTimeout(10); // 10 second execution guard
                try (ResultSet rs = queryStmt.executeQuery(sqlToRun)) {
                  ResultSetMetaData meta = rs.getMetaData();
                  int colCount = meta.getColumnCount();
                  List<SqlColumnInfo> columns = new ArrayList<>(colCount);
                  for (int i = 1; i <= colCount; i++) {
                    String rawType = meta.getColumnTypeName(i);
                    columns.add(
                        new SqlColumnInfo(
                            meta.getColumnLabel(i),
                            rawType != null ? rawType.toLowerCase() : "varchar"));
                  }

                  List<Map<String, Object>> rows = new ArrayList<>();
                  while (rs.next()) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    for (int i = 1; i <= colCount; i++) {
                      row.put(columns.get(i - 1).name(), rs.getObject(i));
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
      return new SqlQueryResultDto(
          List.<SqlColumnInfo>of(), List.of(), 0, elapsed, "ERROR: " + e.getMessage());
    }
  }

  @SuppressWarnings("unchecked")
  private SqlQueryResultDto executeDatasetDuckDbQuery(
      UUID tenantId, UUID datasetId, String cleanSql, int limit) {
    long start = System.currentTimeMillis();
    if (datasetRepository == null || dataEngineClient == null) {
      return new SqlQueryResultDto(
          List.of(), List.of(), 0, 0L, "ERROR: Dataset DuckDB analytics engine is unavailable.");
    }

    Dataset dataset =
        datasetRepository
            .findByIdAndTenantId(datasetId, tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("Dataset", datasetId));

    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("query", cleanSql);
    payload.put("tenant_id", tenantId.toString());
    payload.put("dataset_id", dataset.getId().toString());
    payload.put("limit", limit);

    String storageLoc = dataset.getStorageLocation();
    boolean hasTenantStorageKey =
        storageLoc != null && !storageLoc.isBlank() && storageLoc.startsWith(tenantId + "/");
    if (hasTenantStorageKey) {
      payload.put("storage_location", storageLoc);
    }

    // Bind inline records for DB-table datasets or when no direct MinIO storage object is present.
    if (!hasTenantStorageKey && datasetService != null) {
      List<Map<String, Object>> records = datasetService.loadDatasetRecords(dataset, 5000);
      if (records.isEmpty()) {
        long elapsed = System.currentTimeMillis() - start;
        return new SqlQueryResultDto(
            List.of(),
            List.of(),
            0,
            elapsed,
            "ERROR: No records found for dataset '" + dataset.getName() + "'");
      }
      Map<String, Object> tables = new LinkedHashMap<>();
      tables.put("dataset", records);
      String alias =
          dataset.getName() != null ? dataset.getName().replaceAll("[^a-zA-Z0-9_]", "_") : "";
      if (!alias.isBlank() && !alias.equals("dataset") && Character.isLetter(alias.charAt(0))) {
        tables.put(alias, records);
      }
      payload.put("tables", tables);
    }

    Map<String, Object> response = dataEngineClient.executeSqlQuery(payload);
    long elapsed = System.currentTimeMillis() - start;
    if (response == null || response.containsKey("error")) {
      String msg =
          response != null
              ? String.valueOf(response.get("error"))
              : "Empty response from Data Engine SQL executor";
      return new SqlQueryResultDto(List.of(), List.of(), 0, elapsed, "ERROR: " + msg);
    }

    List<SqlColumnInfo> columns = new ArrayList<>();
    if (response.get("columns") instanceof List<?> rawCols) {
      for (Object item : rawCols) {
        if (item instanceof Map<?, ?> m) {
          String colName = String.valueOf(m.get("name"));
          Object dtObj = m.containsKey("data_type") ? m.get("data_type") : m.get("dataType");
          String dt = dtObj != null ? String.valueOf(dtObj).toLowerCase() : "varchar";
          columns.add(new SqlColumnInfo(colName, dt));
        }
      }
    }

    List<Map<String, Object>> rows = new ArrayList<>();
    if (response.get("rows") instanceof List<?> rawRows) {
      for (Object r : rawRows) {
        if (r instanceof Map<?, ?> rm) {
          rows.add((Map<String, Object>) rm);
        }
      }
    }

    long totalRows = response.get("total_count") instanceof Number n ? n.longValue() : rows.size();
    long execMs = response.get("execution_time_ms") instanceof Number n ? n.longValue() : elapsed;
    return new SqlQueryResultDto(columns, rows, totalRows, execMs, "SUCCESS");
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
