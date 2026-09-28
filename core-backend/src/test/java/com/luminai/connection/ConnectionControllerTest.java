package com.luminai.connection;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.luminai.common.exception.GlobalExceptionHandler;
import com.luminai.common.exception.ResourceNotFoundException;
import com.luminai.connection.controller.ConnectionController;
import com.luminai.connection.dto.ConnectionDto;
import com.luminai.connection.model.Connection;
import com.luminai.connection.producer.ConnectionProducer;
import com.luminai.connection.repository.ConnectionPreviewService;
import com.luminai.connection.service.ConnectionService;
import com.luminai.connection.service.FileConnectorService;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class ConnectionControllerTest {

  @Mock private ConnectionService connectionService;
  @Mock private ConnectionPreviewService connectionPreviewService;
  @Mock private FileConnectorService fileConnectorService;
  @Mock private ConnectionProducer connectionProducer;

  @InjectMocks private ConnectionController controller;

  private MockMvc mockMvc;
  private ObjectMapper objectMapper;

  @BeforeEach
  void setUp() {
    mockMvc =
        MockMvcBuilders.standaloneSetup(controller)
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
    objectMapper = new ObjectMapper();
  }

  @Test
  @DisplayName("POST /api/v1/connections creates a new data connection and returns 201 Created")
  void createConnectionSuccess() throws Exception {
    UUID connId = UUID.randomUUID();
    UUID tenantId = UUID.randomUUID();

    ConnectionDto.CreateRequest request =
        new ConnectionDto.CreateRequest(
            "PostgreSQL Prod", Connection.Type.POSTGRESQL, "{}", "creds/pg");

    ConnectionDto.Response response =
        new ConnectionDto.Response(
            connId,
            tenantId,
            "PostgreSQL Prod",
            Connection.Type.POSTGRESQL,
            "{}",
            "creds/pg",
            Connection.Status.ACTIVE,
            Instant.now(),
            UUID.randomUUID(),
            Instant.now(),
            Instant.now());

    when(connectionService.create(any(ConnectionDto.CreateRequest.class))).thenReturn(response);

    mockMvc
        .perform(
            post("/api/v1/connections")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").value(connId.toString()))
        .andExpect(jsonPath("$.name").value("PostgreSQL Prod"))
        .andExpect(jsonPath("$.status").value("ACTIVE"));
  }

  @Test
  @DisplayName("GET /api/v1/connections returns all connections for the authenticated tenant")
  void getAllConnectionsSuccess() throws Exception {
    UUID connId = UUID.randomUUID();
    ConnectionDto.Response conn =
        new ConnectionDto.Response(
            connId,
            UUID.randomUUID(),
            "MySQL Analytics",
            Connection.Type.MYSQL,
            "{}",
            "creds/mysql",
            Connection.Status.ACTIVE,
            null,
            UUID.randomUUID(),
            Instant.now(),
            Instant.now());

    when(connectionService.getAllForTenant()).thenReturn(List.of(conn));

    mockMvc
        .perform(get("/api/v1/connections"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1))
        .andExpect(jsonPath("$[0].name").value("MySQL Analytics"));
  }

  @Test
  @DisplayName("GET /api/v1/connections/{id} returns 200 with connection details")
  void getByIdSuccess() throws Exception {
    UUID connId = UUID.randomUUID();
    ConnectionDto.Response conn =
        new ConnectionDto.Response(
            connId,
            UUID.randomUUID(),
            "External REST API",
            Connection.Type.API,
            "{}",
            "creds/api",
            Connection.Status.ACTIVE,
            null,
            UUID.randomUUID(),
            Instant.now(),
            Instant.now());

    when(connectionService.getById(connId)).thenReturn(conn);

    mockMvc
        .perform(get("/api/v1/connections/" + connId))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(connId.toString()))
        .andExpect(jsonPath("$.name").value("External REST API"));
  }

  @Test
  @DisplayName("GET /api/v1/connections/{id} returns 404 when connection does not exist")
  void getByIdNotFound() throws Exception {
    UUID connId = UUID.randomUUID();
    when(connectionService.getById(connId))
        .thenThrow(new ResourceNotFoundException("Connection", connId.toString()));

    mockMvc
        .perform(get("/api/v1/connections/" + connId))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.error").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("PUT /api/v1/connections/{id} updates connection and returns 200 OK")
  void updateConnectionSuccess() throws Exception {
    UUID connId = UUID.randomUUID();
    ConnectionDto.UpdateRequest updateReq =
        new ConnectionDto.UpdateRequest("Updated PG", "{}", "creds/new", Connection.Status.ACTIVE);

    ConnectionDto.Response updatedResp =
        new ConnectionDto.Response(
            connId,
            UUID.randomUUID(),
            "Updated PG",
            Connection.Type.POSTGRESQL,
            "{}",
            "creds/new",
            Connection.Status.ACTIVE,
            null,
            UUID.randomUUID(),
            Instant.now(),
            Instant.now());

    when(connectionService.update(eq(connId), any(ConnectionDto.UpdateRequest.class)))
        .thenReturn(updatedResp);

    mockMvc
        .perform(
            put("/api/v1/connections/" + connId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(updateReq)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Updated PG"));
  }

  @Test
  @DisplayName("DELETE /api/v1/connections/{id} removes connection and returns 204 No Content")
  void deleteConnectionSuccess() throws Exception {
    UUID connId = UUID.randomUUID();
    doNothing().when(connectionService).delete(connId);

    mockMvc.perform(delete("/api/v1/connections/" + connId)).andExpect(status().isNoContent());
  }

  @Test
  @DisplayName("GET /api/v1/connections/{id}/preview/file returns sample rows from uploaded file")
  void previewFileSuccess() throws Exception {
    UUID connId = UUID.randomUUID();
    List<Map<String, Object>> sampleRows =
        List.of(Map.of("id", "1", "name", "Alpha"), Map.of("id", "2", "name", "Beta"));

    when(connectionPreviewService.previewFile(connId)).thenReturn(sampleRows);

    mockMvc
        .perform(get("/api/v1/connections/" + connId + "/preview/file"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(2))
        .andExpect(jsonPath("$[0].name").value("Alpha"));
  }

  @Test
  @DisplayName("GET /api/v1/connections/{id}/preview/table returns sample rows from table")
  void previewTableSuccess() throws Exception {
    UUID connId = UUID.randomUUID();
    List<Map<String, Object>> sampleRows =
        List.of(Map.of("customer_id", 101, "email", "test@corp.com"));

    when(connectionPreviewService.previewTable(connId, "customers")).thenReturn(sampleRows);

    mockMvc
        .perform(get("/api/v1/connections/" + connId + "/preview/table?table=customers"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1))
        .andExpect(jsonPath("$[0].email").value("test@corp.com"));
  }

  @Test
  @DisplayName("POST /api/v1/connections/discover returns discovered schema catalog")
  void discoverSchemasSuccess() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/connections/discover")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"database\":\"production\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(2))
        .andExpect(jsonPath("$[0].schema").value("public"));
  }

  @Test
  @DisplayName("POST /api/v1/connections/{id}/upload ingests multipart file and publishes rows")
  void uploadFileSuccess() throws Exception {
    UUID connId = UUID.randomUUID();
    MockMultipartFile file =
        new MockMultipartFile(
            "file", "users.csv", "text/csv", "id,name\n1,Alice\n2,Bob".getBytes());

    when(fileConnectorService.ingest(any(), eq(connId), any()))
        .thenReturn("tenant/raw/" + connId + "/users.csv");

    mockMvc
        .perform(multipart("/api/v1/connections/" + connId + "/upload").file(file))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("INGESTED"))
        .andExpect(jsonPath("$.fileName").value("users.csv"))
        .andExpect(jsonPath("$.recordsCount").value(2));
  }
}
