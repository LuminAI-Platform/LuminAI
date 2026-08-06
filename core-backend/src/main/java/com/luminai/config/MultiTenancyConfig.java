package com.luminai.config;

import com.luminai.common.tenant.TenantIdentifierResolver;
import org.hibernate.cfg.AvailableSettings;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MultiTenancyConfig {

  @Bean
  HibernatePropertiesCustomizer multiTenancyCustomizer(
          com.luminai.common.tenant.MultiTenantConnectionProvider provider,
          TenantIdentifierResolver resolver) {

    return props -> {
      props.put(
              AvailableSettings.MULTI_TENANT_CONNECTION_PROVIDER,
              provider);
    };
  }
<<<<<<< HEAD
}
=======

  // -------------------------------------------------------------------------
  // Inner class: SchemaMultiTenantConnectionProvider
  // -------------------------------------------------------------------------

  public static class SchemaMultiTenantConnectionProvider
      implements MultiTenantConnectionProvider<String> {

    private static final Logger log =
        LoggerFactory.getLogger(SchemaMultiTenantConnectionProvider.class);

    private final DataSource dataSource;

    public SchemaMultiTenantConnectionProvider(DataSource dataSource) {
      this.dataSource = dataSource;
    }

    // Returns a connection outside a tenant context. Includes tenant_template
    // in the search path so Hibernate can discover entity table metadata at startup.
    @Override
    public Connection getAnyConnection() throws SQLException {
      Connection connection = dataSource.getConnection();
      try (var stmt = connection.createStatement()) {
        stmt.execute("SET search_path = public, tenant_template");
      }
      return connection;
    }

    @Override
    public void releaseAnyConnection(Connection connection) throws SQLException {
      resetSearchPath(connection);
      connection.close();
    }

    @Override
    public Connection getConnection(String tenantIdentifier) throws SQLException {
      log.debug("Acquiring connection for schema: {}", tenantIdentifier);
      Connection connection = dataSource.getConnection();
      setSearchPath(connection, tenantIdentifier);
      return connection;
    }

    @Override
    public void releaseConnection(String tenantIdentifier, Connection connection)
        throws SQLException {
      log.debug("Releasing connection for schema: {}", tenantIdentifier);
      resetSearchPath(connection);
      connection.close();
    }

    @Override
    public boolean supportsAggressiveRelease() {
      return false;
    }

    @Override
    public boolean isUnwrappableAs(Class<?> unwrapType) {
      return false;
    }

    @Override
    public <T> T unwrap(Class<T> unwrapType) {
      return null;
    }

    // ------------------------------------------------------------------
    // Private helpers
    // ------------------------------------------------------------------

    private void setSearchPath(Connection connection, String schema) throws SQLException {
      String safeSchema = sanitizeSchemaName(schema);
      String sql = String.format("SET search_path = %s", safeSchema);
      log.trace("Executing: {}", sql);
      try (var stmt = connection.createStatement()) {
        stmt.execute(sql);
      }
    }

    // Resets the connection's {@code search_path} to {@code public} before returning it to the
    // HikariCP pool.
    private void resetSearchPath(Connection connection) throws SQLException {
      try (var stmt = connection.createStatement()) {
        stmt.execute("SET search_path = public");
      } catch (SQLException e) {
        log.warn("Failed to reset search_path on connection release", e);
        throw e;
      }
    }

    // Validates that a schema name contains only safe characters.
    private String sanitizeSchemaName(String schema) {
      if (schema == null || !schema.matches("[a-zA-Z0-9_\\-]+")) {
        throw new IllegalArgumentException(
            "Invalid schema name — must match [a-zA-Z0-9_-]: " + schema);
      }
      return schema;
    }
  }
}
>>>>>>> bc175b62537235a0bc9c0be4054a85ce0223410b
