package com.luminai.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.luminai.common.tenant.TenantContext;
import com.luminai.engine.controller.DataEngineController;
import com.luminai.engine.dto.DataEngineHealthDto;
import com.luminai.engine.service.DataEngineClient;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

class DataEngineControllerTest {

  private DataEngineClient dataEngineClient;
  private DataEngineController controller;

  @BeforeEach
  void setUp() {
    dataEngineClient = mock(DataEngineClient.class);
    controller = new DataEngineController(dataEngineClient);
    TenantContext.setTenant(UUID.randomUUID(), "test-tenant");
  }

  @AfterEach
  void tearDown() {
    TenantContext.clear();
  }

  @Test
  @DisplayName("GET /api/v1/engine/health returns engine status")
  void checkHealthSuccess() {
    DataEngineHealthDto health =
        new DataEngineHealthDto("ONLINE", "LuminAI Data Engine", "1.0.0", 15, "OK");
    when(dataEngineClient.checkHealth()).thenReturn(health);

    ResponseEntity<DataEngineHealthDto> response = controller.checkHealth();
    assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
    assertThat(response.getBody()).isNotNull();
    assertThat(response.getBody().status()).isEqualTo("ONLINE");
    assertThat(response.getBody().latencyMs()).isEqualTo(15);
  }

  @Test
  @DisplayName("GET /api/v1/engine/metrics returns aggregated metrics")
  void getMetricsSuccess() {
    DataEngineHealthDto health =
        new DataEngineHealthDto("ONLINE", "LuminAI Data Engine", "1.0.0", 12, "OK");
    when(dataEngineClient.checkHealth()).thenReturn(health);
    when(dataEngineClient.getPipelineStats("test-tenant"))
        .thenReturn(Map.of("totalRuns", 25, "successRate", 96.0));
    when(dataEngineClient.getDataQuality("test-tenant")).thenReturn(Map.of("overallScore", 92.5));
    when(dataEngineClient.getEntityStats("test-tenant")).thenReturn(Map.of("totalEntities", 150));

    ResponseEntity<Map<String, Object>> response = controller.getMetrics();
    assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
    Map<String, Object> body = response.getBody();
    assertThat(body).isNotNull();
    assertThat(body).containsKey("engineHealth");
    assertThat(body).containsKey("pipelineStats");
    assertThat(body).containsKey("dataQuality");
    assertThat(body).containsKey("entityStats");
  }

  @Test
  @DisplayName("POST /api/v1/engine/process/clean forwards cleaning job")
  void cleanDataSuccess() {
    when(dataEngineClient.cleanData(any())).thenReturn(Map.of("cleanedRows", 500));

    ResponseEntity<Map<String, Object>> response = controller.cleanData(Map.of("sample", "data"));
    assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
    assertThat(response.getBody()).containsEntry("cleanedRows", 500);
  }
}
