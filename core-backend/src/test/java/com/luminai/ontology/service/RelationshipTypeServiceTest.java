package com.luminai.ontology.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.luminai.common.exception.ConflictException;
import com.luminai.common.exception.ResourceNotFoundException;
import com.luminai.common.security.JwtClaimsExtractor;
import com.luminai.ontology.dto.RelationshipTypeDto;
import com.luminai.ontology.model.EntityType;
import com.luminai.ontology.model.RelationshipType;
import com.luminai.ontology.repository.EntityTypeRepository;
import com.luminai.ontology.repository.RelationshipTypeRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class RelationshipTypeServiceTest {

  @Mock private RelationshipTypeRepository repository;
  @Mock private EntityTypeRepository entityTypeRepository;
  @Mock private JwtClaimsExtractor claimsExtractor;

  private RelationshipTypeService service;
  private final UUID tenantId = UUID.randomUUID();

  @BeforeEach
  void setUp() {
    service = new RelationshipTypeService(repository, entityTypeRepository, claimsExtractor);
    lenient().when(claimsExtractor.getCurrentTenantId()).thenReturn(tenantId.toString());
  }

  @Test
  @DisplayName("getAll returns relationship types for tenant")
  void getAllReturnsList() {
    UUID sourceId = UUID.randomUUID();
    UUID targetId = UUID.randomUUID();
    RelationshipType rt =
        new RelationshipType(
            tenantId,
            null,
            "EMPLOYED_BY",
            "Employment relation",
            sourceId,
            targetId,
            RelationshipType.Cardinality.MANY_TO_ONE,
            "{}");

    when(repository.findAllByTenantIdOrderByNameAsc(tenantId)).thenReturn(List.of(rt));

    List<RelationshipTypeDto.Response> result = service.getAll();

    assertThat(result).hasSize(1);
    assertThat(result.get(0).name()).isEqualTo("EMPLOYED_BY");
    assertThat(result.get(0).cardinality()).isEqualTo(RelationshipType.Cardinality.MANY_TO_ONE);
  }

  @Test
  @DisplayName("create validates source and target entity types existence")
  void createValidatesSourceAndTarget() {
    UUID sourceId = UUID.randomUUID();
    UUID targetId = UUID.randomUUID();
    RelationshipTypeDto.CreateRequest request =
        new RelationshipTypeDto.CreateRequest(
            "OWNS",
            "Ownership relation",
            sourceId,
            targetId,
            RelationshipType.Cardinality.ONE_TO_MANY,
            null);

    when(repository.existsByNameIgnoreCaseAndTenantId("OWNS", tenantId)).thenReturn(false);
    when(entityTypeRepository.findByIdAndTenantId(sourceId, tenantId)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.create(request))
        .isInstanceOf(ResourceNotFoundException.class)
        .hasMessageContaining("Source EntityType");
  }

  @Test
  @DisplayName("create saves relationship type when valid")
  void createSuccess() {
    UUID sourceId = UUID.randomUUID();
    UUID targetId = UUID.randomUUID();
    EntityType sourceEntity =
        new EntityType(tenantId, null, "Person", "Person", null, null, null, "{}");
    EntityType targetEntity =
        new EntityType(tenantId, null, "Company", "Company", null, null, null, "{}");

    RelationshipTypeDto.CreateRequest request =
        new RelationshipTypeDto.CreateRequest(
            "EMPLOYED_BY",
            "Employment relation",
            sourceId,
            targetId,
            RelationshipType.Cardinality.MANY_TO_ONE,
            null);

    when(repository.existsByNameIgnoreCaseAndTenantId("EMPLOYED_BY", tenantId)).thenReturn(false);
    when(entityTypeRepository.findByIdAndTenantId(sourceId, tenantId))
        .thenReturn(Optional.of(sourceEntity));
    when(entityTypeRepository.findByIdAndTenantId(targetId, tenantId))
        .thenReturn(Optional.of(targetEntity));
    when(repository.save(any(RelationshipType.class))).thenAnswer(inv -> inv.getArgument(0));

    RelationshipTypeDto.Response result = service.create(request);

    assertThat(result.name()).isEqualTo("EMPLOYED_BY");
    assertThat(result.sourceEntityTypeId()).isEqualTo(sourceId);
    assertThat(result.targetEntityTypeId()).isEqualTo(targetId);
  }

  @Test
  @DisplayName("create throws ConflictException on duplicate name")
  void createDuplicateNameThrows() {
    UUID sourceId = UUID.randomUUID();
    UUID targetId = UUID.randomUUID();
    RelationshipTypeDto.CreateRequest request =
        new RelationshipTypeDto.CreateRequest("OWNS", null, sourceId, targetId, null, null);

    when(repository.existsByNameIgnoreCaseAndTenantId("OWNS", tenantId)).thenReturn(true);

    assertThatThrownBy(() -> service.create(request))
        .isInstanceOf(ConflictException.class)
        .hasMessageContaining("already exists");
  }

  @Test
  @DisplayName("delete removes relationship type by ID")
  void deleteSuccess() {
    UUID id = UUID.randomUUID();
    when(repository.deleteByIdAndTenantId(id, tenantId)).thenReturn(1L);

    service.delete(id);

    verify(repository).deleteByIdAndTenantId(id, tenantId);
  }
}
