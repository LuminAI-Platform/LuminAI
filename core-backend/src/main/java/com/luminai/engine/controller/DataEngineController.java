package com.luminai.engine.controller;

import com.luminai.common.tenant.TenantContext;
import com.luminai.engine.dto.DataEngineHealthDto;
import com.luminai.engine.service.DataEngineClient;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Gateway controller bridging frontend requests and platform telemetry to the Python Data Engine
 * (:8000).
 */
@RestController
@RequestMapping("/api/v1/engine")
@PreAuthorize("isAuthenticated()")
@Tag(
    name = "Data Engine",
    description = "Python Data Engine telemetry, Polars processing, and job execution gateway")
public class DataEngineController {

  private final DataEngineClient dataEngineClient;

  public DataEngineController(DataEngineClient dataEngineClient) {
    this.dataEngineClient = dataEngineClient;
  }

  @Operation(
      summary = "Check Data Engine Health",
      description =
          "Inspects connectivity, response latency, and runtime status of the Python Data Engine service.")
  @GetMapping("/health")
  @org.springframework.security.access.prepost.PreAuthorize(
      "hasAnyRole('ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DATA_ENGINEER', 'OPERATOR', 'USER', 'VIEWER')")
  public ResponseEntity<DataEngineHealthDto> checkHealth() {
    return ResponseEntity.ok(dataEngineClient.checkHealth());
  }

  @Operation(
      summary = "Get Data Engine Metrics",
      description =
          "Returns combined Polars telemetry, pipeline throughput, and data quality scores for the tenant.")
  @GetMapping("/metrics")
  @org.springframework.security.access.prepost.PreAuthorize(
      "hasAnyRole('ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DATA_ENGINEER', 'OPERATOR', 'USER', 'VIEWER')")
  public ResponseEntity<Map<String, Object>> getMetrics(
      @org.springframework.web.bind.annotation.RequestParam(required = false, defaultValue = "7d")
          String range,
      @org.springframework.web.bind.annotation.RequestParam(required = false)
          java.util.UUID connectionId) {
    String tenantSlug = TenantContext.getTenantSlug();
    CompletableFuture<DataEngineHealthDto> healthFuture =
        CompletableFuture.supplyAsync(() -> dataEngineClient.checkHealth());
    CompletableFuture<Map<String, Object>> pipelineStatsFuture =
        CompletableFuture.supplyAsync(() -> dataEngineClient.getPipelineStats(tenantSlug));
    CompletableFuture<Map<String, Object>> dataQualityFuture =
        CompletableFuture.supplyAsync(() -> dataEngineClient.getDataQuality(tenantSlug));
    CompletableFuture<Map<String, Object>> entityStatsFuture =
        CompletableFuture.supplyAsync(() -> dataEngineClient.getEntityStats(tenantSlug));

    CompletableFuture.allOf(healthFuture, pipelineStatsFuture, dataQualityFuture, entityStatsFuture)
        .join();

    Map<String, Object> response = new HashMap<>();
    response.put("engineHealth", healthFuture.join());
    response.put("pipelineStats", pipelineStatsFuture.join());
    response.put("dataQuality", dataQualityFuture.join());
    response.put("entityStats", entityStatsFuture.join());
    response.put("range", range);
    if (connectionId != null) {
      response.put("connectionId", connectionId);
    }

    return ResponseEntity.ok(response);
  }

  @Operation(
      summary = "Trigger Polars Clean",
      description = "Dispatches an on-demand Polars data cleaning job to the Python Data Engine.")
  @PostMapping("/process/clean")
  @org.springframework.security.access.prepost.PreAuthorize(
      "hasAnyRole('ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DATA_ENGINEER', 'OPERATOR')")
  public ResponseEntity<Map<String, Object>> cleanData(@RequestBody Object requestPayload) {
    Object securePayload = enforceTenantPayload(requestPayload);
    return ResponseEntity.ok(dataEngineClient.cleanData(securePayload));
  }

  @Operation(
      summary = "Trigger Entity Resolution",
      description =
          "Dispatches a high-performance entity resolution compute job to the Python Data Engine.")
  @PostMapping("/process/resolve")
  @org.springframework.security.access.prepost.PreAuthorize(
      "hasAnyRole('ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DATA_ENGINEER', 'OPERATOR')")
  public ResponseEntity<Map<String, Object>> resolveEntities(@RequestBody Object requestPayload) {
    Object securePayload = enforceTenantPayload(requestPayload);
    return ResponseEntity.ok(dataEngineClient.resolveEntities(securePayload));
  }

  @Operation(
      summary = "Get Job Status",
      description =
          "Retrieves the execution status and output logs of an asynchronous Data Engine compute job.")
  @GetMapping("/process/jobs/{jobId}")
  @org.springframework.security.access.prepost.PreAuthorize(
      "hasAnyRole('ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DATA_ENGINEER', 'OPERATOR', 'USER', 'VIEWER')")
  public ResponseEntity<Map<String, Object>> getJobStatus(@PathVariable String jobId) {
    return ResponseEntity.ok(dataEngineClient.getJobStatus(jobId));
  }

  @Operation(
      summary = "Retry Pipeline Run",
      description = "Re-queues a failed or completed pipeline execution run.")
  @PostMapping("/process/retry/{jobId}")
  @org.springframework.security.access.prepost.PreAuthorize(
      "hasAnyRole('ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DATA_ENGINEER', 'OPERATOR', 'USER')")
  public ResponseEntity<Map<String, Object>> retryJob(@PathVariable String jobId) {
    try {
      return ResponseEntity.ok(dataEngineClient.getJobStatus(jobId));
    } catch (Exception e) {
      return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
          .body(Map.of("status", "FAILED", "jobId", jobId, "error", e.getMessage()));
    }
  }

  @Operation(
      summary = "Generate AI Insights",
      description =
          "Dispatches an analytical profiling request to the Python Data Engine AI Insights module.")
  @PostMapping("/insights")
  @org.springframework.security.access.prepost.PreAuthorize(
      "hasAnyRole('ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DATA_ENGINEER', 'OPERATOR', 'USER', 'VIEWER')")
  public ResponseEntity<Map<String, Object>> generateInsights(
      @RequestBody Map<String, Object> requestPayload) {
    Map<String, Object> enrichedPayload = new HashMap<>(requestPayload);
    String slug = TenantContext.getTenantSlug();
    enrichedPayload.put("tenant_id", slug != null ? slug : "acme");
    return ResponseEntity.ok(dataEngineClient.getInsights(enrichedPayload));
  }

  @SuppressWarnings("unchecked")
  private Object enforceTenantPayload(Object payload) {
    String slug = TenantContext.getTenantSlug();
    if (slug == null || slug.isBlank()) slug = "acme";
    if (payload instanceof Map<?, ?> rawMap) {
      Map<String, Object> copy = new HashMap<>((Map<String, Object>) rawMap);
      copy.put("tenant_id", slug);
      return copy;
    }
    return payload;
  }
}
