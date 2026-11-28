package com.luminai.connection.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.luminai.common.security.JwtClaimsExtractor;
import com.luminai.connection.dto.SchemaMappingDto;
import com.luminai.connection.model.Connection;
import com.luminai.connection.model.SchemaMapping;
import com.luminai.connection.repository.ConnectionRepository;
import com.luminai.connection.repository.SchemaMappingRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class SchemaMappingServiceTest {

  private SchemaMappingRepository mappingRepo;
  private ConnectionRepository connRepo;
  private JwtClaimsExtractor claimsExtractor;
  private SchemaMappingService service;
  private UUID tenantId;
  private UUID connId;

  @BeforeEach
  void setUp() {
    mappingRepo = mock(SchemaMappingRepository.class);
    connRepo = mock(ConnectionRepository.class);
    claimsExtractor = mock(JwtClaimsExtractor.class);
    service = new SchemaMappingService(mappingRepo, connRepo, claimsExtractor);
    service.setObjectMapper(new ObjectMapper());

    tenantId = UUID.randomUUID();
    connId = UUID.randomUUID();
    when(claimsExtractor.getCurrentTenantId()).thenReturn(tenantId.toString());
    when(mappingRepo.save(any(SchemaMapping.class))).thenAnswer(inv -> inv.getArgument(0));
  }

  @Test
  void saveBatchPersistsForeignKeysOntoConnectionConfigAndReadsThemBack() {
    Connection conn =
        new Connection(tenantId, "orders.csv", Connection.Type.FILE, "{}", null, null);
    ReflectionTestUtils.setField(conn, "id", connId);
    when(connRepo.findByIdAndTenantId(connId, tenantId)).thenReturn(Optional.of(conn));

    SchemaMappingDto.BatchRequest req =
        new SchemaMappingDto.BatchRequest(
            connId,
            "orders.csv",
            "Order",
            List.of(
                new SchemaMappingDto.MappingItem(
                    null,
                    null,
                    "customer_id",
                    "Order",
                    "customerId",
                    SchemaMapping.Transformation.NONE)),
            List.of(
                new SchemaMappingDto.ForeignKeyItem(
                    "customer_id", "customer_id", "Customer", "PLACED_BY", "OUTGOING")));

    SchemaMappingDto.BatchResponse resp = service.saveBatch(req);
    assertThat(resp.count()).isEqualTo(1);
    assertThat(resp.foreignKeys()).hasSize(1);
    verify(connRepo).save(conn);
    assertThat(conn.getConfig()).contains("\"foreignKeys\"").contains("\"PLACED_BY\"");

    List<SchemaMappingDto.ForeignKeyItem> loaded = service.getForeignKeysForConnector(connId);
    assertThat(loaded).hasSize(1);
    assertThat(loaded.get(0).targetEntityType()).isEqualTo("Customer");
    assertThat(loaded.get(0).relationshipType()).isEqualTo("PLACED_BY");
  }
}
