package com.luminai.audit.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.luminai.audit.dto.AuditLogDto;
import com.luminai.audit.service.AuditService;
import com.luminai.common.security.JwtClaimsExtractor;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class AuditControllerTest {

  private MockMvc mockMvc;
  private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

  @Mock private AuditService auditService;
  @Mock private JwtClaimsExtractor claimsExtractor;

  private AuditController controller;

  @BeforeEach
  void setUp() {
    controller = new AuditController(auditService, claimsExtractor);
    mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
  }

  @Test
  @DisplayName("GET /api/v1/audit returns paginated audit log responses")
  void getAuditLogsSuccess() throws Exception {
    UUID id = UUID.randomUUID();
    UUID tenantId = UUID.randomUUID();
    UUID userId = UUID.randomUUID();

    AuditLogDto.Response item =
        new AuditLogDto.Response(
            id,
            tenantId,
            userId,
            "MERGE_ENTITIES",
            "GoldenRecord",
            UUID.randomUUID(),
            "{\"accepted\":true}",
            "127.0.0.1",
            Instant.now());

    when(auditService.getAuditLogs(eq("MERGE_ENTITIES"), any(), any()))
        .thenReturn(new PageImpl<>(List.of(item), PageRequest.of(0, 20), 1));

    mockMvc
        .perform(get("/api/v1/audit").param("action", "MERGE_ENTITIES"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].action").value("MERGE_ENTITIES"))
        .andExpect(jsonPath("$.content[0].resourceType").value("GoldenRecord"))
        .andExpect(jsonPath("$.totalElements").value(1));
  }

  @Test
  @DisplayName("POST /api/v1/audit records manual audit event")
  void recordAuditEventSuccess() throws Exception {
    UUID id = UUID.randomUUID();
    UUID tenantId = UUID.randomUUID();
    UUID userId = UUID.randomUUID();

    AuditLogDto.CreateRequest request =
        new AuditLogDto.CreateRequest(
            "EXPORT_DATA", "GoldenRecord", UUID.randomUUID(), "{\"format\":\"csv\"}", "127.0.0.1");

    AuditLogDto.Response item =
        new AuditLogDto.Response(
            id,
            tenantId,
            userId,
            "EXPORT_DATA",
            "GoldenRecord",
            request.resourceId(),
            request.changes(),
            "127.0.0.1",
            Instant.now());

    when(claimsExtractor.getCurrentUserId()).thenReturn(userId.toString());
    when(auditService.recordEvent(
            any(), eq("EXPORT_DATA"), eq("GoldenRecord"), any(), any(), any()))
        .thenReturn(item);

    mockMvc
        .perform(
            post("/api/v1/audit")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.action").value("EXPORT_DATA"));
  }
}
