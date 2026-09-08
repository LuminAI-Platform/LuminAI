package com.luminai.common.tenant;

import java.sql.Connection;
import java.sql.SQLException;
import javax.sql.DataSource;
import org.hibernate.engine.jdbc.connections.spi.AbstractDataSourceBasedMultiTenantConnectionProviderImpl;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class MultiTenantConnectionProvider
    extends AbstractDataSourceBasedMultiTenantConnectionProviderImpl<String> {

  private static final Logger log = LoggerFactory.getLogger(MultiTenantConnectionProvider.class);

  private static final long serialVersionUID = 1L;

  private static final String SAFE_SCHEMA_PATTERN = "[a-zA-Z0-9_\\-]+";

  private final DataSource dataSource;

  public MultiTenantConnectionProvider(DataSource dataSource) {
    this.dataSource = dataSource;
  }

  // -------------------------------------------------------------------------
  // DataSource selection
  // -------------------------------------------------------------------------

  @Override
  protected DataSource selectAnyDataSource() {
    return dataSource;
  }

  @Override
  protected DataSource selectDataSource(String tenantIdentifier) {
    return dataSource;
  }

  // -------------------------------------------------------------------------
  // Hibernate startup (schema validation)
  // -------------------------------------------------------------------------

  @Override
  public Connection getAnyConnection() throws SQLException {

    log.info(">>> getAnyConnection() called");

    Connection connection = dataSource.getConnection();

    log.info("getAnyConnection() -> {}", TenantContext.DEFAULT_SCHEMA);

    setSearchPath(connection, TenantContext.DEFAULT_SCHEMA);

    try (var stmt = connection.createStatement();
        var rs = stmt.executeQuery("SHOW search_path")) {
      rs.next();
      log.info("search_path = {}", rs.getString(1));
    }

    return connection;
  }

  @Override
  public void releaseAnyConnection(Connection connection) throws SQLException {

    try {
      resetSearchPath(connection);
    } finally {
      connection.close();
    }
  }

  // -------------------------------------------------------------------------
  // Tenant connections
  // -------------------------------------------------------------------------

  @Override
  public Connection getConnection(String tenantIdentifier) throws SQLException {

    Connection connection = dataSource.getConnection();

    log.info("getConnection() -> {}", tenantIdentifier);

    setSearchPath(connection, tenantIdentifier);

    return connection;
  }

  @Override
  public void releaseConnection(String tenantIdentifier, Connection connection)
      throws SQLException {

    try {
      resetSearchPath(connection);
    } finally {
      connection.close();
    }
  }

  @Override
  public boolean supportsAggressiveRelease() {
    return false;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private void setSearchPath(Connection connection, String schema) throws SQLException {

    String safeSchema = sanitize(schema);

    try (var stmt = connection.createStatement()) {
      stmt.execute("SET search_path = " + safeSchema);
    }

    log.info("search_path set to '{}'", safeSchema);
  }

  private void resetSearchPath(Connection connection) throws SQLException {

    try (var stmt = connection.createStatement()) {
      stmt.execute("SET search_path = " + TenantContext.DEFAULT_SCHEMA);
    }

    log.info("search_path reset to '{}'", TenantContext.DEFAULT_SCHEMA);
  }

  private String sanitize(String schema) {

    if (schema == null || schema.isBlank() || "default".equalsIgnoreCase(schema)) {
      schema = TenantContext.DEFAULT_SCHEMA;
    }

    if (!schema.matches(SAFE_SCHEMA_PATTERN)) {
      throw new IllegalArgumentException("Invalid schema name: " + schema);
    }

    return schema;
  }
}
