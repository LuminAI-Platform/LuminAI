package com.luminai.common.tenant;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TenantProvisioningServiceTest {

  @Mock private DataSource dataSource;
  @Mock private Connection connection;
  @Mock private Statement statement;
  @Mock private PreparedStatement registerStmt;

  @Test
  void provisionTenantQuotesHyphenatedSlugAndClonesV1003Tables() throws Exception {
    List<String> executedSql = new ArrayList<>();

    when(dataSource.getConnection()).thenReturn(connection);

    UUID tenantUuid = UUID.randomUUID();
    when(connection.prepareStatement(contains("INSERT INTO public.tenants")))
        .thenReturn(registerStmt);
    ResultSet idRs = mock(ResultSet.class);
    when(registerStmt.executeQuery()).thenReturn(idRs);
    when(idRs.next()).thenReturn(true);
    when(idRs.getString("id")).thenReturn(tenantUuid.toString());

    when(connection.createStatement()).thenReturn(statement);
    when(statement.execute(anyString()))
        .thenAnswer(
            inv -> {
              executedSql.add(inv.getArgument(0));
              return false;
            });

    TenantProvisioningService service = new TenantProvisioningService(dataSource);
    UUID provisioned = service.provisionTenant("Acme Corp", "acme-corp");

    assertEquals(tenantUuid, provisioned);
    assertTrue(
        executedSql.contains("CREATE SCHEMA IF NOT EXISTS \"tenant_acme-corp\""),
        "Schema DDL must double-quote hyphenated schema identifiers");
    for (String table :
        List.of(
            "datasets",
            "dataset_versions",
            "pipeline_definitions",
            "data_quality_rules",
            "dataset_lineage",
            "saved_queries",
            "ml_models")) {
      String expected =
          "CREATE TABLE IF NOT EXISTS \"tenant_acme-corp\".\""
              + table
              + "\" (LIKE \"tenant_template\".\""
              + table
              + "\" INCLUDING ALL)";
      assertTrue(
          executedSql.contains(expected),
          "Expected enterprise table clone DDL for '" + table + "' in: " + executedSql);
    }
  }
}
