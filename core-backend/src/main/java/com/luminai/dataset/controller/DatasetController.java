package com.luminai.dataset.controller;

import com.luminai.dataset.dto.*;
import com.luminai.dataset.model.Dataset;
import com.luminai.dataset.model.SavedQuery;
import com.luminai.dataset.service.DataQualityRuleService;
import com.luminai.dataset.service.DatasetService;
import com.luminai.dataset.service.LineageService;
import com.luminai.dataset.service.SqlAnalyticsService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/datasets")
@PreAuthorize("isAuthenticated()")
public class DatasetController {

  private final DatasetService datasetService;
  private final LineageService lineageService;
  private final SqlAnalyticsService sqlAnalyticsService;
  private final DataQualityRuleService dataQualityRuleService;

  public DatasetController(
      DatasetService datasetService,
      LineageService lineageService,
      SqlAnalyticsService sqlAnalyticsService) {
    this(datasetService, lineageService, sqlAnalyticsService, null);
  }

  @Autowired
  public DatasetController(
      DatasetService datasetService,
      LineageService lineageService,
      SqlAnalyticsService sqlAnalyticsService,
      @Autowired(required = false) DataQualityRuleService dataQualityRuleService) {
    this.datasetService = datasetService;
    this.lineageService = lineageService;
    this.sqlAnalyticsService = sqlAnalyticsService;
    this.dataQualityRuleService = dataQualityRuleService;
  }

  public record CommitVersionRequest(
      String storageLocation,
      Long rowCount,
      String schemaSnapshot,
      String profilingSummary,
      String commitMessage) {}

  @GetMapping
  public ResponseEntity<List<DatasetDto>> listDatasets(
      @RequestParam(required = false) Dataset.Layer layer,
      @RequestParam(required = false) Dataset.ProjectType projectType,
      @RequestParam(required = false) String search) {
    return ResponseEntity.ok(datasetService.listDatasets(layer, projectType, search));
  }

  @GetMapping("/{id}")
  public ResponseEntity<DatasetDto> getDataset(@PathVariable UUID id) {
    return ResponseEntity.ok(datasetService.getDataset(id));
  }

  @PostMapping
  public ResponseEntity<DatasetDto> createDataset(
      @Valid @RequestBody CreateDatasetRequest request) {
    return ResponseEntity.status(HttpStatus.CREATED).body(datasetService.createDataset(request));
  }

  @GetMapping("/{id}/versions")
  public ResponseEntity<List<DatasetVersionDto>> getVersions(@PathVariable UUID id) {
    return ResponseEntity.ok(datasetService.getVersions(id));
  }

  @PostMapping("/{id}/versions")
  public ResponseEntity<DatasetVersionDto> commitVersion(
      @PathVariable UUID id, @RequestBody CommitVersionRequest request) {
    DatasetDto current = datasetService.getDataset(id);
    long rows = request.rowCount() != null ? request.rowCount() : current.rowCount();
    DatasetVersionDto created =
        datasetService.commitVersion(
            id,
            request.storageLocation(),
            rows,
            request.schemaSnapshot(),
            request.profilingSummary(),
            request.commitMessage());
    return ResponseEntity.status(HttpStatus.CREATED).body(created);
  }

  @GetMapping("/{id}/preview")
  public ResponseEntity<java.util.Map<String, Object>> previewDataset(
      @PathVariable UUID id, @RequestParam(defaultValue = "100") int limit) {
    return ResponseEntity.ok(datasetService.previewDataset(id, limit));
  }

  @GetMapping("/{id}/rules")
  public ResponseEntity<List<DataQualityRuleDto.Response>> listQualityRules(@PathVariable UUID id) {
    if (dataQualityRuleService == null) {
      return ResponseEntity.ok(List.of());
    }
    return ResponseEntity.ok(dataQualityRuleService.listRules(id));
  }

