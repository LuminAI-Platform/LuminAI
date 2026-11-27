package com.luminai.explorer.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;

import com.luminai.common.exception.ResourceNotFoundException;
import com.luminai.common.security.JwtClaimsExtractor;
import com.luminai.connection.model.GoldenRecord;
import com.luminai.connection.model.ProvenanceEntry;
import com.luminai.connection.repository.GoldenRecordRepository;
import com.luminai.explorer.dto.EntityDetailDto;
import com.luminai.explorer.dto.ProvenanceItem;
import com.luminai.explorer.dto.SearchResponseDto;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

@ExtendWith(MockitoExtension.class)
class ExplorerSearchServiceTest {

  @Mock private GoldenRecordRepository goldenRecordRepository;
  @Mock private JwtClaimsExtractor claimsExtractor;

  private ExplorerSearchService service;

  @BeforeEach
  void setUp() {
    service = new ExplorerSearchService(goldenRecordRepository, claimsExtractor);
  }

  @Test
  @DisplayName("search returns matching items and facet counts")
  void searchReturnsMatchingItems() {
    GoldenRecord gr1 = GoldenRecord.newStandalone();
    gr1.getProperties().put("canonical_name", "Acme Corporation");
    gr1.getProperties().put("entity_type", "Company");
    gr1.getProperties().put("country", "US");

    GoldenRecord gr2 = GoldenRecord.newStandalone();
    gr2.getProperties().put("canonical_name", "Alice Smith");
    gr2.getProperties().put("entity_type", "Person");
    gr2.getProperties().put("role", "Engineer");

    when(goldenRecordRepository.findAll()).thenReturn(List.of(gr1, gr2));

    SearchResponseDto.Response result = service.search("Acme", null, 0, 20, "createdAt", "DESC");

    assertThat(result.items()).hasSize(1);
    assertThat(result.items().get(0).canonicalName()).isEqualTo("Acme Corporation");
    assertThat(result.items().get(0).entityType()).isEqualTo("Company");
    assertThat(result.total()).isEqualTo(1);
    assertThat(result.facets().get("entityTypes")).containsEntry("Company", 1L);
    assertThat(result.facets().get("entityTypes")).containsEntry("Person", 1L);
  }

  @Test
  @DisplayName("search filters by entity type correctly")
  void searchFiltersByEntityType() {
    GoldenRecord gr1 = GoldenRecord.newStandalone();
    gr1.getProperties().put("canonical_name", "Acme Corporation");
    gr1.getProperties().put("entity_type", "Company");

    GoldenRecord gr2 = GoldenRecord.newStandalone();
    gr2.getProperties().put("canonical_name", "Alice Smith");
    gr2.getProperties().put("entity_type", "Person");

    when(goldenRecordRepository.findAll()).thenReturn(List.of(gr1, gr2));

    SearchResponseDto.Response result = service.search("", "Person", 0, 20, "createdAt", "DESC");

    assertThat(result.items()).hasSize(1);
    assertThat(result.items().get(0).canonicalName()).isEqualTo("Alice Smith");
  }

  @Test
  @DisplayName("getEntityById returns entity details and provenance")
  void getEntityByIdFound() {
    UUID id = UUID.randomUUID();
    GoldenRecord gr = GoldenRecord.newStandalone();
    gr.getProperties().put("canonical_name", "John Doe");
    gr.getProperties().put("entity_type", "Person");
    gr.getProperties().put("email", "john@example.com");

    ProvenanceEntry pe =
        new ProvenanceEntry(UUID.randomUUID(), "email", UUID.randomUUID(), Instant.now(), "MERGE");
    gr.getProvenance().add(pe);

    when(goldenRecordRepository.findById(id)).thenReturn(Optional.of(gr));

    EntityDetailDto.Response result = service.getEntityById(id);

    assertThat(result.canonicalName()).isEqualTo("John Doe");
    assertThat(result.entityType()).isEqualTo("Person");
    assertThat(result.properties()).containsEntry("email", "john@example.com");
    assertThat(result.provenance()).hasSize(1);
    assertThat(result.provenance().get(0).fieldName()).isEqualTo("email");
  }

