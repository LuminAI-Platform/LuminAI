package com.luminai.ontology.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.luminai.common.exception.ConflictException;
import com.luminai.common.exception.ResourceNotFoundException;
import com.luminai.common.security.JwtClaimsExtractor;
import com.luminai.ontology.dto.EntityTypeDto;
import com.luminai.ontology.model.EntityType;
import com.luminai.ontology.repository.EntityTypeRepository;
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
class EntityTypeServiceTest {

  @Mock private EntityTypeRepository repository;
  @Mock private JwtClaimsExtractor claimsExtractor;

  private EntityTypeService service;
  private final UUID tenantId = UUID.randomUUID();

  @BeforeEach
  void setUp() {
    service = new EntityTypeService(repository, claimsExtractor);
    lenient().when(claimsExtractor.getCurrentTenantId()).thenReturn(tenantId.toString());
  }

  @Test
  @DisplayName("getAll returns list of entity types for tenant")
  void getAllReturnsList() {
    EntityType e1 =
        new EntityType(tenantId, null, "Person", "Person", "#3b82f6", "user", "A person", "{}");
    EntityType e2 =
        new EntityType(
            tenantId, null, "Company", "Company", "#10b981", "building", "A business", "{}");
    when(repository.findAllByTenantIdOrderByNameAsc(tenantId)).thenReturn(List.of(e1, e2));

    List<EntityTypeDto.Response> result = service.getAll();

    assertThat(result).hasSize(2);
    assertThat(result.get(0).name()).isEqualTo("Person");
    assertThat(result.get(1).name()).isEqualTo("Company");
  }

  @Test
  @DisplayName("getById returns entity type when found")
  void getByIdFound() {
    UUID id = UUID.randomUUID();
    EntityType entity =
        new EntityType(tenantId, null, "Person", "Person", "#3b82f6", "user", "Desc", "{}");
    when(repository.findByIdAndTenantId(id, tenantId)).thenReturn(Optional.of(entity));

    EntityTypeDto.Response result = service.getById(id);

    assertThat(result).isNotNull();
    assertThat(result.name()).isEqualTo("Person");
  }

  @Test
  @DisplayName("getById throws ResourceNotFoundException when not found")
  void getByIdNotFound() {
    UUID id = UUID.randomUUID();
    when(repository.findByIdAndTenantId(id, tenantId)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.getById(id)).isInstanceOf(ResourceNotFoundException.class);
  }

  @Test
  @DisplayName("create saves new entity type and serializes properties")
  void createSuccess() {
    EntityTypeDto.CreateRequest request =
        new EntityTypeDto.CreateRequest(
            "Customer",
            "Customer Entity",
            "#f59e0b",
            "user-check",
            "Customer profile",
            List.of(
                new EntityTypeDto.PropertyDefinition(
                    "email", "string", true, null, "Customer email"),
                new EntityTypeDto.PropertyDefinition("age", "number", false, 18, "Age in years")),
            null);

    when(repository.existsByNameIgnoreCaseAndTenantId("Customer", tenantId)).thenReturn(false);
    when(repository.save(any(EntityType.class))).thenAnswer(inv -> inv.getArgument(0));

    EntityTypeDto.Response result = service.create(request);

    assertThat(result.name()).isEqualTo("Customer");
    assertThat(result.label()).isEqualTo("Customer Entity");
    assertThat(result.color()).isEqualTo("#f59e0b");
    assertThat(result.propertiesSchema()).contains("email");
    assertThat(result.propertiesSchema()).contains("required");
  }

  @Test
  @DisplayName("create throws ConflictException if name already exists")
  void createDuplicateNameThrows() {
    EntityTypeDto.CreateRequest request =
        new EntityTypeDto.CreateRequest("Person", "Person", null, null, null, null, null);

    when(repository.existsByNameIgnoreCaseAndTenantId("Person", tenantId)).thenReturn(true);

    assertThatThrownBy(() -> service.create(request))
        .isInstanceOf(ConflictException.class)
        .hasMessageContaining("already exists");
  }

  @Test
  @DisplayName("update updates existing entity type")
  void updateSuccess() {
    UUID id = UUID.randomUUID();
    EntityType existing =
        new EntityType(tenantId, null, "Person", "Person", "#3b82f6", "user", "Old desc", "{}");
    when(repository.findByIdAndTenantId(id, tenantId)).thenReturn(Optional.of(existing));
    when(repository.save(any(EntityType.class))).thenAnswer(inv -> inv.getArgument(0));

    EntityTypeDto.UpdateRequest request =
        new EntityTypeDto.UpdateRequest(
            "Person", "Individual", "#ec4899", "smile", "New desc", null, null);

    EntityTypeDto.Response result = service.update(id, request);

    assertThat(result.label()).isEqualTo("Individual");
    assertThat(result.color()).isEqualTo("#ec4899");
    assertThat(result.icon()).isEqualTo("smile");
    assertThat(result.description()).isEqualTo("New desc");
  }

  @Test
  @DisplayName("delete removes entity type by ID")
  void deleteSuccess() {
    UUID id = UUID.randomUUID();
    when(repository.deleteByIdAndTenantId(id, tenantId)).thenReturn(1L);

    service.delete(id);

    verify(repository).deleteByIdAndTenantId(id, tenantId);
  }

  @Test
  @DisplayName("delete throws ResourceNotFoundException if ID doesn't exist")
  void deleteNotFoundThrows() {
    UUID id = UUID.randomUUID();
    when(repository.deleteByIdAndTenantId(id, tenantId)).thenReturn(0L);

    assertThatThrownBy(() -> service.delete(id)).isInstanceOf(ResourceNotFoundException.class);
  }
}
