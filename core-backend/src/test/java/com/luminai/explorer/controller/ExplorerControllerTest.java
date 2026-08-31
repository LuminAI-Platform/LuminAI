package com.luminai.explorer.controller;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.luminai.common.exception.GlobalExceptionHandler;
import com.luminai.common.exception.ResourceNotFoundException;
import com.luminai.explorer.dto.EntityDetailDto;
import com.luminai.explorer.dto.ProvenanceItem;
import com.luminai.explorer.dto.SearchResponseDto;
import com.luminai.explorer.service.ExplorerSearchService;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class ExplorerControllerTest {

  @Mock private ExplorerSearchService searchService;

  @InjectMocks private ExplorerController controller;

  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc =
        MockMvcBuilders.standaloneSetup(controller)
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  @DisplayName("GET /api/v1/explorer/search returns 200 OK with results and facets")
  void searchSuccess() throws Exception {
    SearchResponseDto.SearchItem item =
        new SearchResponseDto.SearchItem(
            UUID.randomUUID(),
            "Acme Corp",
            "Company",
            0.98,
            2,
            Map.of("revenue", "$10M"),
            Instant.now(),
            Instant.now(),
            null);

    SearchResponseDto.Response response =
        new SearchResponseDto.Response(
            List.of(item), 1, 0, 20, Map.of("entityTypes", Map.of("Company", 1L)));

    when(searchService.search(anyString(), any(), anyInt(), anyInt(), anyString(), anyString()))
        .thenReturn(response);

    mockMvc
        .perform(get("/api/v1/explorer/search").param("query", "Acme"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].canonicalName").value("Acme Corp"))
        .andExpect(jsonPath("$.total").value(1))
        .andExpect(jsonPath("$.facets.entityTypes.Company").value(1));
  }

  @Test
  @DisplayName("GET /api/v1/explorer/entities/{id} returns 200 OK with entity detail")
  void getEntityByIdSuccess() throws Exception {
    UUID id = UUID.randomUUID();
    EntityDetailDto.Response response =
        new EntityDetailDto.Response(
            id,
            "John Doe",
            "Person",
            0.95,
            1,
            Map.of("title", "VP"),
            Instant.now(),
            Instant.now(),
            Set.of(UUID.randomUUID()),
            List.of());

    when(searchService.getEntityById(id)).thenReturn(response);

    mockMvc
        .perform(get("/api/v1/explorer/entities/{id}", id))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.canonicalName").value("John Doe"))
        .andExpect(jsonPath("$.entityType").value("Person"));
  }

  @Test
  @DisplayName("GET /api/v1/explorer/entities/{id} returns 404 when not found")
  void getEntityByIdNotFound() throws Exception {
    UUID id = UUID.randomUUID();
    when(searchService.getEntityById(id)).thenThrow(new ResourceNotFoundException("Entity", id));

    mockMvc.perform(get("/api/v1/explorer/entities/{id}", id)).andExpect(status().isNotFound());
  }

  @Test
  @DisplayName("GET /api/v1/explorer/entities/{id}/provenance returns 200 OK")
  void getProvenanceSuccess() throws Exception {
    UUID id = UUID.randomUUID();
    ProvenanceItem prov =
        new ProvenanceItem(
            "email", UUID.randomUUID(), "Salesforce", "john@example.com", "MERGE", Instant.now());

    when(searchService.getProvenance(eq(id), any())).thenReturn(List.of(prov));

    mockMvc
        .perform(get("/api/v1/explorer/entities/{id}/provenance", id))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].fieldName").value("email"))
        .andExpect(jsonPath("$[0].contributedValue").value("john@example.com"));
  }
}