  @PostMapping("/{id}/rules")
  public ResponseEntity<DataQualityRuleDto.Response> createQualityRule(
      @PathVariable UUID id, @Valid @RequestBody DataQualityRuleDto.CreateRequest request) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(dataQualityRuleService.createRule(id, request));
  }

  @DeleteMapping("/{id}/rules/{ruleId}")
  public ResponseEntity<Void> deleteQualityRule(@PathVariable UUID id, @PathVariable UUID ruleId) {
    if (dataQualityRuleService != null) {
      dataQualityRuleService.deleteRule(id, ruleId);
    }
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/{id}/rules/evaluate")
  public ResponseEntity<DataQualityRuleDto.EvaluationSummary> evaluateQualityRules(
      @PathVariable UUID id) {
    return ResponseEntity.ok(dataQualityRuleService.evaluateRules(id));
  }

  @GetMapping("/lineage")
  public ResponseEntity<LineageGraphDto> getGlobalLineage() {
    return ResponseEntity.ok(lineageService.getLineageGraph(null));
  }

  @GetMapping("/{id}/lineage")
  public ResponseEntity<LineageGraphDto> getDatasetLineage(@PathVariable UUID id) {
    return ResponseEntity.ok(lineageService.getLineageGraph(id));
  }

  @PostMapping("/sql")
  public ResponseEntity<SqlQueryResultDto> executeSql(@Valid @RequestBody SqlQueryRequest request) {
    return ResponseEntity.ok(sqlAnalyticsService.executeQuery(request));
  }

  @GetMapping("/queries")
  public ResponseEntity<List<SavedQueryDto>> listSavedQueries(
      @RequestParam(required = false) UUID datasetId) {
    List<SavedQuery> list = sqlAnalyticsService.listSavedQueries(datasetId);
    return ResponseEntity.ok(list.stream().map(SavedQueryDto::fromEntity).toList());
  }

  @PostMapping("/queries")
  public ResponseEntity<SavedQueryDto> createSavedQuery(
      @RequestBody SavedQueryDto.UpsertRequest request) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(sqlAnalyticsService.createSavedQuery(request));
  }

  @GetMapping("/queries/{id}")
  public ResponseEntity<SavedQueryDto> getSavedQuery(@PathVariable UUID id) {
    return ResponseEntity.ok(sqlAnalyticsService.getSavedQuery(id));
  }

  @PutMapping("/queries/{id}")
  public ResponseEntity<SavedQueryDto> updateSavedQuery(
      @PathVariable UUID id, @RequestBody SavedQueryDto.UpsertRequest request) {
    return ResponseEntity.ok(sqlAnalyticsService.updateSavedQuery(id, request));
  }

  @DeleteMapping("/queries/{id}")
  public ResponseEntity<Void> deleteSavedQuery(@PathVariable UUID id) {
    sqlAnalyticsService.deleteSavedQuery(id);
    return ResponseEntity.noContent().build();
  }

  @PutMapping("/{id}/layer")
  public ResponseEntity<DatasetDto> transitionLayer(
      @PathVariable UUID id, @RequestParam Dataset.Layer layer) {
    return ResponseEntity.ok(datasetService.transitionLayer(id, layer));
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> deleteDataset(@PathVariable UUID id) {
    datasetService.deleteDataset(id);
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/{id}/eda")
  public ResponseEntity<java.util.Map<String, Object>> generateEda(
      @PathVariable UUID id, @RequestBody(required = false) java.util.Map<String, Object> body) {
    @SuppressWarnings("unchecked")
    List<java.util.Map<String, Object>> records =
        body != null && body.get("records") instanceof List<?> l
            ? (List<java.util.Map<String, Object>>) l
            : java.util.List.of();
    java.util.Map<String, Object> result = datasetService.generateEdaReport(id, records);
    if (result != null
        && ("ERROR".equalsIgnoreCase(String.valueOf(result.get("status")))
            || result.containsKey("error"))) {
      return ResponseEntity.status(org.springframework.http.HttpStatus.BAD_GATEWAY).body(result);
    }
    return ResponseEntity.ok(result);
  }

  @PostMapping("/cleaning/preview")
  public ResponseEntity<java.util.Map<String, Object>> previewCleaning(
      @RequestBody java.util.Map<String, Object> body) {
    java.util.Map<String, Object> res = datasetService.previewCleaning(body);
    return toEngineResponse(res);
  }

  @PostMapping("/cleaning/execute")
  public ResponseEntity<java.util.Map<String, Object>> executeCleaning(
      @RequestBody java.util.Map<String, Object> body) {
    java.util.Map<String, Object> res = datasetService.executeCleaningRecipe(body);
    return toEngineResponse(res);
  }

  @PostMapping("/pipelines/execute")
  public ResponseEntity<java.util.Map<String, Object>> executePipeline(
      @RequestBody java.util.Map<String, Object> body) {
    java.util.Map<String, Object> res = datasetService.executePipeline(body);
    return toEngineResponse(res);
  }

  private ResponseEntity<java.util.Map<String, Object>> toEngineResponse(
      java.util.Map<String, Object> res) {
    if (res != null
        && ("ERROR".equalsIgnoreCase(String.valueOf(res.get("status")))
            || res.containsKey("error"))) {
      return ResponseEntity.badRequest().body(res);
    }
    return ResponseEntity.ok(res);
  }
}
