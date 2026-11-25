package com.luminai.engine.service;

import com.luminai.engine.dto.DataEngineHealthDto;
import java.util.HashMap;
import java.util.List;
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
  private static final ParameterizedTypeReference<List<Map<String, Object>>> LIST_MAP_TYPE =
      new ParameterizedTypeReference<>() {};

  private final RestClient restClient;
  private final String baseUrl;

  public DataEngineClient(
      @Value("${data-engine.base-url:http://localhost:8000}") String baseUrl,
      @Value("${data-engine.api-key:}") String apiKey,
      RestClient.Builder restClientBuilder) {
    this.baseUrl = baseUrl;
    org.springframework.http.client.SimpleClientHttpRequestFactory requestFactory =
        new org.springframework.http.client.SimpleClientHttpRequestFactory();
    requestFactory.setConnectTimeout(java.time.Duration.ofMillis(5000));
    requestFactory.setReadTimeout(
        java.time.Duration.ofMillis(120000)); // 120s — allows full dataset cleaning pipeline

    RestClient.Builder builder = restClientBuilder.baseUrl(baseUrl).requestFactory(requestFactory);
    if (apiKey != null && !apiKey.isBlank()) {
      builder.defaultHeader("X-API-Key", apiKey);
    }
    this.restClient = builder.build();
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
    try {
      return restClient
          .post()
          .uri("/process/trigger")
          .contentType(MediaType.APPLICATION_JSON)
          .body(requestPayload)
          .accept(MediaType.APPLICATION_JSON)
          .retrieve()
          .body(MAP_TYPE);
    } catch (Exception e) {
      log.warn("Failed to trigger cleanData on Data Engine ({}): {}", baseUrl, e.getMessage());
      return Map.of(
          "status",
          "ERROR",
          "available",
          false,
          "recordsProcessed",
          0,
          "message",
          "Data Engine unreachable at " + baseUrl + " (" + e.getClass().getSimpleName() + ").",
          "error",
          e.getMessage() != null ? e.getMessage() : "Connection failed");
    }
  }

  public Map<String, Object> cleanDatasetDirect(Map<String, Object> requestPayload) {
    try {
      return restClient
          .post()
          .uri("/process/dataset/clean")
          .contentType(MediaType.APPLICATION_JSON)
          .body(requestPayload)
          .accept(MediaType.APPLICATION_JSON)
          .retrieve()
          .body(MAP_TYPE);
    } catch (Exception e) {
      log.warn("Data Engine direct dataset cleaning failed ({}): {}", baseUrl, e.getMessage());
      return Map.of(
          "status",
          "ERROR",
          "available",
          false,
          "message",
          "Data Engine unreachable at " + baseUrl + " (" + e.getClass().getSimpleName() + ").",
          "error",
          e.getMessage() != null ? e.getMessage() : "Connection failed");
    }
  }

  public Map<String, Object> resolveEntities(Object requestPayload) {
    try {
      return restClient
          .post()
          .uri("/process/er/trigger")
          .contentType(MediaType.APPLICATION_JSON)
          .body(requestPayload)
          .accept(MediaType.APPLICATION_JSON)
          .retrieve()
          .body(MAP_TYPE);
    } catch (Exception e) {
      log.warn(
          "Failed to trigger resolveEntities on Data Engine ({}): {}", baseUrl, e.getMessage());
      return Map.of(
          "status",
          "ERROR",
          "available",
          false,
          "resolvedEntities",
          0,
          "message",
          "Data Engine ER service unreachable at "
              + baseUrl
              + " ("
              + e.getClass().getSimpleName()
              + ").",
          "error",
          e.getMessage() != null ? e.getMessage() : "Connection failed");
    }
  }

  public Map<String, Object> getInsights(Object requestPayload) {
    try {
      return restClient
          .post()
          .uri("/analytics/insights")
          .contentType(MediaType.APPLICATION_JSON)
          .body(requestPayload)
          .accept(MediaType.APPLICATION_JSON)
          .retrieve()
          .body(MAP_TYPE);
    } catch (Exception e) {
      log.warn("Failed to fetch AI insights from Data Engine: {}", e.getMessage());
      return Map.of(
          "status",
          "DEGRADED",
          "available",
          false,
          "summary",
          "AI Insights unavailable: " + e.getMessage(),
          "insights",
          java.util.List.of(),
          "metrics",
          java.util.List.of());
    }
  }

  public Map<String, Object> getJobStatus(String jobId) {
    try {
      Map<String, Object> result =
          restClient
              .get()
              .uri("/process/status/{jobId}", jobId)
              .accept(MediaType.APPLICATION_JSON)
              .retrieve()
              .body(MAP_TYPE);
      if (result != null
          && result.containsKey("failed_step")
          && result.get("failed_step") != null) {
        String fs = String.valueOf(result.get("failed_step")).toLowerCase();
        String normalized = fs;
        if (fs.contains("dedupe")
            || fs.contains("deduplicat")
            || fs.contains("block")
            || fs.contains("cluster")) {
          normalized = "dedupe";
        } else if (fs.contains("clean")) {
          normalized = "clean";
        } else if (fs.contains("resolve") || fs.contains("golden") || fs.contains("classif")) {
          normalized = "resolve";
        } else if (fs.contains("ingest") || fs.contains("raw")) {
          normalized = "ingest";
        }
        Map<String, Object> copy = new HashMap<>(result);
        copy.put("failed_step", normalized);
        return copy;
      }
      return result;
    } catch (Exception e) {
      log.warn(
          "Failed to fetch job status for {} from Data Engine ({}): {}",
          jobId,
          baseUrl,
          e.getMessage());
      Map<String, Object> fallback = new HashMap<>();
      fallback.put("jobId", jobId);
      fallback.put("status", "UNKNOWN");
      fallback.put("available", false);
      fallback.put("failed_step", null);
      fallback.put(
          "logs",
          List.of(
              "Data Engine unreachable at "
                  + baseUrl
                  + " ("
                  + e.getClass().getSimpleName()
                  + ")."));
      fallback.put(
          "quality_scores",
          Map.of("completeness", 0.0, "uniqueness", 0.0, "consistency", 0.0, "timeliness", 0.0));
      fallback.put(
          "message",
          "Data Engine unreachable at " + baseUrl + " (" + e.getClass().getSimpleName() + ").");
      fallback.put("error", e.getMessage() != null ? e.getMessage() : "Connection failed");
      return fallback;
    }
  }

  public Map<String, Object> previewCleaning(Map<String, Object> payload) {
    return postJson("/analytics/cleaning/preview", payload);
  }

  public Map<String, Object> executeCleaningRecipe(Map<String, Object> payload) {
    return postJson("/analytics/cleaning/execute", payload);
  }

  public Map<String, Object> executePipeline(Map<String, Object> payload) {
    return postJson("/analytics/pipelines/execute", payload);
  }

  public Map<String, Object> generateEdaReport(Map<String, Object> payload) {
    return postJson("/analytics/eda/report", payload);
  }

  public Map<String, Object> decomposeGraph(Map<String, Object> payload) {
    return postJson("/analytics/graph/decompose", payload);
  }

  public Map<String, Object> trainMlModel(Map<String, Object> payload) {
    return postJson("/analytics/ml/train", payload);
  }

  public List<Map<String, Object>> listMlExperiments(String tenantId) {
    try {
      return restClient
          .get()
          .uri(
              uriBuilder ->
                  uriBuilder
                      .path("/analytics/ml/experiments")
                      .queryParam("tenant_id", tenantId != null ? tenantId : "acme")
                      .build())
          .accept(MediaType.APPLICATION_JSON)
          .retrieve()
          .body(LIST_MAP_TYPE);
    } catch (Exception e) {
      log.warn("Failed to list ML experiments from Data Engine: {}", e.getMessage());
      return List.of();
    }
  }

  public Map<String, Object> registerMlModel(Map<String, Object> payload) {
    return postJson("/analytics/ml/models/register", payload);
  }

  public List<Map<String, Object>> listMlModels(String tenantId) {
    try {
      return restClient
          .get()
          .uri(
              uriBuilder ->
                  uriBuilder
                      .path("/analytics/ml/models")
                      .queryParam("tenant_id", tenantId != null ? tenantId : "acme")
                      .build())
          .accept(MediaType.APPLICATION_JSON)
          .retrieve()
          .body(LIST_MAP_TYPE);
    } catch (Exception e) {
      log.warn("Failed to list ML models from Data Engine: {}", e.getMessage());
      return List.of();
    }
  }

  private Map<String, Object> postJson(String uri, Object payload) {
    try {
      return restClient
          .post()
          .uri(uri)
          .contentType(MediaType.APPLICATION_JSON)
          .body(payload)
          .accept(MediaType.APPLICATION_JSON)
          .retrieve()
          .body(MAP_TYPE);
    } catch (Exception e) {
      log.warn("Data Engine POST {} failed: {}", uri, e.getMessage());
      return Map.of(
          "status", "ERROR", "error", e.getMessage() != null ? e.getMessage() : "Request failed");
    }
  }
}
