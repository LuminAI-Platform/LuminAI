package com.luminai.common.tenant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class MultiTenantConnectionProviderTest {

  private DataSource dataSource;
  private Connection connection;
  private Statement statement;
  private MultiTenantConnectionProvider provider;

  @BeforeEach
  void setUp() throws SQLException {
    dataSource = mock(DataSource.class);
    connection = mock(Connection.class);
    statement = mock(Statement.class);

    when(dataSource.getConnection()).thenReturn(connection);
    when(connection.createStatement()).thenReturn(statement);

    provider = new MultiTenantConnectionProvider(dataSource);
  }

  @Test
  @DisplayName("getConnection sets quoted search_path including public schema")
  void getConnectionSetsQuotedSearchPath() throws SQLException {
    Connection conn = provider.getConnection("tenant_acme");

    assertThat(conn).isSameAs(connection);
    verify(statement).execute("SET search_path = \"tenant_acme\", public");
  }

  @Test
  @DisplayName("getConnection safely handles hyphenated schema names with quotes")
  void getConnectionHandlesHyphenatedSchema() throws SQLException {
    Connection conn = provider.getConnection("tenant_acme-corp");

    assertThat(conn).isSameAs(connection);
    verify(statement).execute("SET search_path = \"tenant_acme-corp\", public");
  }

  @Test
  @DisplayName(
      "releaseConnection resets search_path to tenant_default, public and closes connection")
  void releaseConnectionResetsSearchPath() throws SQLException {
    provider.releaseConnection("tenant_acme", connection);

    verify(statement).execute("SET search_path = \"tenant_default\", public");
    verify(connection).close();
  }

  @Test
  @DisplayName("rejects schema injection attempts with IllegalArgumentException")
  void rejectsInvalidSchemaNames() {
    assertThatThrownBy(() -> provider.getConnection("tenant; DROP TABLE users;"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Invalid schema name");
  }
}