  @Test
  @DisplayName("getEntityById throws ResourceNotFoundException when missing")
  void getEntityByIdNotFound() {
    UUID id = UUID.randomUUID();
    when(goldenRecordRepository.findById(id)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.getEntityById(id))
        .isInstanceOf(ResourceNotFoundException.class);
  }

  @Test
  @DisplayName("getProvenance filters by property name")
  void getProvenanceFiltersByProperty() {
    UUID id = UUID.randomUUID();
    GoldenRecord gr = GoldenRecord.newStandalone();
    gr.getProvenance()
        .add(
            new ProvenanceEntry(
                UUID.randomUUID(), "email", UUID.randomUUID(), Instant.now(), "MERGE"));
    gr.getProvenance()
        .add(
            new ProvenanceEntry(
                UUID.randomUUID(), "phone", UUID.randomUUID(), Instant.now(), "MERGE"));

    when(goldenRecordRepository.findById(id)).thenReturn(Optional.of(gr));

    List<ProvenanceItem> prov = service.getProvenance(id, "email");

    assertThat(prov).hasSize(1);
    assertThat(prov.get(0).fieldName()).isEqualTo("email");
  }

  @Test
  @DisplayName("search uses db pushdown cleanly, preserves sourceCount, and avoids fake facets")
  void searchDbPushdownAndFacets() {
    GoldenRecord gr = GoldenRecord.newStandalone();
    gr.setCanonicalName("Luminex Logistics");
    gr.setEntityType("Organization");
    gr.setConfidenceScore(BigDecimal.valueOf(0.96));
    gr.setSourceCount(3);
    gr.getProperties().put("country", "US");

    when(goldenRecordRepository.countByEntityType())
        .thenReturn(List.<Object[]>of(new Object[] {"Organization", 1L}));
    when(goldenRecordRepository.searchByPropertiesAndType(eq(""), isNull(), any(Pageable.class)))
        .thenReturn(new PageImpl<>(List.of(gr), PageRequest.of(0, 12), 1));

    SearchResponseDto.Response result = service.search("", null, 0, 12, "createdAt", "DESC");

    assertThat(result.items()).hasSize(1);
    assertThat(result.items().get(0).sourceCount()).isEqualTo(3);
    assertThat(result.facets()).containsOnlyKeys("entityTypes");
    assertThat(result.facets().get("entityTypes")).containsEntry("Organization", 1L);
  }

  @Test
  @DisplayName(
      "fallback search paginated items use ArrayList (not ArrayList$SubList) and handle null properties")
  void searchFallbackPaginationUsesSerializableList() {
    GoldenRecord gr1 = GoldenRecord.newStandalone();
    gr1.setCanonicalName("Unnamed Entity");
    gr1.setEntityType("Organization");
    gr1.setConfidenceScore(BigDecimal.valueOf(0.70));
    gr1.getProperties().put("name", null);
    gr1.getProperties().put("company_name", "Alpha Freight");

    GoldenRecord gr2 = GoldenRecord.newStandalone();
    gr2.setCanonicalName("Beta Freight");
    gr2.setEntityType("Organization");
    gr2.setConfidenceScore(BigDecimal.valueOf(0.75));

    when(goldenRecordRepository.findAll()).thenReturn(List.of(gr1, gr2));

    SearchResponseDto.Response reviewPage =
        service.search("", null, null, null, true, 0, 1, "canonicalName", "ASC");
    assertThat(reviewPage.items()).hasSize(1);
    assertThat(reviewPage.items().getClass()).isEqualTo(ArrayList.class);
    assertThat(reviewPage.items().get(0).canonicalName()).isEqualTo("Alpha Freight");
    assertThat(reviewPage.total()).isEqualTo(2);
  }
}
