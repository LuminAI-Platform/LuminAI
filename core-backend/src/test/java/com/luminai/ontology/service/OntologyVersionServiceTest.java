package com.luminai.ontology.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.luminai.common.exception.ConflictException;
import com.luminai.common.security.JwtClaimsExtractor;
import com.luminai.ontology.dto.OntologyVersionDto;
import com.luminai.ontology.model.EntityType;
import com.luminai.ontology.model.OntologyVersion;
import com.luminai.ontology.model.RelationshipType;
import com.luminai.ontology.repository.EntityTypeRepository;
import com.luminai.ontology.repository.OntologyVersionRepository;
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
class OntologyVersionServiceTest {

  @Mock private OntologyVersionRepository repository;
  @Mock private EntityTypeRepository entityTypeRepository;
  @Mock private RelationshipTypeRepository relationshipTypeRepository;
  @Mock private JwtClaimsExtractor claimsExtractor;

  private OntologyVersionService service;
  private final UUID tenantId = UUID.randomUUID();

  @BeforeEach
  void setUp() {
    service =
        new OntologyVersionService(
            repository, entityTypeRepository, relationshipTypeRepository, claimsExtractor);
    lenient().when(claimsExtractor.getCurrentTenantId()).thenReturn(tenantId.toString());
  }

  @Test
  @DisplayName("getAll returns versions for tenant")
  void getAllReturnsList() {
    OntologyVersion v1 =
        new OntologyVersion(
            tenantId, "v1.0.0", OntologyVersion.Status.PUBLISHED, "Initial schema", null);

    when(repository.findAllByTenantIdOrderByCreatedAtDesc(tenantId)).thenReturn(List.of(v1));

    List<OntologyVersionDto.Response> result = service.getAll();

    assertThat(result).hasSize(1);
    assertThat(result.get(0).version()).isEqualTo("v1.0.0");
  }

  @Test
  @DisplayName("publishVersion generates schema snapshot and links entity types")
  void publishVersionSuccess() {
    EntityType e1 =
        new EntityType(tenantId, null, "Person", "Person", "#3b82f6", "user", "A person", "{}");
    RelationshipType r1 =
        new RelationshipType(
            tenantId,
            null,
            "KNOWS",
            "Social",
            UUID.randomUUID(),
            UUID.randomUUID(),
            RelationshipType.Cardinality.MANY_TO_MANY,
            "{}");

    when(repository.findByTenantIdAndVersion(tenantId, "v1.0.0")).thenReturn(Optional.empty());
    when(entityTypeRepository.findAllByTenantIdOrderByNameAsc(tenantId)).thenReturn(List.of(e1));
    when(relationshipTypeRepository.findAllByTenantIdOrderByNameAsc(tenantId))
        .thenReturn(List.of(r1));
    when(repository.save(any(OntologyVersion.class))).thenAnswer(inv -> inv.getArgument(0));

    OntologyVersionDto.CreateRequest request =
        new OntologyVersionDto.CreateRequest("v1.0.0", "Release 1.0");

    OntologyVersionDto.Response result = service.publishVersion(request);

    assertThat(result.version()).isEqualTo("v1.0.0");
    assertThat(result.status()).isEqualTo(OntologyVersion.Status.PUBLISHED);
    assertThat(result.schemaSnapshot()).contains("Person");
    assertThat(result.schemaSnapshot()).contains("KNOWS");

    verify(entityTypeRepository).save(e1);
    verify(relationshipTypeRepository).save(r1);
  }

  @Test
  @DisplayName("publishVersion throws ConflictException if version already exists")
  void publishDuplicateVersionThrows() {
    OntologyVersion existing =
        new OntologyVersion(tenantId, "v1.0.0", OntologyVersion.Status.PUBLISHED, "Old", null);
    when(repository.findByTenantIdAndVersion(tenantId, "v1.0.0")).thenReturn(Optional.of(existing));

    OntologyVersionDto.CreateRequest request =
        new OntologyVersionDto.CreateRequest("v1.0.0", "Duplicate version");

    assertThatThrownBy(() -> service.publishVersion(request))
        .isInstanceOf(ConflictException.class)
        .hasMessageContaining("already exists");
  }

  @Test
  @DisplayName("getVersionDiff compares snapshots accurately")
  void getVersionDiffSuccess() {
    UUID v2Id = UUID.randomUUID();
    OntologyVersion v2 =
        new OntologyVersion(tenantId, "v2.0.0", OntologyVersion.Status.PUBLISHED, "V2", null);
    v2.setSchemaSnapshot(
        "{\"entityTypes\":[{\"name\":\"Person\"},{\"name\":\"Organization\"}],\"relationshipTypes\":[]}");

    OntologyVersion v1 =
        new OntologyVersion(tenantId, "v1.0.0", OntologyVersion.Status.PUBLISHED, "V1", null);
    v1.setSchemaSnapshot("{\"entityTypes\":[{\"name\":\"Person\"}],\"relationshipTypes\":[]}");

    // Mock reflection on ID
    try {
      var idField = OntologyVersion.class.getDeclaredField("id");
      idField.setAccessible(true);
      idField.set(v2, v2Id);
      idField.set(v1, UUID.randomUUID());
    } catch (Exception e) {
      throw new RuntimeException(e);
    }

    when(repository.findByIdAndTenantId(v2Id, tenantId)).thenReturn(Optional.of(v2));
    when(repository.findAllByTenantIdOrderByCreatedAtDesc(tenantId)).thenReturn(List.of(v2, v1));

    OntologyVersionDto.DiffResponse diff = service.getVersionDiff(v2Id);

    assertThat(diff.currentVersion()).isEqualTo("v2.0.0");
    assertThat(diff.previousVersion()).isEqualTo("v1.0.0");
    assertThat(diff.addedEntityTypes()).containsExactly("Organization");
    assertThat(diff.removedEntityTypes()).isEmpty();
  }
}
