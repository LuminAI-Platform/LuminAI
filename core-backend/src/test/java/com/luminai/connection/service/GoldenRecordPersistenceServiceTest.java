package com.luminai.connection.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.luminai.common.tenant.TenantContext;
import com.luminai.config.CacheConfig;
import com.luminai.connection.model.Connection;
import com.luminai.connection.model.GoldenRecord;
import com.luminai.connection.model.SchemaMapping;
import com.luminai.connection.repository.ConnectionRepository;
import com.luminai.connection.repository.GoldenRecordRepository;
import com.luminai.connection.repository.SchemaMappingRepository;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.cache.Cache;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.test.util.ReflectionTestUtils;

class GoldenRecordPersistenceServiceTest {

  private GoldenRecordRepository goldenRecordRepository;
  private ConnectionRepository connectionRepository;
  private SchemaMappingRepository schemaMappingRepository;
  private ConcurrentMapCacheManager cacheManager;
  private ObjectMapper objectMapper;
  private GoldenRecordPersistenceService service;
  private UUID tenantId;
  private UUID connId;

  @BeforeEach
  void setUp() {
    goldenRecordRepository = mock(GoldenRecordRepository.class);
    connectionRepository = mock(ConnectionRepository.class);
    schemaMappingRepository = mock(SchemaMappingRepository.class);
    cacheManager =
        new ConcurrentMapCacheManager(
            CacheConfig.CACHE_EXPLORER_SEARCH,
            CacheConfig.CACHE_EXPLORER_ENTITIES,
            CacheConfig.CACHE_DASHBOARD);
    objectMapper = new ObjectMapper();
    service =
        new GoldenRecordPersistenceService(
            goldenRecordRepository, connectionRepository, objectMapper);
    service.setSchemaMappingRepository(schemaMappingRepository);
    service.setCacheManager(cacheManager);

    tenantId = UUID.randomUUID();
    connId = UUID.randomUUID();
    TenantContext.setTenant(tenantId, "luminex");

    when(goldenRecordRepository.saveAll(anyList()))
        .thenAnswer(inv -> new ArrayList<>(inv.getArgument(0)));
  }

  @AfterEach
  void tearDown() {
    TenantContext.clear();
  }

  @Test
  @DisplayName(
      "syncGoldenRecords persists all >50 rows without cap, resolves names/entityType from mapping, and evicts Explorer caches")
  @SuppressWarnings("unchecked")
  void syncPersistsAllRowsWithSchemaMappingAndCacheEviction() {
    Connection conn =
        new Connection(
            tenantId,
            "Shipments Feed",
            Connection.Type.FILE,
            "{\"fileName\":\"shipments_q4.csv\"}",
            null,
            null);
    ReflectionTestUtils.setField(conn, "id", connId);

    SchemaMapping mapping =
        new SchemaMapping(
            tenantId,
            connId,
            "Shipments - company_name",
            "company_name",
            "Shipment",
            "company_name",
            SchemaMapping.Transformation.NONE);

    when(connectionRepository.findByIdAndTenantId(connId, tenantId)).thenReturn(Optional.of(conn));
    when(schemaMappingRepository.findAllByConnectorIdAndTenantId(connId, tenantId))
        .thenReturn(List.of(mapping));

    Cache searchCache = cacheManager.getCache(CacheConfig.CACHE_EXPLORER_SEARCH);
    searchCache.put("luminex::all", "stale");

    List<Map<String, Object>> rows = new ArrayList<>();
    for (int i = 1; i <= 75; i++) {
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("id", "rec-" + String.format("%04d", i));
      row.put("company_name", "Carrier Co " + i);
      row.put("origin", "Accra");
      row.put("confidenceScore", 0.96);
      rows.add(row);
    }

    int persisted = service.syncGoldenRecords(connId, tenantId, null, null, rows, true);

    assertThat(persisted).isEqualTo(75);
    assertThat(searchCache.get("luminex::all")).isNull();

    verify(goldenRecordRepository).deleteByTenantIdAndConnectionId(tenantId, connId.toString());

    ArgumentCaptor<List<GoldenRecord>> captor = ArgumentCaptor.forClass(List.class);
    verify(goldenRecordRepository).saveAll(captor.capture());
    List<GoldenRecord> saved = captor.getValue();
    assertThat(saved).hasSize(75);
    assertThat(saved.get(0).getEntityType()).isEqualTo("Shipment");
    assertThat(saved.get(0).getCanonicalName()).isEqualTo("Carrier Co 1");
    assertThat(saved.get(0).getSourceRecordIds()).hasSize(1);
    assertThat(saved.get(0).getProvenance()).isNotEmpty();
    assertThat(saved.get(0).getProperties())
        .containsEntry("_connection_id", connId.toString())
        .containsEntry("_source_name", "shipments_q4.csv")
        .containsEntry("_sync_persisted", true);
  }

