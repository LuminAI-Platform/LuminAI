package com.luminai.graph.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.luminai.graph.EntityResolvedEvent;
import com.luminai.graph.repository.Neo4jGraphRepository;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class Neo4jSyncServiceTest {

  private Neo4jGraphRepository repository;
  private Neo4jSyncService service;

  @BeforeEach
  void setUp() {
    repository = mock(Neo4jGraphRepository.class);
    service = new Neo4jSyncService(repository);
  }

  @Test
  void syncsNodeUsingCanonicalNameFieldWhenPresent() {
    EntityResolvedEvent event =
        new EntityResolvedEvent(
            "acme",
            "gr-100",
            "Person",
            Map.of("canonical_name", "Alice Canonical", "name", "Alice"));

    service.sync(event);

    verify(repository).mergeEntityNode("acme", "gr-100", "Alice Canonical", "Person");
  }

  @Test
  void fallsBackToNameFieldWhenCanonicalNameAbsent() {
    EntityResolvedEvent event =
        new EntityResolvedEvent("acme", "gr-100", "Person", Map.of("name", "Alice Smith"));

    service.sync(event);

    verify(repository).mergeEntityNode("acme", "gr-100", "Alice Smith", "Person");
  }

  @Test
  void fallsBackToGoldenIdWhenNoNameAttributesPresent() {
    EntityResolvedEvent event =
        new EntityResolvedEvent("acme", "gr-100", "Person", Map.of("email", "alice@example.com"));

    service.sync(event);

    verify(repository).mergeEntityNode("acme", "gr-100", "gr-100", "Person");
  }

  @Test
  void fallsBackToGoldenIdWhenDataIsNull() {
    EntityResolvedEvent event = new EntityResolvedEvent("acme", "gr-100", "Person", null);

    service.sync(event);

    verify(repository).mergeEntityNode("acme", "gr-100", "gr-100", "Person");
  }

  @Test
  void doesNotSyncRelationshipsWhenNoneArePresentOnEvent() {
    EntityResolvedEvent event =
        new EntityResolvedEvent("acme", "gr-100", "Person", Map.of("name", "Alice Smith"));

    service.sync(event);

    verify(repository, never()).mergeRelationship(any(), any(), any(), any(), any());
  }

  @Test
  void syncsRelationshipsWhenOptionalRelationshipsArrayIsPresent() {
    EntityResolvedEvent event =
        new EntityResolvedEvent(
            "acme",
            "gr-100",
            "Person",
            Map.of(
                "name",
                "Alice Smith",
                "relationships",
                List.of(Map.of("target_id", "gr-200", "type", "WORKS_AT"))));
    when(repository.mergeRelationship("acme", "gr-100", "gr-200", "WORKS_AT", "OUTGOING"))
        .thenReturn(true);

    service.sync(event);

    verify(repository).mergeRelationship("acme", "gr-100", "gr-200", "WORKS_AT", "OUTGOING");
  }

  @Test
  void supportsCamelCaseTargetIdKeyAndExplicitDirection() {
    EntityResolvedEvent event =
        new EntityResolvedEvent(
            "acme",
            "gr-100",
            "Person",
            Map.of(
                "relationships",
                List.of(
                    Map.of("targetId", "gr-200", "type", "MANAGED_BY", "direction", "INCOMING"))));

    service.sync(event);

    verify(repository).mergeRelationship("acme", "gr-100", "gr-200", "MANAGED_BY", "INCOMING");
  }

  @Test
  void skipsMalformedRelationshipEntriesMissingTargetIdOrType() {
    EntityResolvedEvent event =
        new EntityResolvedEvent(
            "acme",
            "gr-100",
            "Person",
            Map.of("relationships", List.of(Map.of("type", "WORKS_AT"))));

    service.sync(event);

    verify(repository, never()).mergeRelationship(any(), any(), any(), any(), any());
  }

  @Test
  void throwsIllegalArgumentWhenTenantIdMissing() {
    EntityResolvedEvent event = new EntityResolvedEvent(null, "gr-100", "Person", Map.of());

    assertThrows(IllegalArgumentException.class, () -> service.sync(event));
    verifyNoInteractions(repository);
  }

  @Test
  void throwsIllegalArgumentWhenGoldenIdMissing() {
    EntityResolvedEvent event = new EntityResolvedEvent("acme", " ", "Person", Map.of());

    assertThrows(IllegalArgumentException.class, () -> service.sync(event));
    verifyNoInteractions(repository);
  }

  @Test
  void throwsIllegalArgumentWhenEntityTypeMissing() {
    EntityResolvedEvent event = new EntityResolvedEvent("acme", "gr-100", null, Map.of());

    assertThrows(IllegalArgumentException.class, () -> service.sync(event));
    verifyNoInteractions(repository);
  }

  @Test
  void normalizesGrPrefixedUuidToCanonicalUuidAndSyncsScalarProperties() {
    String uuid = "5fc38c8e-a3a3-42e6-bd6a-9f7698869e5f";
    EntityResolvedEvent event =
        new EntityResolvedEvent(
            "luminex",
            "gr-" + uuid,
            "Shipment",
            Map.of("company_name", "Volta Freight", "origin", "Accra", "_connection_id", "conn-1"));

    service.sync(event);

    verify(repository).mergeEntityNode("luminex", uuid, "Volta Freight", "Shipment");
    verify(repository)
        .mergeEntityProperties(
            "luminex", uuid, Map.of("company_name", "Volta Freight", "origin", "Accra"));
  }

  @Test
  void createsTargetStubNodeWhenTypedRelationshipTargetMissingInNeo4j() {
    EntityResolvedEvent event =
        new EntityResolvedEvent(
            "luminex",
            "ord-1",
            "Order",
            Map.of(
                "name",
                "Order #1",
                "relationships",
                List.of(
                    Map.of(
                        "target_id",
                        "cust-9",
                        "target_type",
                        "Customer",
                        "target_name",
                        "Acme Logistics",
                        "type",
                        "PLACED_BY"))));

    when(repository.mergeRelationship("luminex", "ord-1", "cust-9", "PLACED_BY", "OUTGOING"))
        .thenReturn(false)
        .thenReturn(true);

    service.sync(event);

    verify(repository).mergeEntityNode("luminex", "cust-9", "Acme Logistics", "Customer");
    verify(repository, times(2))
        .mergeRelationship("luminex", "ord-1", "cust-9", "PLACED_BY", "OUTGOING");
  }
}
