package com.luminai.connection;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.verify;
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
import com.luminai.connection.repository.GoldenRecordRepository;
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
  @Mock private com.luminai.connection.service.PostgresConnectorService postgresConnectorService;
  @Mock private GoldenRecordRepository goldenRecordRepository;
  @Mock private com.luminai.connection.repository.ConnectionRepository connectionRepository;
  @org.mockito.Spy private ObjectMapper objectMapper = new ObjectMapper();

  @InjectMocks private ConnectionController controller;

  private MockMvc mockMvc;

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

  @Test
  @DisplayName("POST /api/v1/connections/{id}/upload parses files > 1000 rows without truncation")
  void uploadLargeFileWithoutTruncation() throws Exception {
    UUID connId = UUID.randomUUID();
    StringBuilder sb = new StringBuilder("id,name\n");
    for (int i = 1; i <= 1500; i++) {
      sb.append(i).append(",User_").append(i).append("\n");
    }
    MockMultipartFile file =
        new MockMultipartFile("file", "large_dataset.csv", "text/csv", sb.toString().getBytes());

    when(fileConnectorService.ingest(any(), eq(connId), any()))
        .thenReturn("tenant/raw/" + connId + "/large_dataset.csv");

    mockMvc
        .perform(multipart("/api/v1/connections/" + connId + "/upload").file(file))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("INGESTED"))
        .andExpect(jsonPath("$.fileName").value("large_dataset.csv"))
        .andExpect(jsonPath("$.recordsCount").value(1500));
  }

  @Test
  @DisplayName("POST /api/v1/connections/{id}/upload extracts multi-table ZIP archive")
  void uploadZipArchiveExtractsMultipleTables() throws Exception {
    UUID connId = UUID.randomUUID();

    // Create in-memory zip archive with two CSV files
    java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
    try (java.util.zip.ZipOutputStream zos = new java.util.zip.ZipOutputStream(baos)) {
      zos.putNextEntry(new java.util.zip.ZipEntry("orders.csv"));
      zos.write(
          "order_id,customer_id\no-1,c-1\no-2,c-2\n"
              .getBytes(java.nio.charset.StandardCharsets.UTF_8));
      zos.closeEntry();

      zos.putNextEntry(new java.util.zip.ZipEntry("customers.csv"));
      zos.write(
          "customer_id,name\nc-1,Alice\nc-2,Bob\n"
              .getBytes(java.nio.charset.StandardCharsets.UTF_8));
      zos.closeEntry();
    }

    MockMultipartFile zipFile =
        new MockMultipartFile("file", "olist_archive.zip", "application/zip", baos.toByteArray());

    when(fileConnectorService.ingest(any(), eq(connId), any()))
        .thenReturn("tenant/raw/" + connId + "/olist_archive.zip");
    when(fileConnectorService.ingestBytes(any(), eq(connId), any(), any(), any()))
        .thenAnswer(inv -> "tenant/raw/" + connId + "/" + inv.getArgument(2));

    mockMvc
        .perform(multipart("/api/v1/connections/" + connId + "/upload").file(zipFile))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("INGESTED"))
        .andExpect(jsonPath("$.archive").value(true))
        .andExpect(jsonPath("$.filesProcessed").value(2))
        .andExpect(jsonPath("$.recordsCount").value(4))
        .andExpect(jsonPath("$.tables.length()").value(2));

    verify(connectionProducer, atLeastOnce())
        .publishRows(any(), eq(connId), eq("orders.csv"), any(), anyBoolean(), any());
    verify(connectionProducer, atLeastOnce())
        .publishRows(any(), eq(connId), eq("customers.csv"), any(), anyBoolean(), any());
  }
}
