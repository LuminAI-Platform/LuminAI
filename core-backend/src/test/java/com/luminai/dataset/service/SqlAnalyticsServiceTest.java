package com.luminai.dataset.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.luminai.common.tenant.TenantContext;
import com.luminai.dataset.dto.SqlQueryRequest;
import com.luminai.dataset.dto.SqlQueryResultDto;
import com.luminai.dataset.model.Dataset;
import com.luminai.dataset.repository.DatasetRepository;
import com.luminai.dataset.repository.SavedQueryRepository;
import com.luminai.engine.service.DataEngineClient;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.Statement;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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

    // Verify SET search_path was executed for tenant schema without public fallback
    verify(setStatement, atLeastOnce()).execute("SET search_path = \"tenant_acme\"");
    // Verify search_path was restored to default
    verify(setStatement, atLeastOnce())
        .execute("SET search_path = \"" + TenantContext.DEFAULT_SCHEMA + "\"");
  }

  @Test
  @DisplayName("executeQuery rejects quoted cross-schema qualifiers, system tables, and set_config")
  void testRejectQuotedCrossSchemaAndSystemFunctions() {
    SqlQueryRequest quotedCrossSchema =
        new SqlQueryRequest("SELECT * FROM \"public\".users", null, 10);
    assertThrows(
        IllegalArgumentException.class, () -> sqlAnalyticsService.executeQuery(quotedCrossSchema));

    SqlQueryRequest systemTable = new SqlQueryRequest("SELECT * FROM vault_credentials", null, 10);
    assertThrows(
        IllegalArgumentException.class, () -> sqlAnalyticsService.executeQuery(systemTable));

    SqlQueryRequest setConfigCall =
        new SqlQueryRequest("SELECT set_config('search_path', 'public', false)", null, 10);
    assertThrows(
        IllegalArgumentException.class, () -> sqlAnalyticsService.executeQuery(setConfigCall));
  }

  @Test
  @DisplayName("executeQuery routes dataset-scoped SQL through DuckDB DataEngineClient")
  void testExecuteQueryRoutesDatasetScopedQueryToDuckDb() {
    UUID dsId = UUID.randomUUID();
    DatasetRepository datasetRepo = mock(DatasetRepository.class);
    DataEngineClient dataEngineClient = mock(DataEngineClient.class);
    sqlAnalyticsService.setDatasetRepository(datasetRepo);
    sqlAnalyticsService.setDataEngineClient(dataEngineClient);

    Dataset ds = new Dataset();
    ds.setId(dsId);
    ds.setTenantId(tenantId);
    ds.setName("customers");
    ds.setStorageLocation(tenantId + "/raw/customers.csv");

    when(datasetRepo.findByIdAndTenantId(dsId, tenantId)).thenReturn(Optional.of(ds));
    when(dataEngineClient.executeSqlQuery(anyMap()))
        .thenReturn(
            Map.of(
                "columns",
                List.of(Map.of("name", "country", "data_type", "VARCHAR")),
                "rows",
                List.of(Map.of("country", "GH")),
                "total_count",
                1,
                "execution_time_ms",
                12));

    SqlQueryResultDto result =
        sqlAnalyticsService.executeQuery(
            new SqlQueryRequest("SELECT country FROM dataset LIMIT 10", dsId, 100));

    assertEquals("SUCCESS", result.status());
    assertEquals(1, result.columns().size());
    assertEquals("country", result.columns().get(0).name());
    assertEquals("GH", result.rows().get(0).get("country"));
    verify(dataEngineClient, times(1))
        .executeSqlQuery(
            argThat(m -> (tenantId + "/raw/customers.csv").equals(m.get("storage_location"))));
  }
}
