package com.luminai.connection.service;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Connector service for external PostgreSQL data sources.
 *
 * <p>Responsibilities:
 *
 * <ul>
 *   <li>Schema and table discovery from an external PostgreSQL database
 *   <li>Chunked cursor-based row extraction to avoid memory overload
 * </ul>
 *
 * <p>Database credentials are retrieved via {@link CredentialsVaultService}. Credentials must be
 * stored as a JSON string with the following structure:
 *
 * <pre>
 * {"host":"...","port":5432,"database":"...","username":"...","password":"..."}
 * </pre>
 */
@Service
public class PostgresConnectorService {

  private static final Logger log = LoggerFactory.getLogger(PostgresConnectorService.class);

  /** Number of rows fetched per cursor batch during extraction. */
  private static final int CHUNK_SIZE = 1000;

  private final CredentialsVaultService credentialsVaultService;

  public PostgresConnectorService(CredentialsVaultService credentialsVaultService) {
    this.credentialsVaultService = credentialsVaultService;
  }

  // ---------------------------------------------------------------------------
  // Internal credentials record
  // ---------------------------------------------------------------------------

  private record DbCredentials(
      String host, int port, String database, String username, String password) {}

  // ---------------------------------------------------------------------------
  // Discovery
  // ---------------------------------------------------------------------------

  /**
   * Discovers all user-defined schemas and their tables from an external PostgreSQL database.
   *
   * @param tenantId the tenant UUID for vault key lookup
   * @param connectionId the UUID of the connection whose credentials are stored in the vault
   * @return map of schema name → list of table names
   */
  public Map<String, List<String>> discoverSchemas(UUID tenantId, UUID connectionId) {
    DbCredentials creds = getCredentials(tenantId, connectionId);
    String jdbcUrl = buildJdbcUrl(creds);

    Map<String, List<String>> schemaTableMap = new LinkedHashMap<>();

    String sql =
        """
            SELECT table_schema, table_name
            FROM information_schema.tables
            WHERE table_type = 'BASE TABLE'
              AND table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY table_schema, table_name
            """;

    try (Connection conn =
            DriverManager.getConnection(jdbcUrl, creds.username(), creds.password());
        PreparedStatement stmt = conn.prepareStatement(sql);
        ResultSet rs = stmt.executeQuery()) {

      while (rs.next()) {
        String schema = rs.getString("table_schema");
        String table = rs.getString("table_name");
        schemaTableMap.computeIfAbsent(schema, k -> new ArrayList<>()).add(table);
      }

      log.info("Discovered {} schemas from connection '{}'", schemaTableMap.size(), connectionId);

    } catch (SQLException e) {
      throw new RuntimeException(
          "Failed to discover schemas for connection " + connectionId + ": " + e.getMessage(), e);
    }

    return schemaTableMap;
  }

  /**
   * Returns column names for a specific table.
   *
   * @param tenantId the tenant UUID for vault key lookup
   * @param connectionId the UUID of the connection
   * @param schema the schema name
   * @param table the table name
   * @return list of column names
   */
  public List<String> discoverColumns(
      UUID tenantId, UUID connectionId, String schema, String table) {
    DbCredentials creds = getCredentials(tenantId, connectionId);
    String jdbcUrl = buildJdbcUrl(creds);

    List<String> columns = new ArrayList<>();

    String sql =
        """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = ? AND table_name = ?
            ORDER BY ordinal_position
            """;

    try (Connection conn =
            DriverManager.getConnection(jdbcUrl, creds.username(), creds.password());
        PreparedStatement stmt = conn.prepareStatement(sql)) {

      stmt.setString(1, schema);
      stmt.setString(2, table);

      try (ResultSet rs = stmt.executeQuery()) {
        while (rs.next()) {
          columns.add(rs.getString("column_name"));
        }
      }

      log.info(
          "Discovered {} columns for '{}.{}' on connection '{}'",
          columns.size(),
          schema,
          table,
          connectionId);

    } catch (SQLException e) {
      throw new RuntimeException(
          "Failed to discover columns for "
              + schema
              + "."
              + table
              + " on connection "
              + connectionId
              + ": "
              + e.getMessage(),
          e);
    }

    return columns;
  }

  // ---------------------------------------------------------------------------
  // Extraction
  // ---------------------------------------------------------------------------

