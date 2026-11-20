package com.luminai.dataset.controller;

import com.luminai.dataset.dto.*;
import com.luminai.dataset.model.Dataset;
import com.luminai.dataset.model.SavedQuery;
import com.luminai.dataset.service.DatasetService;
import com.luminai.dataset.service.LineageService;
import com.luminai.dataset.service.SqlAnalyticsService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/datasets")
public class DatasetController {

  private final DatasetService datasetService;
  private final LineageService lineageService;
  private final SqlAnalyticsService sqlAnalyticsService;

  public DatasetController(
      DatasetService datasetService,
      LineageService lineageService,
      SqlAnalyticsService sqlAnalyticsService) {
    this.datasetService = datasetService;
    this.lineageService = lineageService;
    this.sqlAnalyticsService = sqlAnalyticsService;
  }

  @GetMapping
  public ResponseEntity<List<DatasetDto>> listDatasets(
      @RequestParam(required = false) Dataset.Layer layer,
      @RequestParam(required = false) Dataset.ProjectType projectType) {
    return ResponseEntity.ok(datasetService.listDatasets(layer, projectType));
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
  public ResponseEntity<List<SavedQuery>> listSavedQueries(
      @RequestParam(required = false) UUID datasetId) {
    return ResponseEntity.ok(sqlAnalyticsService.listSavedQueries(datasetId));
  }
}
