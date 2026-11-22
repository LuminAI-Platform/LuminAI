package com.luminai.dataset.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.luminai.common.tenant.TenantContext;
import com.luminai.dataset.dto.SqlQueryRequest;
import com.luminai.dataset.dto.SqlQueryResultDto;
import com.luminai.dataset.repository.SavedQueryRepository;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.Statement;
import java.util.UUID;
import javax.sql.DataSource;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

@ExtendWith(MockitoExtension.class)
class SqlAnalyticsServiceTest {

  @Mock private DataSource dataSource;
  @Mock private SavedQueryRepository savedQueryRepository;
  @Mock private Connection connection;
  @Mock private Statement setStatement;
  @Mock private Statement queryStatement;
  @Mock private ResultSet resultSet;
  @Mock private ResultSetMetaData metaData;

  private SqlAnalyticsService sqlAnalyticsService;
  private final UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");

  @BeforeEach
  void setUp() {
    sqlAnalyticsService = new SqlAnalyticsService(dataSource, savedQueryRepository);
    TenantContext.setTenant(tenantId, "acme");
  }

  @AfterEach
  void tearDown() {
    TenantContext.clear();
  }

  @Test
  @DisplayName("executeQuery rejects queries when missing tenant context")
  void testRequireTenant() {
    TenantContext.clear();
    SqlQueryRequest req = new SqlQueryRequest("SELECT 1", null, 10);
    assertThrows(AccessDeniedException.class, () -> sqlAnalyticsService.executeQuery(req));
  }

  @Test
  @DisplayName("executeQuery rejects non-SELECT/WITH statements")
  void testRejectDestructiveStatements() {
    SqlQueryRequest dropReq = new SqlQueryRequest("DROP TABLE users", null, 10);
    assertThrows(IllegalArgumentException.class, () -> sqlAnalyticsService.executeQuery(dropReq));

    SqlQueryRequest deleteReq = new SqlQueryRequest("DELETE FROM users", null, 10);
    assertThrows(IllegalArgumentException.class, () -> sqlAnalyticsService.executeQuery(deleteReq));

    SqlQueryRequest insertReq = new SqlQueryRequest("INSERT INTO users VALUES (1)", null, 10);
    assertThrows(IllegalArgumentException.class, () -> sqlAnalyticsService.executeQuery(insertReq));
  }

  @Test
  @DisplayName("executeQuery executes SELECT and isolates tenant search_path")
  void testExecuteQuerySetsSearchPath() throws Exception {
    SqlQueryRequest req = new SqlQueryRequest("SELECT id, name FROM customers", null, 50);

    when(dataSource.getConnection()).thenReturn(connection);
    when(connection.createStatement()).thenReturn(setStatement, queryStatement, setStatement);
    when(queryStatement.executeQuery(anyString())).thenReturn(resultSet);
    when(resultSet.getMetaData()).thenReturn(metaData);
    when(metaData.getColumnCount()).thenReturn(2);
    when(metaData.getColumnLabel(1)).thenReturn("id");
    when(metaData.getColumnLabel(2)).thenReturn("name");
    when(resultSet.next()).thenReturn(true, false);
    when(resultSet.getObject(1)).thenReturn(1);
    when(resultSet.getObject(2)).thenReturn("Acme Corp");

    SqlQueryResultDto result = sqlAnalyticsService.executeQuery(req);

    assertNotNull(result);
    assertEquals("SUCCESS", result.status());
    assertEquals(2, result.columns().size());
    assertEquals(1, result.totalRows());

    // Verify SET search_path was executed for tenant schema
    verify(setStatement, atLeastOnce())
        .execute("SET search_path = \"tenant_acme\", public");
    // Verify search_path was restored to default
    verify(setStatement, atLeastOnce())
        .execute("SET search_path = \"" + TenantContext.DEFAULT_SCHEMA + "\", public");
  }
}
