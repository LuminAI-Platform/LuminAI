package com.luminai.ontology.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.luminai.common.exception.GlobalExceptionHandler;
import com.luminai.ontology.dto.EntityTypeDto;
import com.luminai.ontology.dto.OntologyVersionDto;
import com.luminai.ontology.dto.RelationshipTypeDto;
import com.luminai.ontology.model.OntologyVersion;
import com.luminai.ontology.model.RelationshipType;
import com.luminai.ontology.service.EntityTypeService;
import com.luminai.ontology.service.OntologyVersionService;
import com.luminai.ontology.service.RelationshipTypeService;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class OntologyControllerTest {

  @Mock private EntityTypeService entityTypeService;
  @Mock private RelationshipTypeService relationshipTypeService;
  @Mock private OntologyVersionService ontologyVersionService;

  @InjectMocks private OntologyController controller;

  private MockMvc mockMvc;
  private final ObjectMapper objectMapper = new ObjectMapper();

  @BeforeEach
  void setUp() {
    mockMvc =
        MockMvcBuilders.standaloneSetup(controller)
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  @DisplayName("GET /api/v1/ontology/entity-types returns 200 OK with list")
  void getAllEntityTypesSuccess() throws Exception {
    EntityTypeDto.Response response =
        new EntityTypeDto.Response(
            UUID.randomUUID(),
            UUID.randomUUID(),
            null,
            "Person",
            "Person",
            "#3b82f6",
            "user",
            "A person",
            "{}",
            Instant.now(),
            Instant.now());

    when(entityTypeService.getAll()).thenReturn(List.of(response));

    mockMvc
        .perform(get("/api/v1/ontology/entity-types"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].name").value("Person"))
        .andExpect(jsonPath("$[0].color").value("#3b82f6"));
  }

  @Test
  @DisplayName("POST /api/v1/ontology/entity-types returns 201 Created")
  void createEntityTypeSuccess() throws Exception {
    EntityTypeDto.CreateRequest request =
        new EntityTypeDto.CreateRequest(
            "Company", "Company", "#10b981", "building", "Corporate entity", null, null);

    EntityTypeDto.Response response =
        new EntityTypeDto.Response(
            UUID.randomUUID(),
            UUID.randomUUID(),
            null,
            "Company",
            "Company",
            "#10b981",
            "building",
            "Corporate entity",
            "{}",
            Instant.now(),
            Instant.now());

    when(entityTypeService.create(any(EntityTypeDto.CreateRequest.class))).thenReturn(response);

    mockMvc
        .perform(
            post("/api/v1/ontology/entity-types")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.name").value("Company"))
        .andExpect(jsonPath("$.icon").value("building"));
  }

  @Test
  @DisplayName("POST /api/v1/ontology/entity-types returns 400 Bad Request on invalid name")
  void createEntityTypeInvalidNameReturns400() throws Exception {
    // Name with invalid characters or blank
    EntityTypeDto.CreateRequest request =
        new EntityTypeDto.CreateRequest("", "Label", null, null, null, null, null);

    mockMvc
        .perform(
            post("/api/v1/ontology/entity-types")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isBadRequest());
  }

  @Test
  @DisplayName("DELETE /api/v1/ontology/entity-types/{id} returns 204 No Content")
  void deleteEntityTypeSuccess() throws Exception {
    UUID id = UUID.randomUUID();
    doNothing().when(entityTypeService).delete(id);

    mockMvc
        .perform(delete("/api/v1/ontology/entity-types/{id}", id))
        .andExpect(status().isNoContent());

    verify(entityTypeService).delete(id);
  }

  @Test
  @DisplayName("GET /api/v1/ontology/relationship-types returns 200 OK")
  void getAllRelationshipTypesSuccess() throws Exception {
    RelationshipTypeDto.Response response =
        new RelationshipTypeDto.Response(
            UUID.randomUUID(),
            UUID.randomUUID(),
            null,
            "EMPLOYED_BY",
            "Employment",
            UUID.randomUUID(),
            UUID.randomUUID(),
            RelationshipType.Cardinality.MANY_TO_ONE,
            "{}",
            Instant.now(),
            Instant.now());

    when(relationshipTypeService.getAll()).thenReturn(List.of(response));

    mockMvc
        .perform(get("/api/v1/ontology/relationship-types"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].name").value("EMPLOYED_BY"))
        .andExpect(jsonPath("$[0].cardinality").value("MANY_TO_ONE"));
  }

  @Test
  @DisplayName("POST /api/v1/ontology/relationship-types returns 201 Created")
  void createRelationshipTypeSuccess() throws Exception {
    UUID sourceId = UUID.randomUUID();
    UUID targetId = UUID.randomUUID();
    RelationshipTypeDto.CreateRequest request =
        new RelationshipTypeDto.CreateRequest(
            "OWNS",
            "Ownership",
            sourceId,
            targetId,
            RelationshipType.Cardinality.ONE_TO_MANY,
            null);

    RelationshipTypeDto.Response response =
        new RelationshipTypeDto.Response(
            UUID.randomUUID(),
            UUID.randomUUID(),
            null,
            "OWNS",
            "Ownership",
            sourceId,
            targetId,
            RelationshipType.Cardinality.ONE_TO_MANY,
            "{}",
            Instant.now(),
            Instant.now());

    when(relationshipTypeService.create(any(RelationshipTypeDto.CreateRequest.class)))
        .thenReturn(response);

    mockMvc
        .perform(
            post("/api/v1/ontology/relationship-types")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.name").value("OWNS"));
  }

  @Test
  @DisplayName("POST /api/v1/ontology/versions returns 201 Created")
  void publishVersionSuccess() throws Exception {
    OntologyVersionDto.CreateRequest request =
        new OntologyVersionDto.CreateRequest("v1.0.0", "Initial publish");

    OntologyVersionDto.Response response =
        new OntologyVersionDto.Response(
            UUID.randomUUID(),
            UUID.randomUUID(),
            "v1.0.0",
            OntologyVersion.Status.PUBLISHED,
            "Initial publish",
            "{}",
            UUID.randomUUID(),
            Instant.now(),
            Instant.now());

    when(ontologyVersionService.publishVersion(any(OntologyVersionDto.CreateRequest.class)))
        .thenReturn(response);

    mockMvc
        .perform(
            post("/api/v1/ontology/versions")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.version").value("v1.0.0"))
        .andExpect(jsonPath("$.status").value("PUBLISHED"));
  }

  @Test
  @DisplayName("GET /api/v1/ontology/versions/{id}/diff returns 200 OK")
  void getVersionDiffSuccess() throws Exception {
    UUID id = UUID.randomUUID();
    OntologyVersionDto.DiffResponse diff =
        new OntologyVersionDto.DiffResponse(
            "v2.0.0",
            "v1.0.0",
            List.of("Supplier"),
            List.of(),
            List.of(),
            List.of("SUPPLIES"),
            List.of());

    when(ontologyVersionService.getVersionDiff(id)).thenReturn(diff);

    mockMvc
        .perform(get("/api/v1/ontology/versions/{id}/diff", id))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.currentVersion").value("v2.0.0"))
        .andExpect(jsonPath("$.addedEntityTypes[0]").value("Supplier"));
  }
}
