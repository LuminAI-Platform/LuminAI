package com.luminai.dataset.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.luminai.common.exception.ResourceNotFoundException;
import com.luminai.common.tenant.TenantContext;
import com.luminai.dataset.dto.MlModelDto;
import com.luminai.dataset.dto.TrainModelRequestDto;
import com.luminai.dataset.model.MlModel;
import com.luminai.dataset.repository.MlModelRepository;
import com.luminai.engine.service.DataEngineClient;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MlModelService {

  private static final Logger log = LoggerFactory.getLogger(MlModelService.class);

  private final MlModelRepository mlModelRepository;
  private final DataEngineClient dataEngineClient;
  private final ObjectMapper objectMapper;

  public MlModelService(
      MlModelRepository mlModelRepository,
      @Autowired(required = false) DataEngineClient dataEngineClient,
      ObjectMapper objectMapper) {
    this.mlModelRepository = mlModelRepository;
    this.dataEngineClient = dataEngineClient;
    this.objectMapper = objectMapper;
  }

  private UUID requireTenantUuid() {
    UUID tenantId = TenantContext.getTenantUuid();
    if (tenantId == null) {
      throw new AccessDeniedException("Unauthorized: missing tenant context");
    }
    return tenantId;
  }

  private String getTenantSlug() {
    String slug = TenantContext.getTenantSlug();
    return (slug != null && !slug.isBlank()) ? slug : "acme";
  }

  @Transactional
  public Map<String, Object> trainAndPersist(TrainModelRequestDto req) {
    UUID tenantId = requireTenantUuid();
    String tenantSlug = getTenantSlug();

    log.info("Triggering ML model training for '{}' (tenant={})", req.modelName(), tenantSlug);

    Map<String, Object> engineReq = new LinkedHashMap<>();
    engineReq.put("tenant_id", tenantSlug);
    engineReq.put("model_name", req.modelName());
    engineReq.put("dataset_name", req.datasetName() != null ? req.datasetName() : "dataset");
    engineReq.put("dataset_version", req.datasetVersion() != null ? req.datasetVersion() : 1);
    engineReq.put("target_column", req.targetColumn());
    engineReq.put("records", req.records());
    if (req.featureColumns() != null) engineReq.put("feature_columns", req.featureColumns());
    if (req.algorithm() != null) engineReq.put("algorithm", req.algorithm());
    if (req.taskType() != null) engineReq.put("task_type", req.taskType());
    if (req.testSize() != null) engineReq.put("test_size", req.testSize());
    if (req.hyperparameters() != null) engineReq.put("hyperparameters", req.hyperparameters());

    Map<String, Object> outcome;
    if (dataEngineClient != null) {
      outcome = dataEngineClient.trainMlModel(engineReq);
    } else {
      outcome = Map.of("status", "ERROR", "error", "DataEngineClient not available");
    }

    // Persist model record into PostgreSQL
    MlModel model = new MlModel();
    model.setTenantId(tenantId);
    model.setName(req.modelName());
    model.setAlgorithm(req.algorithm() != null ? req.algorithm() : "Random Forest");
    model.setTaskType(req.taskType() != null ? req.taskType().toUpperCase() : "CLASSIFICATION");
    model.setTrainingDatasetId(req.datasetId());
    model.setDatasetVersion(req.datasetVersion() != null ? req.datasetVersion() : 1);
    model.setTargetColumn(req.targetColumn());
    model.setStatus("CHALLENGER");

    try {
      if (req.featureColumns() != null) {
        model.setFeatures(objectMapper.writeValueAsString(req.featureColumns()));
      }
      if (req.hyperparameters() != null) {
        model.setHyperparameters(objectMapper.writeValueAsString(req.hyperparameters()));
      }
      if (outcome.containsKey("metrics")) {
        model.setMetrics(objectMapper.writeValueAsString(outcome.get("metrics")));
      }
    } catch (Exception e) {
      log.warn("Failed to serialize model metadata to JSON: {}", e.getMessage());
    }

    String runId =
        outcome.containsKey("run_id")
            ? String.valueOf(outcome.get("run_id")).replaceAll("[^a-zA-Z0-9_\\-]", "")
            : UUID.randomUUID().toString();
    model.setModelArtifactPath("storage/ml_registry/" + runId);

    MlModel saved = mlModelRepository.save(model);
    log.info("Persisted ML model experiment '{}' with ID {}", saved.getName(), saved.getId());

    Map<String, Object> result = new LinkedHashMap<>(outcome);
    result.put("persistedModel", MlModelDto.fromEntity(saved));
    return result;
  }

  @Transactional(readOnly = true)
  public List<MlModelDto> listModels(String status) {
    UUID tenantId = requireTenantUuid();
    List<MlModel> models;
    if (status != null && !status.isBlank()) {
      models = mlModelRepository.findAllByTenantIdAndStatus(tenantId, status.toUpperCase().trim());
    } else {
      models = mlModelRepository.findAllByTenantIdOrderByUpdatedAtDesc(tenantId);
    }
    return models.stream().map(MlModelDto::fromEntity).toList();
  }

  @Transactional(readOnly = true)
  public MlModelDto getModel(UUID id) {
    UUID tenantId = requireTenantUuid();
    MlModel model =
        mlModelRepository
            .findByIdAndTenantId(id, tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("MlModel", id));
    return MlModelDto.fromEntity(model);
  }

  @Transactional
  public MlModelDto promoteModel(UUID id, String targetStatus) {
    UUID tenantId = requireTenantUuid();
    String safeStatus = targetStatus != null ? targetStatus.toUpperCase().trim() : "CHALLENGER";

    MlModel model =
        mlModelRepository
            .findByIdAndTenantId(id, tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("MlModel", id));

    // Strict Validation: Champion models MUST have non-empty artifact path and validation metrics
    if ("CHAMPION".equals(safeStatus)) {
      if (model.getModelArtifactPath() == null || model.getModelArtifactPath().isBlank()) {
        throw new IllegalStateException(
            "Cannot promote model to CHAMPION: missing model artifact path");
      }
      if (model.getMetrics() == null
          || model.getMetrics().isBlank()
          || "{}".equals(model.getMetrics())) {
        throw new IllegalStateException(
            "Cannot promote model to CHAMPION: model must possess evaluated validation metrics");
      }

      // Single-Champion Governance: demote existing champions within the same prediction scope
      List<MlModel> champions = mlModelRepository.findAllByTenantIdAndStatus(tenantId, "CHAMPION");
      for (MlModel c : champions) {
        if (!c.getId().equals(model.getId())) {
          boolean sameScope =
              Objects.equals(c.getTrainingDatasetId(), model.getTrainingDatasetId())
                  && Objects.equals(c.getTargetColumn(), model.getTargetColumn())
                  && Objects.equals(c.getTaskType(), model.getTaskType());
          if (sameScope) {
            c.setStatus("CHALLENGER");
            mlModelRepository.save(c);
            log.info(
                "Demoted prior champion model {} (scope: dataset={}, target={}, task={}) to CHALLENGER",
                c.getId(),
                c.getTrainingDatasetId(),
                c.getTargetColumn(),
                c.getTaskType());
          }
        }
      }
    }

    model.setStatus(safeStatus);
    MlModel saved = mlModelRepository.save(model);
    log.info("Promoted ML model {} to {}", saved.getId(), safeStatus);

    // Sync with Data Engine model registry if available
    if (dataEngineClient != null) {
      try {
        Map<String, Object> regReq = new LinkedHashMap<>();
        regReq.put("tenant_id", getTenantSlug());
        regReq.put("run_id", saved.getId().toString());
        regReq.put("name", saved.getName());
        regReq.put("status", safeStatus);
        dataEngineClient.registerMlModel(regReq);
      } catch (Exception e) {
        log.warn("Could not sync promotion to Data Engine: {}", e.getMessage());
      }
    }

    return MlModelDto.fromEntity(saved);
  }

  @Transactional(readOnly = true)
  public List<Map<String, Object>> listExperiments() {
    String tenantSlug = getTenantSlug();
    if (dataEngineClient == null) return List.of();
    return dataEngineClient.listMlExperiments(tenantSlug);
  }
}