  /**
   * Extracts rows from a PostgreSQL table in chunks using cursor-based pagination, passing each
   * chunk to the provided consumer to avoid loading all rows into memory.
   *
   * <p>Uses JDBC {@code setFetchSize} to enable server-side cursors in PostgreSQL (requires
   * autoCommit to be disabled).
   *
   * @param tenantId the tenant UUID for vault key lookup
   * @param connectionId the UUID of the connection
   * @param schema the schema name
   * @param table the table name
   * @param chunkConsumer callback invoked for each chunk of rows; each row is a map of column name
   *     → value
   */
  public void extractRows(
      UUID tenantId,
      UUID connectionId,
      String schema,
      String table,
      Consumer<List<Map<String, Object>>> chunkConsumer) {

    DbCredentials creds = getCredentials(tenantId, connectionId);
    String jdbcUrl = buildJdbcUrl(creds);

    String sql = "SELECT * FROM " + schema + "." + table;

    try (Connection conn =
        DriverManager.getConnection(jdbcUrl, creds.username(), creds.password())) {

      // Disable autoCommit to enable server-side cursor streaming in PostgreSQL
      conn.setAutoCommit(false);

      try (PreparedStatement stmt = conn.prepareStatement(sql)) {

        // setFetchSize tells the JDBC driver to fetch rows in batches from the server
        stmt.setFetchSize(CHUNK_SIZE);

        try (ResultSet rs = stmt.executeQuery()) {
          ResultSetMetaData meta = rs.getMetaData();
          int columnCount = meta.getColumnCount();

          List<Map<String, Object>> chunk = new ArrayList<>(CHUNK_SIZE);
          long totalRows = 0;

          while (rs.next()) {
            Map<String, Object> row = new HashMap<>(columnCount);
            for (int i = 1; i <= columnCount; i++) {
              row.put(meta.getColumnName(i), rs.getObject(i));
            }
            chunk.add(row);

            if (chunk.size() >= CHUNK_SIZE) {
              chunkConsumer.accept(chunk);
              totalRows += chunk.size();
              log.debug("Extracted chunk of {} rows (total so far: {})", CHUNK_SIZE, totalRows);
              chunk = new ArrayList<>(CHUNK_SIZE);
            }
          }

          // Flush remaining rows
          if (!chunk.isEmpty()) {
            chunkConsumer.accept(chunk);
            totalRows += chunk.size();
          }

          log.info(
              "Extraction complete for '{}.{}' on connection '{}': {} total rows",
              schema,
              table,
              connectionId,
              totalRows);
        }
      }

    } catch (SQLException e) {
      throw new RuntimeException(
          "Failed to extract rows from "
              + schema
              + "."
              + table
              + " on connection "
              + connectionId
              + ": "
              + e.getMessage(),
          e);
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private DbCredentials getCredentials(UUID tenantId, UUID connectionId) {
    String json =
        credentialsVaultService
            .retrieveCredentials(tenantId, connectionId)
            .orElseThrow(
                () -> new RuntimeException("No credentials found for connection: " + connectionId));

    String host = extractJsonField(json, "host");
    int port = Integer.parseInt(extractJsonField(json, "port"));
    String database = extractJsonField(json, "database");
    String username = extractJsonField(json, "username");
    String password = extractJsonField(json, "password");

    return new DbCredentials(host, port, database, username, password);
  }

  private String buildJdbcUrl(DbCredentials creds) {
    return String.format(
        "jdbc:postgresql://%s:%d/%s", creds.host(), creds.port(), creds.database());
  }

  /**
   * Minimal JSON field extractor — avoids pulling in an extra JSON library. Supports string and
   * numeric values only.
   */
  private String extractJsonField(String json, String field) {
    String key = "\"" + field + "\"";
    int keyIndex = json.indexOf(key);
    if (keyIndex == -1) {
      throw new RuntimeException("Field '" + field + "' not found in credentials JSON");
    }
    int colonIndex = json.indexOf(":", keyIndex);
    int valueStart = json.indexOf("\"", colonIndex);
    if (valueStart == -1 || valueStart > json.indexOf(",", colonIndex)) {
      // Numeric value
      int numStart = colonIndex + 1;
      while (numStart < json.length() && json.charAt(numStart) == ' ') numStart++;
      int numEnd = numStart;
      while (numEnd < json.length() && Character.isDigit(json.charAt(numEnd))) numEnd++;
      return json.substring(numStart, numEnd);
    }
    int valueEnd = json.indexOf("\"", valueStart + 1);
    return json.substring(valueStart + 1, valueEnd);
  }
}
