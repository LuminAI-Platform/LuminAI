package com.luminai.common.tenant;

import org.hibernate.engine.jdbc.connections.spi.AbstractDataSourceBasedMultiTenantConnectionProviderImpl;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;

@Component
public class MultiTenantConnectionProvider
        extends AbstractDataSourceBasedMultiTenantConnectionProviderImpl<String> {

    private static final Logger log = LoggerFactory.getLogger(MultiTenantConnectionProvider.class);

    private static final long serialVersionUID = 1L;

    /** Allowlist for schema name characters — prevents SQL injection. */
    private static final String SAFE_SCHEMA_PATTERN = "[a-zA-Z0-9_\\-]+";

    private final DataSource dataSource;

    public MultiTenantConnectionProvider(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    // -------------------------------------------------------------------------
    // AbstractDataSourceBasedMultiTenantConnectionProviderImpl contract
    // -------------------------------------------------------------------------

    // Returns the shared DataSource for operations that run outside any tenant context
    @Override
    protected DataSource selectAnyDataSource() {
        return dataSource;
    }

     //Returns the shared DataSource for a specific tenant.
    @Override
    protected DataSource selectDataSource(String tenantIdentifier) {
        return dataSource;
    }

    // -------------------------------------------------------------------------
    // Connection lifecycle — schema switching happens here
    // -------------------------------------------------------------------------

     // Acquires a connection from the pool and switches it to the tenant's schema.
    @Override
    public Connection getConnection(String tenantIdentifier) throws SQLException {
        log.debug("Acquiring connection for schema: {}", tenantIdentifier);
        Connection connection = dataSource.getConnection();
        setSearchPath(connection, tenantIdentifier);
        return connection;
    }

     // Resets the connection's schema to {@code public} and releases it back to the pool
    @Override
    public void releaseConnection(String tenantIdentifier, Connection connection)
            throws SQLException {
        log.debug("Releasing connection for schema: {}", tenantIdentifier);
        try {
            resetSearchPath(connection);
        } finally {
            // Always close (return to pool) even if the reset fails
            connection.close();
        }
    }

    // Returns {@code false}: we do not support aggressive release between transactions.
    @Override
    public boolean supportsAggressiveRelease() {
        return false;
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    // Issues {@code SET search_path = <schema>} on the given connection.
    private void setSearchPath(Connection connection, String schema) throws SQLException {
        String safe = sanitize(schema);
        try (var stmt = connection.createStatement()) {
            stmt.execute("SET search_path = " + safe);
            log.trace("SET search_path = {}", safe);
        }
    }

    // Resets the connection's {@code search_path} to the {@code public} schema
    private void resetSearchPath(Connection connection) throws SQLException {
        try (var stmt = connection.createStatement()) {
            stmt.execute("SET search_path = " + TenantContext.DEFAULT_TENANT);
            log.trace("Resetting search_path to {}", TenantContext.DEFAULT_TENANT);
        } catch (SQLException e) {
            log.warn("Failed to reset search_path — connection may be stale", e);
            throw e;
        }
    }

    // Validates a schema name against an allowlist to prevent SQL injection.
    private String sanitize(String schema) {
        if (schema == null || !schema.matches(SAFE_SCHEMA_PATTERN)) {
            throw new IllegalArgumentException(
                    "Invalid schema name — must match [a-zA-Z0-9_-]: " + schema);
        }
        return schema;
    }
}