  @Test
  @DisplayName(
      "persistGoldenRecords recovers when config flag is true but DB has no rows for the connection")
  void persistRecoversFromStalePersistedFlagWhenDbEmpty() {
    Connection conn =
        new Connection(
            tenantId,
            "customers.csv",
            Connection.Type.FILE,
            "{\"fileName\":\"customers.csv\",\"goldenRecordsPersisted\":true}",
            null,
            null);
    ReflectionTestUtils.setField(conn, "id", connId);

    when(connectionRepository.findByIdAndTenantId(connId, tenantId)).thenReturn(Optional.of(conn));
    when(goldenRecordRepository.findByTenantIdAndConnectionId(tenantId, connId.toString()))
        .thenReturn(List.of());

    service.persistGoldenRecords(
        connId,
        tenantId,
        List.of(Map.of("customer_name", "Ama Boateng", "email", "ama@example.com")));

    verify(goldenRecordRepository).saveAll(anyList());
  }

  @Test
  @DisplayName(
      "persistGoldenRecords skips duplicate insert when non-replace mode finds existing connection rows")
  void persistSkipsWhenDbAlreadyHasConnectionRows() {
    Connection conn =
        new Connection(
            tenantId,
            "customers.csv",
            Connection.Type.FILE,
            "{\"fileName\":\"customers.csv\",\"goldenRecordsPersisted\":true}",
            null,
            null);
    ReflectionTestUtils.setField(conn, "id", connId);

    when(connectionRepository.findByIdAndTenantId(connId, tenantId)).thenReturn(Optional.of(conn));
    when(goldenRecordRepository.findByTenantIdAndConnectionId(tenantId, connId.toString()))
        .thenReturn(List.of(GoldenRecord.newStandalone()));

    service.persistGoldenRecords(
        connId, tenantId, List.of(Map.of("name", "Ama Boateng", "email", "ama@example.com")));

    verify(goldenRecordRepository, never()).saveAll(anyList());
  }

  @Test
  @DisplayName(
      "backfillExistingRecordsToNeo4j syncs nodes with scalar properties and Schema Studio FK edges")
  @SuppressWarnings("unchecked")
  void backfillSyncsNodesAndForeignKeyEdgesToNeo4j() {
    com.luminai.graph.repository.Neo4jGraphRepository neo4jRepo =
        mock(com.luminai.graph.repository.Neo4jGraphRepository.class);
    service.setNeo4jGraphRepository(neo4jRepo);

    Connection conn =
        new Connection(
            tenantId,
            "orders.csv",
            Connection.Type.FILE,
            "{\"fileName\":\"orders.csv\",\"foreignKeys\":[{\"columnId\":\"customer_id\",\"columnName\":\"customer_id\",\"targetEntityType\":\"Customer\",\"relationshipType\":\"PLACED_BY\",\"direction\":\"OUTGOING\"}]}",
            null,
            null);
    ReflectionTestUtils.setField(conn, "id", connId);

    GoldenRecord orderGr = GoldenRecord.newStandalone();
    UUID orderUuid = UUID.randomUUID();
    ReflectionTestUtils.setField(orderGr, "id", orderUuid);
    orderGr.setEntityType("Order");
    orderGr.setCanonicalName("ORD-101");
    orderGr.getProperties().put("_connection_id", connId.toString());
    orderGr.getProperties().put("customer_id", "CUST-42");
    orderGr.getProperties().put("amount", 150);

    when(connectionRepository.findByIdAndTenantId(connId, tenantId)).thenReturn(Optional.of(conn));
    when(goldenRecordRepository.findByTenantIdAndConnectionId(tenantId, connId.toString()))
        .thenReturn(List.of(orderGr));
    when(neo4jRepo.mergeRelationship(
            org.mockito.ArgumentMatchers.eq("luminex"),
            org.mockito.ArgumentMatchers.eq(orderUuid.toString()),
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.eq("PLACED_BY"),
            org.mockito.ArgumentMatchers.eq("OUTGOING")))
        .thenReturn(true);

    Map<String, Object> summary = service.backfillExistingRecordsToNeo4j(tenantId, connId);

    assertThat(summary).containsEntry("status", "COMPLETED").containsEntry("edgesSynced", 1);
    ArgumentCaptor<List<Map<String, Object>>> nodeBatchCaptor = ArgumentCaptor.forClass(List.class);
    verify(neo4jRepo, org.mockito.Mockito.times(2))
        .mergeEntityNodesBatch(
            org.mockito.ArgumentMatchers.eq("luminex"), nodeBatchCaptor.capture());
    assertThat(nodeBatchCaptor.getAllValues().get(0)).hasSize(1);
    assertThat(nodeBatchCaptor.getAllValues().get(1).get(0))
        .containsEntry("canonicalName", "CUST-42")
        .containsEntry("entityType", "Customer");
    verify(neo4jRepo)
        .mergeRelationship(
            org.mockito.ArgumentMatchers.eq("luminex"),
            org.mockito.ArgumentMatchers.eq(orderUuid.toString()),
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.eq("PLACED_BY"),
            org.mockito.ArgumentMatchers.eq("OUTGOING"));
  }
}
