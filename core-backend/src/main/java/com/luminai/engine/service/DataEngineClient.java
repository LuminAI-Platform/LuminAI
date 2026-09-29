package com.luminai.engine.service;

import com.luminai.engine.dto.DataEngineHealthDto;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

/**
 * HTTP client for communicating directly with the Python Data Engine (FastAPI :8000). Exposes
 * health telemetry, Polars pipeline metrics, and batch compute triggers.
 */
@Service
public class DataEngineClient {

  private static final Logger log = LoggerFactory.getLogger(DataEngineClient.class);
  private static final ParameterizedTypeReference<Map<String, Object>> MAP_TYPE =
      new ParameterizedTypeReference<>() {};

  private final RestClient restClient;
  private final String baseUrl;

  public DataEngineClient(
      @Value("${data-engine.base-url:http://localhost:8000}") String baseUrl,
      RestClient.Builder restClientBuilder) {
    this.baseUrl = baseUrl;
    this.restClient = restClientBuilder.baseUrl(baseUrl).build();
  }

  public DataEngineHealthDto checkHealth() {
    long start = System.currentTimeMillis();
    try {
      Map<String, Object> body =
          restClient
              .get()
              .uri("/health")
              .accept(MediaType.APPLICATION_JSON)
              .retrieve()
              .body(MAP_TYPE);

      long latency = System.currentTimeMillis() - start;
      String status = body != null ? String.valueOf(body.getOrDefault("status", "UP")) : "UP";
      String version =
          body != null ? String.valueOf(body.getOrDefault("version", "1.0.0")) : "1.0.0";
      String appName =
          body != null
              ? String.valueOf(body.getOrDefault("app_name", "LuminAI Data Engine"))
              : "LuminAI Data Engine";

      return new DataEngineHealthDto("ONLINE", appName, version, latency, "Data Engine reachable");
    } catch (Exception e) {
      log.debug("Data Engine health check to {} failed: {}", baseUrl, e.getMessage());
      long latency = System.currentTimeMillis() - start;
      return new DataEngineHealthDto(
          "STANDBY",
          "LuminAI Data Engine",
          "unknown",
          latency,
          "Data Engine unreachable at " + baseUrl + " (" + e.getClass().getSimpleName() + ")");
    }
  }

  public Map<String, Object> getPipelineStats(String tenantSlug) {
    try {
      return restClient
          .get()
          .uri(
              uriBuilder ->
                  uriBuilder
                      .path("/analytics/dashboard/pipeline-stats")
                      .queryParam("tenant_id", tenantSlug)
                      .build())
          .accept(MediaType.APPLICATION_JSON)
          .retrieve()
          .body(MAP_TYPE);
    } catch (Exception e) {
      log.warn("Failed to fetch pipeline stats from Data Engine: {}", e.getMessage());
      return Map.of(
          "totalRuns",
          0,
          "successRate",
          0.0,
          "avgDuration",
          0.0,
          "recordsProcessed",
          0,
          "available",
          false,
          "status",
          "UNAVAILABLE",
          "error",
          "Data Engine unreachable: " + e.getMessage());
    }
  }

  public Map<String, Object> getDataQuality(String tenantSlug) {
    try {
      return restClient
          .get()
          .uri(
              uriBuilder ->
                  uriBuilder
                      .path("/analytics/dashboard/data-quality")
                      .queryParam("tenant_id", tenantSlug)
                      .build())
          .accept(MediaType.APPLICATION_JSON)
          .retrieve()
          .body(MAP_TYPE);
    } catch (Exception e) {
      log.warn("Failed to fetch data quality from Data Engine: {}", e.getMessage());
      return Map.of(
          "overallScore", 0.0,
          "completeness", 0.0,
          "uniqueness", 0.0,
          "consistency", 0.0,
          "timeliness", 0.0,
          "available", false,
          "status", "UNAVAILABLE",
          "error", "Data Engine unreachable: " + e.getMessage());
    }
  }

  public Map<String, Object> getEntityStats(String tenantSlug) {
    try {
      return restClient
          .get()
          .uri(
              uriBuilder ->
                  uriBuilder
                      .path("/analytics/dashboard/entity-stats")
                      .queryParam("tenant_id", tenantSlug)
                      .build())
          .accept(MediaType.APPLICATION_JSON)
          .retrieve()
          .body(MAP_TYPE);
    } catch (Exception e) {
      log.warn("Failed to fetch entity stats from Data Engine: {}", e.getMessage());
      return Map.of(
          "totalEntities",
          0,
          "entityCountsByType",
          Map.of(),
          "available",
          false,
          "status",
          "UNAVAILABLE",
          "error",
          "Data Engine unreachable: " + e.getMessage());
    }
  }

  public Map<String, Object> cleanData(Object requestPayload) {
    return restClient
        .post()
        .uri("/process/clean")
        .contentType(MediaType.APPLICATION_JSON)
        .body(requestPayload)
        .accept(MediaType.APPLICATION_JSON)
        .retrieve()
        .body(MAP_TYPE);
  }

  public Map<String, Object> resolveEntities(Object requestPayload) {
    return restClient
        .post()
        .uri("/process/resolve")
        .contentType(MediaType.APPLICATION_JSON)
        .body(requestPayload)
        .accept(MediaType.APPLICATION_JSON)
        .retrieve()
        .body(MAP_TYPE);
  }

  public Map<String, Object> getJobStatus(String jobId) {
    return restClient
        .get()
        .uri("/process/jobs/{jobId}", jobId)
        .accept(MediaType.APPLICATION_JSON)
        .retrieve()
        .body(MAP_TYPE);
  }
}
