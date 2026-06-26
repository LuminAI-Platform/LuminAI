package com.luminai.config;

import com.luminai.common.tenant.TenantContext;
import com.luminai.common.tenant.TenantIdentifierResolver;
import org.hibernate.cfg.AvailableSettings;
import org.hibernate.engine.jdbc.connections.spi.MultiTenantConnectionProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Map;


//Hibernate multi-tenancy configuration using {@code SCHEMA} isolation strategy
@Configuration
public class MultiTenancyConfig {

  private static final Logger log = LoggerFactory.getLogger(MultiTenancyConfig.class);

  /*
   * Registers the {@link SchemaMultiTenantConnectionProvider} as a Spring bean
   */
  @Bean
  public MultiTenantConnectionProvider<String> multiTenantConnectionProvider(DataSource dataSource) {
    return new SchemaMultiTenantConnectionProvider(dataSource);
  }

  /*
   * Wires the {@link MultiTenantConnectionProvider} and the multi-tenancy mode
   * into Hibernate's property map via Spring Boot's customizer contract.
   */
  @Bean
  public HibernatePropertiesCustomizer multiTenancyPropertiesCustomizer(
          MultiTenantConnectionProvider<String> provider,
          TenantIdentifierResolver resolver) {

    return hibernateProperties -> {
      hibernateProperties.put(
              AvailableSettings.MULTI_TENANT_CONNECTION_PROVIDER, provider);

      // SCHEMA mode: one shared DB server, one schema per tenant.
      // Hibernate will call the ConnectionProvider with the tenant identifier
      // to obtain an appropriately-routed connection.
      hibernateProperties.put(
              AvailableSettings.JAKARTA_HBM2DDL_DB_NAME, "SCHEMA");

      log.info("Hibernate multi-tenancy configured: mode=SCHEMA, provider={}, resolver={}",
              provider.getClass().getSimpleName(),
              resolver.getClass().getSimpleName());
    };
  }

  // -------------------------------------------------------------------------
  // Inner class: SchemaMultiTenantConnectionProvider
  // -------------------------------------------------------------------------

  public static class SchemaMultiTenantConnectionProvider
          implements MultiTenantConnectionProvider<String> {

    private static final Logger log = LoggerFactory.getLogger(SchemaMultiTenantConnectionProvider.class);

    private final DataSource dataSource;

    public SchemaMultiTenantConnectionProvider(DataSource dataSource) {
      this.dataSource = dataSource;
    }

    /*
     * Returns a connection for use outside a tenant context (e.g. Hibernate
     * schema validation at startup). Routes to the public/default schema.
     */
    @Override
    public Connection getAnyConnection() throws SQLException {
      Connection connection = dataSource.getConnection();
      setSearchPath(connection, TenantContext.DEFAULT_TENANT);
      return connection;
    }

    /*
     * Releases a connection that was obtained via {@link #getAnyConnection()}.
     * Resets the {@code search_path} to {@code public} before returning to the pool.
     */
    @Override
    public void releaseAnyConnection(Connection connection) throws SQLException {
      resetSearchPath(connection);
      connection.close();
    }

    /*
     * Returns a connection pointed at the schema for the specified {@code tenantIdentifier}.
     */
    @Override
    public Connection getConnection(String tenantIdentifier) throws SQLException {
      log.debug("Acquiring connection for schema: {}", tenantIdentifier);
      Connection connection = dataSource.getConnection();
      setSearchPath(connection, tenantIdentifier);
      return connection;
    }

    /*
     * Releases a tenant-specific connection back to the pool.
     * Always resets the {@code search_path} to {@code public} first.
     */
    @Override
    public void releaseConnection(String tenantIdentifier, Connection connection)
            throws SQLException {
      log.debug("Releasing connection for schema: {}", tenantIdentifier);
      resetSearchPath(connection);
      connection.close();
    }

    /*
     * Returns {@code false} — this provider does not support aggressive connection
     * release between transactions (which would require re-routing on every reacquire).
     */
    @Override
    public boolean supportsAggressiveRelease() {
      return false;
    }

    /*
     * Confirms this provider can unwrap to the given type.
     * Returning {@code false} for all types is safe for a delegating provider.
     */
    @Override
    public boolean isUnwrappableAs(Class<?> unwrapType) {
      return false;
    }

    /*
     * This provider does not support unwrapping; always returns {@code null}.
     */
    @Override
    public <T> T unwrap(Class<T> unwrapType) {
      return null;
    }

    // ------------------------------------------------------------------
    // Private helpers
    // ------------------------------------------------------------------

    /*
     * Issues {@code SET search_path = <schema>} on the given connection.
     * Sanitizes the schema name to prevent SQL injection.
     */
    private void setSearchPath(Connection connection, String schema) throws SQLException {
      // Sanitize: allow only alphanumerics, underscores, and hyphens.
      // This guards against SQL injection even though schema names come from
      // our own JWT claims rather than user-typed input.
      String safeSchema = sanitizeSchemaName(schema);
      String sql = String.format("SET search_path = %s", safeSchema);
      log.trace("Executing: {}", sql);
      try (var stmt = connection.createStatement()) {
        stmt.execute(sql);
      }
    }

    // Resets the connection's {@code search_path} to {@code public} before returning it to the HikariCP pool.
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
