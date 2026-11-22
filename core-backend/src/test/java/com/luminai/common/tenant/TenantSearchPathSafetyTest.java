package com.luminai.common.tenant;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.luminai.dataset.dto.SqlQueryRequest;
import com.luminai.dataset.dto.SqlQueryResultDto;
import com.luminai.dataset.repository.SavedQueryRepository;
import com.luminai.dataset.service.SqlAnalyticsService;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.*;
import java.util.concurrent.*;
import javax.sql.DataSource;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TenantSearchPathSafetyTest {

  @Mock private DataSource dataSource;
  @Mock private SavedQueryRepository savedQueryRepository;
  @Mock private Connection connection;
  @Mock private Statement statement;
  @Mock private ResultSet resultSet;
  @Mock private ResultSetMetaData metaData;

  private MultiTenantConnectionProvider connectionProvider;
  private SqlAnalyticsService sqlAnalyticsService;

  private final UUID tenantAcmeId = UUID.fromString("00000000-0000-0000-0000-000000000001");
  private final UUID tenantBetaId = UUID.fromString("00000000-0000-0000-0000-000000000002");

  @BeforeEach
  void setUp() {
    connectionProvider = new MultiTenantConnectionProvider(dataSource);
    sqlAnalyticsService = new SqlAnalyticsService(dataSource, savedQueryRepository);
  }

  @AfterEach
  void tearDown() {
    TenantContext.clear();
  }

  @Test
  @DisplayName(
      "MultiTenantConnectionProvider acquires connection, sets search_path, and closes on set failure")
  void testGetConnectionClosesOnFailure() throws Exception {
    when(dataSource.getConnection()).thenReturn(connection);
    when(connection.createStatement()).thenReturn(statement);
    doThrow(new SQLException("Database timeout"))
        .when(statement)
        .execute(contains("SET search_path"));

    assertThrows(SQLException.class, () -> connectionProvider.getConnection("tenant_acme"));

    // Verify connection was closed immediately to prevent resource leak
    verify(connection, times(1)).close();
  }

  @Test
  @DisplayName(
      "MultiTenantConnectionProvider releaseConnection resets search_path and aborts on reset failure")
  void testReleaseConnectionAbortsOnResetFailure() throws Exception {
    when(connection.createStatement()).thenReturn(statement);
    doThrow(new SQLException("Socket write error"))
        .when(statement)
        .execute(contains("SET search_path = \"tenant_default\""));

    assertThrows(
        SQLException.class, () -> connectionProvider.releaseConnection("tenant_acme", connection));

    // Verify connection was forcefully aborted so pool destroys it
    verify(connection, times(1)).abort(any(Executor.class));
  }

  @Test
  @DisplayName("SqlAnalyticsService resets search_path or aborts connection on reset failure")
  void testSqlAnalyticsServiceAbortsOnResetFailure() throws Exception {
    TenantContext.setTenant(tenantAcmeId, "acme");
    Statement queryStatement = mock(Statement.class);
    Statement resetStatement = mock(Statement.class);

    when(dataSource.getConnection()).thenReturn(connection);
    when(connection.createStatement()).thenReturn(statement, queryStatement, resetStatement);
    when(queryStatement.executeQuery(anyString())).thenReturn(resultSet);
    when(resultSet.getMetaData()).thenReturn(metaData);
    when(metaData.getColumnCount()).thenReturn(1);
    when(metaData.getColumnLabel(1)).thenReturn("val");
    when(resultSet.next()).thenReturn(false);

    // Fail the reset statement
    doThrow(new SQLException("Connection broken during reset"))
        .when(resetStatement)
        .execute(contains("tenant_default"));

    SqlQueryResultDto result =
        sqlAnalyticsService.executeQuery(new SqlQueryRequest("SELECT 1", null, 10));

    assertNotNull(result);
    // Verify connection was aborted
    verify(connection, times(1)).abort(any(Executor.class));
  }

  @Test
  @DisplayName("Concurrent tenants maintain isolated search_paths across threads")
  void testConcurrentTenantIsolation() throws Exception {
    int threadCount = 10;
    ExecutorService executor = Executors.newFixedThreadPool(threadCount);
    CountDownLatch startLatch = new CountDownLatch(1);
    CountDownLatch doneLatch = new CountDownLatch(threadCount);
    List<String> recordedSchemas = new CopyOnWriteArrayList<>();

    for (int i = 0; i < threadCount; i++) {
      final int index = i;
      executor.submit(
          () -> {
            try {
              startLatch.await();
              String slug = (index % 2 == 0) ? "acme" : "beta";
              UUID tId = (index % 2 == 0) ? tenantAcmeId : tenantBetaId;
              TenantContext.setTenant(tId, slug);

              String schema = TenantContext.getCurrentSchema();
              recordedSchemas.add(schema);
              assertEquals("tenant_" + slug, schema);
            } catch (Exception e) {
              fail("Thread execution failed: " + e.getMessage());
            } finally {
              TenantContext.clear();
              doneLatch.countDown();
            }
          });
    }

    startLatch.countDown();
    assertTrue(doneLatch.await(5, TimeUnit.SECONDS));
    executor.shutdown();

    assertEquals(threadCount, recordedSchemas.size());
    long acmeCount = recordedSchemas.stream().filter(s -> s.equals("tenant_acme")).count();
    long betaCount = recordedSchemas.stream().filter(s -> s.equals("tenant_beta")).count();
    assertEquals(5, acmeCount);
    assertEquals(5, betaCount);
  }
}
