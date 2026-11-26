package com.luminai.connection.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luminai.common.tenant.TenantContext;
import com.luminai.config.CacheConfig;
import com.luminai.connection.ConnectionPreviewServiceImpl;
import com.luminai.connection.dto.ConnectionDto;
import com.luminai.connection.model.Connection;
import com.luminai.connection.producer.ConnectionProducer;
import com.luminai.connection.repository.ConnectionPreviewService;
import com.luminai.connection.repository.ConnectionRepository;
import com.luminai.connection.repository.GoldenRecordRepository;
import com.luminai.engine.service.DataEngineClient;
import io.minio.GetObjectArgs;
import io.minio.GetObjectResponse;
import io.minio.MinioClient;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import okhttp3.Headers;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

class ConnectionPreviewAndUploadHardeningTest {

  private ObjectMapper objectMapper;
  private UUID tenantId;
  private UUID connId;

  @BeforeEach
  void setUp() {
    objectMapper = new ObjectMapper();
    tenantId = UUID.randomUUID();
    connId = UUID.randomUUID();
    TenantContext.setTenant(tenantId, "acme");
  }

  @AfterEach
  void tearDown() {
    TenantContext.clear();
  }

  @Test
  @DisplayName("getCleanPreview caches COMPLETED responses and requests lightweight options")
  @SuppressWarnings("unchecked")
  void cleanPreviewCachesAndRequestsCompactOptions() {
    ConnectionPreviewService previewService = mock(ConnectionPreviewService.class);
    ConnectionRepository connRepo = mock(ConnectionRepository.class);
    GoldenRecordRepository goldenRepo = mock(GoldenRecordRepository.class);
    DataEngineClient dataEngineClient = mock(DataEngineClient.class);

    Connection conn =
        new Connection(
            tenantId,
            "Sales",
            Connection.Type.FILE,
            "{\"targetEntityType\":\"Transaction\"}",
            null,
            null);
    ReflectionTestUtils.setField(conn, "id", connId);

    when(connRepo.findById(connId)).thenReturn(Optional.of(conn));
    when(connRepo.findByIdAndTenantId(connId, tenantId)).thenReturn(Optional.of(conn));
    when(previewService.previewFile(connId)).thenReturn(List.of(Map.of("id", "1", "name", "A")));
    when(dataEngineClient.cleanDatasetDirect(any()))
        .thenReturn(
            Map.of(
                "status",
                "COMPLETED",
                "totalRawRecords",
                1,
                "totalCleanRecords",
                1,
                "dataQualityScore",
                95.0,
                "columns",
                List.of("id", "name"),
                "rows",
                List.of(Map.of("id", "1", "name", "A", "qualityState", "VERIFIED"))));

    ConnectionCleanPreviewService service =
        new ConnectionCleanPreviewService(
            previewService, connRepo, goldenRepo, objectMapper, dataEngineClient);
    ConcurrentMapCacheManager cacheManager =
        new ConcurrentMapCacheManager(CacheConfig.CACHE_CLEAN_PREVIEW);
    service.setCacheManager(cacheManager);

    ResponseEntity<Map<String, Object>> first = service.getCleanPreview(connId);
    ResponseEntity<Map<String, Object>> second = service.getCleanPreview(connId);

    assertThat(first.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(second.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(second.getBody()).containsEntry("status", "COMPLETED");

    ArgumentCaptor<Map<String, Object>> reqCaptor = ArgumentCaptor.forClass(Map.class);
    verify(dataEngineClient, times(1)).cleanDatasetDirect(reqCaptor.capture());
    assertThat(reqCaptor.getValue().get("options"))
        .isEqualTo(Map.of("include_golden_records", false));
  }

  @Test
  @DisplayName("getCleanPreview maps timed-out Data Engine response to 504 Gateway Timeout")
  void cleanPreviewPropagatesGatewayTimeout() {
    ConnectionPreviewService previewService = mock(ConnectionPreviewService.class);
    ConnectionRepository connRepo = mock(ConnectionRepository.class);
    GoldenRecordRepository goldenRepo = mock(GoldenRecordRepository.class);
    DataEngineClient dataEngineClient = mock(DataEngineClient.class);

    Connection conn = new Connection(tenantId, "Large", Connection.Type.FILE, "{}", null, null);
    ReflectionTestUtils.setField(conn, "id", connId);

    when(connRepo.findById(connId)).thenReturn(Optional.of(conn));
    when(previewService.previewFile(connId)).thenReturn(List.of(Map.of("id", "1")));
    when(dataEngineClient.cleanDatasetDirect(any()))
        .thenReturn(
            Map.of(
                "status",
                "ERROR",
                "timedOut",
                true,
                "statusCode",
                504,
                "error",
                "Data Engine timed out"));

    ConnectionCleanPreviewService service =
        new ConnectionCleanPreviewService(
            previewService, connRepo, goldenRepo, objectMapper, dataEngineClient);

    ResponseEntity<Map<String, Object>> res = service.getCleanPreview(connId);
    assertThat(res.getStatusCode()).isEqualTo(HttpStatus.GATEWAY_TIMEOUT);
    assertThat(res.getBody()).containsEntry("status", "GATEWAY_TIMEOUT");
  }

  @Test
  @DisplayName("uploadFile evicts preview cache and publishes objectKey with real totalRows")
  void uploadLargeFilePublishesReferenceWithoutInlineSampleBloat() throws Exception {
    FileConnectorService fileConnector = mock(FileConnectorService.class);
    ConnectionProducer producer = mock(ConnectionProducer.class);
    ConnectionRepository connRepo = mock(ConnectionRepository.class);

    Connection conn =
        new Connection(
            tenantId,
            "large.csv",
            Connection.Type.FILE,
            "{\"goldenRecordsPersisted\":true}",
            null,
            null);
    ReflectionTestUtils.setField(conn, "id", connId);

    StringBuilder csv = new StringBuilder("id,name\n");
    for (int i = 1; i <= 1250; i++) {
      csv.append(i).append(",Row_").append(i).append("\n");
    }
    byte[] payload = csv.toString().getBytes(StandardCharsets.UTF_8);
    MockMultipartFile file = new MockMultipartFile("file", "large.csv", "text/csv", payload);
    String expectedKey = tenantId + "/raw/" + connId + "/large.csv";

    when(connRepo.findById(connId)).thenReturn(Optional.of(conn));
    when(connRepo.findByIdAndTenantId(connId, tenantId)).thenReturn(Optional.of(conn));
    when(fileConnector.ingest(tenantId, connId, file)).thenReturn(expectedKey);

    ConcurrentMapCacheManager cacheManager =
        new ConcurrentMapCacheManager(CacheConfig.CACHE_CLEAN_PREVIEW);
    cacheManager
        .getCache(CacheConfig.CACHE_CLEAN_PREVIEW)
        .put(ConnectionCleanPreviewService.cacheKey(tenantId, connId), Map.of("stale", true));

    ConnectionUploadService uploadService =
        new ConnectionUploadService(fileConnector, producer, connRepo, objectMapper);
    uploadService.setCacheManager(cacheManager);

    ResponseEntity<?> response = uploadService.uploadFile(tenantId, connId, file);
    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(
            cacheManager
                .getCache(CacheConfig.CACHE_CLEAN_PREVIEW)
                .get(ConnectionCleanPreviewService.cacheKey(tenantId, connId)))
        .isNull();

    verify(producer)
        .publishRows(
            eq(tenantId),
            eq(connId),
            eq("large.csv"),
            eq(List.of()),
            eq(true),
            eq(expectedKey),
            eq(1250),
            eq((long) payload.length));
  }

  @Test
  @DisplayName(
      "MinIO fallback parses quoted CSV commas and streams large JSON arrays up to MAX_ROWS")
  void previewFileFallbackHandlesQuotedCsvAndStreamingJson() throws Exception {
    ConnectionRepository connRepo = mock(ConnectionRepository.class);
    PostgresConnectorService pgService = mock(PostgresConnectorService.class);
    MinioClient minioClient = mock(MinioClient.class);

    Connection csvConn =
        new Connection(
            tenantId,
            "quoted.csv",
            Connection.Type.FILE,
            "{\"fileKey\":\"" + tenantId + "/raw/" + connId + "/quoted.csv\"}",
            null,
            null);
    ReflectionTestUtils.setField(csvConn, "id", connId);
    when(connRepo.findByIdAndTenantId(connId, tenantId)).thenReturn(Optional.of(csvConn));

    byte[] csvBytes =
        "name,amount\n\"Smith, Jane\",\"1,200.50\"\n".getBytes(StandardCharsets.UTF_8);
    GetObjectResponse csvResp =
        new GetObjectResponse(
            Headers.of(),
            "luminai-raw",
            "us-east-1",
            tenantId + "/raw/" + connId + "/quoted.csv",
            new ByteArrayInputStream(csvBytes));
    when(minioClient.getObject(any(GetObjectArgs.class))).thenReturn(csvResp);

    ConnectionPreviewServiceImpl service =
        new ConnectionPreviewServiceImpl(connRepo, pgService, minioClient, objectMapper);
    List<Map<String, Object>> csvRows = service.previewFile(connId);
    assertThat(csvRows).hasSize(1);
    assertThat(csvRows.get(0)).containsEntry("name", "Smith, Jane");
    assertThat(csvRows.get(0)).containsEntry("amount", "1,200.50");

    UUID jsonConnId = UUID.randomUUID();
    Connection jsonConn =
        new Connection(
            tenantId,
            "many.json",
            Connection.Type.FILE,
            "{\"fileKey\":\"" + tenantId + "/raw/" + jsonConnId + "/many.json\"}",
            null,
            null);
    ReflectionTestUtils.setField(jsonConn, "id", jsonConnId);
    when(connRepo.findByIdAndTenantId(jsonConnId, tenantId)).thenReturn(Optional.of(jsonConn));

    StringBuilder jsonArray = new StringBuilder("[");
    for (int i = 0; i < 1100; i++) {
      if (i > 0) jsonArray.append(",");
      jsonArray.append("{\"id\":").append(i).append("}");
    }
    jsonArray.append("]");
    GetObjectResponse jsonResp =
        new GetObjectResponse(
            Headers.of(),
            "luminai-raw",
            "us-east-1",
            tenantId + "/raw/" + jsonConnId + "/many.json",
            new ByteArrayInputStream(jsonArray.toString().getBytes(StandardCharsets.UTF_8)));
    when(minioClient.getObject(any(GetObjectArgs.class))).thenReturn(jsonResp);

    List<Map<String, Object>> jsonRows = service.previewFile(jsonConnId);
    assertThat(jsonRows).hasSize(1000);
    assertThat(jsonRows.get(999)).containsEntry("id", 999);
  }

  @Test
  @DisplayName(
      "getAllForTenant trims sampleRows in list responses while getById returns full config")
  void connectionServiceTrimsListSampleRowsOnly() throws Exception {
    ConnectionRepository connRepo = mock(ConnectionRepository.class);
    List<Map<String, Object>> sampleRows = new ArrayList<>();
    for (int i = 0; i < 25; i++) {
      sampleRows.add(Map.of("id", i));
    }
    Map<String, Object> config = new LinkedHashMap<>();
    config.put("columns", List.of("id"));
    config.put("recordsCount", 50000);
    config.put("sampleRows", sampleRows);

    Connection conn =
        new Connection(
            tenantId,
            "big.csv",
            Connection.Type.FILE,
            objectMapper.writeValueAsString(config),
            null,
            null);
    ReflectionTestUtils.setField(conn, "id", connId);

    when(connRepo.findAllByTenantId(tenantId)).thenReturn(List.of(conn));
    when(connRepo.findByIdAndTenantId(connId, tenantId)).thenReturn(Optional.of(conn));

    ConnectionService service = new ConnectionService(connRepo, null);
    service.setObjectMapper(objectMapper);

    List<ConnectionDto.Response> listRes = service.getAllForTenant();
    JsonNode listCfg = objectMapper.readTree(listRes.get(0).config());
    assertThat(listCfg.get("sampleRows")).hasSize(10);
    assertThat(listRes.get(0).rowsSynced()).isEqualTo(50000L);

    ConnectionDto.Response detailRes = service.getById(connId);
    JsonNode detailCfg = objectMapper.readTree(detailRes.config());
    assertThat(detailCfg.get("sampleRows")).hasSize(25);
  }

  @Test
  @DisplayName("DataEngineClient.cleanDatasetDirect classifies SocketTimeoutException as 504")
  void dataEngineClientClassifiesReadTimeoutAs504() {
    org.springframework.web.client.RestClient.Builder builder =
        org.springframework.web.client.RestClient.builder();
    DataEngineClient client = new DataEngineClient("http://127.0.0.1:59999", "", builder);
    org.springframework.web.client.RestClient failingRestClient =
        org.springframework.web.client.RestClient.builder()
            .baseUrl("http://127.0.0.1:59999")
            .requestFactory(
                (uri, httpMethod) -> {
                  throw new java.net.SocketTimeoutException("Read timed out");
                })
            .build();
    ReflectionTestUtils.setField(client, "restClient", failingRestClient);

    Map<String, Object> result = client.cleanDatasetDirect(Map.of("rows", List.of()));
    assertThat(result).containsEntry("status", "ERROR");
    assertThat(result).containsEntry("timedOut", true);
    assertThat(result).containsEntry("statusCode", 504);
  }
}
