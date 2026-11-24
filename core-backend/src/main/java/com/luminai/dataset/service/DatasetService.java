package com.luminai.dataset.service;

import com.luminai.common.exception.ResourceNotFoundException;
import com.luminai.common.tenant.TenantContext;
import com.luminai.dataset.dto.CreateDatasetRequest;
import com.luminai.dataset.dto.DatasetDto;
import com.luminai.dataset.dto.DatasetVersionDto;
import com.luminai.dataset.model.Dataset;
import com.luminai.dataset.model.DatasetVersion;
import com.luminai.dataset.repository.DatasetRepository;
import com.luminai.dataset.repository.DatasetVersionRepository;
import com.luminai.engine.service.DataEngineClient;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DatasetService {

  private static final Logger log = LoggerFactory.getLogger(DatasetService.class);

  private final DatasetRepository datasetRepository;
  private final DatasetVersionRepository versionRepository;
  private final DataEngineClient dataEngineClient;
  private LineageService lineageService;

  @Autowired(required = false)
  public void setLineageService(LineageService lineageService) {
    this.lineageService = lineageService;
  }

  public DatasetService(
      DatasetRepository datasetRepository, DatasetVersionRepository versionRepository) {
    this(datasetRepository, versionRepository, null);
  }

  @Autowired
  public DatasetService(
      DatasetRepository datasetRepository,
      DatasetVersionRepository versionRepository,
      @Autowired(required = false) DataEngineClient dataEngineClient) {
    this.datasetRepository = datasetRepository;
    this.versionRepository = versionRepository;
    this.dataEngineClient = dataEngineClient;
  }

  private UUID requireTenant() {
    UUID tenantId = TenantContext.getTenantUuid();
    if (tenantId == null) {
      throw new AccessDeniedException("Unauthorized: missing tenant context");
    }
    return tenantId;
  }

  @Transactional(readOnly = true)
  public List<DatasetDto> listDatasets(Dataset.Layer layer, Dataset.ProjectType projectType) {
    return listDatasets(layer, projectType, null);
  }

  @Transactional(readOnly = true)
  public List<DatasetDto> listDatasets(
      Dataset.Layer layer, Dataset.ProjectType projectType, String search) {
    UUID tenantId = requireTenant();
    List<Dataset> list;
    if (layer != null && projectType != null) {
      list =
          datasetRepository.findAllByTenantIdOrderByUpdatedAtDesc(tenantId).stream()
              .filter(d -> d.getLayer() == layer && d.getProjectType() == projectType)
              .toList();
    } else if (layer != null) {
      list = datasetRepository.findAllByTenantIdAndLayerOrderByUpdatedAtDesc(tenantId, layer);
    } else if (projectType != null) {
      list =
          datasetRepository.findAllByTenantIdAndProjectTypeOrderByUpdatedAtDesc(
              tenantId, projectType);
    } else {
      list = datasetRepository.findAllByTenantIdOrderByUpdatedAtDesc(tenantId);
    }

    if (search != null && !search.isBlank()) {
      String q = search.trim().toLowerCase();
      list =
          list.stream()
              .filter(
                  d ->
                      (d.getName() != null && d.getName().toLowerCase().contains(q))
                          || (d.getDisplayName() != null
                              && d.getDisplayName().toLowerCase().contains(q))
                          || (d.getDescription() != null
                              && d.getDescription().toLowerCase().contains(q)))
              .toList();
    }

    return list.stream().map(DatasetDto::fromEntity).toList();
  }

  @Transactional(readOnly = true)
  public DatasetDto getDataset(UUID id) {
    UUID tenantId = requireTenant();
    Dataset dataset =
        datasetRepository
            .findByIdAndTenantId(id, tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("Dataset", id));
    return DatasetDto.fromEntity(dataset);
  }

  @Transactional
  public DatasetDto createDataset(CreateDatasetRequest req) {
    UUID tenantId = requireTenant();
    log.info("Creating dataset '{}' for tenant {}", req.name(), tenantId);

    Dataset dataset = new Dataset();
    dataset.setTenantId(tenantId);
    dataset.setName(req.name());
    dataset.setDisplayName(req.displayName());
    dataset.setDescription(req.description());
    if (req.layer() != null) dataset.setLayer(req.layer());
    if (req.projectType() != null) dataset.setProjectType(req.projectType());
    dataset.setSourceConnectionId(req.sourceConnectionId());
    dataset.setStorageLocation(req.storageLocation());
    dataset.setRowCount(req.rowCount());
    dataset.setByteSize(req.byteSize());
    if (req.schemaMetadata() != null) dataset.setSchemaMetadata(req.schemaMetadata());

    Dataset saved = datasetRepository.save(dataset);

    // Initial version 1
    DatasetVersion v1 = new DatasetVersion();
    v1.setTenantId(tenantId);
    v1.setDatasetId(saved.getId());
    v1.setVersion(1);
    v1.setStorageLocation(req.storageLocation());
    v1.setRowCount(req.rowCount());
    v1.setSchemaSnapshot(saved.getSchemaMetadata());
    v1.setCommitMessage("Initial dataset commit");
    versionRepository.save(v1);

    return DatasetDto.fromEntity(saved);
  }

  @Transactional
  public DatasetVersionDto commitVersion(
      UUID datasetId,
      String storageLocation,
      long rowCount,
      String schema,
      String profiling,
      String commitMessage) {
    UUID tenantId = requireTenant();
    Dataset dataset =
        datasetRepository
            .findByIdAndTenantId(datasetId, tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("Dataset", datasetId));

    int nextVersion = dataset.getCurrentVersion() + 1;
    dataset.setCurrentVersion(nextVersion);
    dataset.setRowCount(rowCount);
    if (storageLocation != null) dataset.setStorageLocation(storageLocation);
    if (schema != null) dataset.setSchemaMetadata(schema);
    if (profiling != null) dataset.setProfilingSummary(profiling);
    datasetRepository.save(dataset);

    DatasetVersion version = new DatasetVersion();
    version.setTenantId(tenantId);
    version.setDatasetId(datasetId);
    version.setVersion(nextVersion);
    version.setStorageLocation(
        storageLocation != null ? storageLocation : dataset.getStorageLocation());
    version.setRowCount(rowCount);
    version.setSchemaSnapshot(schema != null ? schema : dataset.getSchemaMetadata());
    version.setProfilingSnapshot(profiling != null ? profiling : "{}");
    version.setCommitMessage(commitMessage != null ? commitMessage : "Version " + nextVersion);

    DatasetVersion savedVersion = versionRepository.save(version);
    return DatasetVersionDto.fromEntity(savedVersion);
  }

  @Transactional(readOnly = true)
  public List<DatasetVersionDto> getVersions(UUID datasetId) {
    UUID tenantId = requireTenant();
    return versionRepository
        .findAllByDatasetIdAndTenantIdOrderByVersionDesc(datasetId, tenantId)
        .stream()
        .map(DatasetVersionDto::fromEntity)
        .toList();
  }

  @Transactional
  public DatasetDto updateProfiling(
      UUID datasetId, String profilingSummary, Dataset.QualityStatus status) {
    UUID tenantId = requireTenant();
    Dataset dataset =
        datasetRepository
            .findByIdAndTenantId(datasetId, tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("Dataset", datasetId));

    if (profilingSummary != null) dataset.setProfilingSummary(profilingSummary);
    if (status != null) dataset.setQualityStatus(status);

    Dataset saved = datasetRepository.save(dataset);
    return DatasetDto.fromEntity(saved);
  }

  @Transactional
  public DatasetDto registerRawDataset(
      UUID tenantId,
      UUID connectionId,
      String name,
      String displayName,
      String storageLocation,
      long rowCount,
      long byteSize,
      String schemaJson) {
    if (tenantId == null) {
      tenantId = requireTenant();
    }
    log.info(
        "Registering/updating RAW dataset '{}' for tenant {} from connection {}",
        name,
        tenantId,
        connectionId);

    Optional<Dataset> existingOpt = Optional.empty();
    if (connectionId != null) {
      existingOpt = datasetRepository.findBySourceConnectionIdAndTenantId(connectionId, tenantId);
    }
    if (existingOpt.isEmpty()) {
      existingOpt = datasetRepository.findByNameAndTenantId(name, tenantId);
    }

    Dataset dataset;
    boolean isNew = false;
    if (existingOpt.isPresent()) {
      dataset = existingOpt.get();
      dataset.setRowCount(rowCount);
      dataset.setByteSize(byteSize);
      if (storageLocation != null) dataset.setStorageLocation(storageLocation);
      if (schemaJson != null) dataset.setSchemaMetadata(schemaJson);
      if (connectionId != null) dataset.setSourceConnectionId(connectionId);
      int nextVersion = dataset.getCurrentVersion() + 1;
      dataset.setCurrentVersion(nextVersion);
    } else {
      isNew = true;
      dataset = new Dataset();
      dataset.setTenantId(tenantId);
      String finalName = name;
      if (datasetRepository.existsByNameAndTenantId(finalName, tenantId)) {
        String suffix =
            connectionId != null
                ? connectionId.toString().substring(0, 8)
                : UUID.randomUUID().toString().substring(0, 8);
        finalName = name + "_" + suffix;
      }
      dataset.setName(finalName);
      dataset.setDisplayName(displayName != null ? displayName : finalName);
      dataset.setDescription("Ingested raw dataset from file connection " + connectionId);
      dataset.setLayer(Dataset.Layer.RAW);
      dataset.setProjectType(Dataset.ProjectType.SOURCE);
      dataset.setSourceConnectionId(connectionId);
      dataset.setStorageLocation(storageLocation);
      dataset.setRowCount(rowCount);
      dataset.setByteSize(byteSize);
      if (schemaJson != null) dataset.setSchemaMetadata(schemaJson);
      dataset.setCurrentVersion(1);
    }

    Dataset saved = datasetRepository.save(dataset);

    DatasetVersion version = new DatasetVersion();
    version.setTenantId(tenantId);
    version.setDatasetId(saved.getId());
    version.setVersion(saved.getCurrentVersion());
    version.setStorageLocation(
        storageLocation != null ? storageLocation : saved.getStorageLocation());
    version.setRowCount(rowCount);
    version.setSchemaSnapshot(schemaJson != null ? schemaJson : saved.getSchemaMetadata());
    version.setCommitMessage(isNew ? "Initial RAW dataset ingestion" : "Updated RAW dataset sync");
    versionRepository.save(version);

    return DatasetDto.fromEntity(saved);
  }

  @Transactional
  public DatasetDto transitionLayer(UUID datasetId, Dataset.Layer targetLayer) {
    UUID tenantId = requireTenant();
    Dataset dataset =
        datasetRepository
            .findByIdAndTenantId(datasetId, tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("Dataset", datasetId));

    log.info(
        "Transitioning dataset '{}' layer from {} to {}",
        datasetId,
        dataset.getLayer(),
        targetLayer);
    dataset.setLayer(targetLayer);
    Dataset saved = datasetRepository.save(dataset);
    return DatasetDto.fromEntity(saved);
  }

  @Transactional
  public void deleteDataset(UUID datasetId) {
    UUID tenantId = requireTenant();
    Dataset dataset =
        datasetRepository
            .findByIdAndTenantId(datasetId, tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("Dataset", datasetId));
    log.info("Deleting dataset '{}' for tenant {}", datasetId, tenantId);
    datasetRepository.deleteByIdAndTenantId(datasetId, tenantId);
  }

  public Map<String, Object> generateEdaReport(
      UUID datasetId, List<Map<String, Object>> sampleRecords) {
    UUID tenantId = requireTenant();
    String slug = TenantContext.getTenantSlug();
    Dataset dataset =
        datasetRepository
            .findByIdAndTenantId(datasetId, tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("Dataset", datasetId));

    if (dataEngineClient == null) {
      return Map.of("status", "ERROR", "error", "Data Engine client is offline");
    }

    Map<String, Object> edaReq = new java.util.LinkedHashMap<>();
    edaReq.put("tenant_id", slug != null ? slug : "acme");
    edaReq.put("dataset_name", dataset.getName());
    edaReq.put("records", sampleRecords != null ? sampleRecords : List.of());
    return dataEngineClient.generateEdaReport(edaReq);
  }

  public Map<String, Object> previewCleaning(Map<String, Object> requestPayload) {
    if (dataEngineClient == null) {
      return Map.of("status", "ERROR", "error", "Data Engine client is offline");
    }
    return dataEngineClient.previewCleaning(requestPayload);
  }

  @Transactional
  public Map<String, Object> executeCleaningRecipe(Map<String, Object> requestPayload) {
    if (dataEngineClient == null) {
      return Map.of("status", "ERROR", "error", "Data Engine client is offline");
    }
    Map<String, Object> outcome = dataEngineClient.executeCleaningRecipe(requestPayload);
    if (outcome != null && !outcome.containsKey("error")) {
      try {
        UUID tenantId = TenantContext.getTenantUuid();
        Object srcIdObj = requestPayload.get("sourceDatasetId");
        if (lineageService != null && srcIdObj != null && tenantId != null) {
          UUID srcId = UUID.fromString(srcIdObj.toString());
          String outName = String.valueOf(outcome.getOrDefault("dataset_name", "clean_dataset"));
          Dataset cleanDs = new Dataset();
          cleanDs.setTenantId(tenantId);
          cleanDs.setName(outName);
          cleanDs.setDisplayName("Cleaned: " + outName);
          cleanDs.setLayer(Dataset.Layer.WORKING);
          cleanDs.setProjectType(Dataset.ProjectType.PREPARATION);
          cleanDs.setRowCount(
              outcome.get("total_output_rows") instanceof Number n ? n.longValue() : 0L);
          Dataset saved = datasetRepository.save(cleanDs);
          lineageService.recordLineage(tenantId, srcId, saved.getId(), null, "CLEANING", "[]");
          log.info("Recorded persistent cleaning lineage: {} -> {}", srcId, saved.getId());
        }
      } catch (Exception e) {
        log.warn("Lineage recording skipped for cleaning execution: {}", e.getMessage());
      }
    }
    return outcome;
  }

  @Transactional
  public Map<String, Object> executePipeline(Map<String, Object> requestPayload) {
    if (dataEngineClient == null) {
      return Map.of("status", "ERROR", "error", "Data Engine client is offline");
    }
    Map<String, Object> outcome = dataEngineClient.executePipeline(requestPayload);
    if (outcome != null && !outcome.containsKey("error")) {
      try {
        UUID tenantId = TenantContext.getTenantUuid();
        Object srcIdObj = requestPayload.get("primaryDatasetId");
        if (lineageService != null && srcIdObj != null && tenantId != null) {
          UUID srcId = UUID.fromString(srcIdObj.toString());
          String curName =
              String.valueOf(outcome.getOrDefault("curated_dataset_name", "curated_dataset"));
          Dataset curDs = new Dataset();
          curDs.setTenantId(tenantId);
          curDs.setName(curName);
          curDs.setDisplayName("Curated: " + curName);
          curDs.setLayer(Dataset.Layer.CURATED);
          curDs.setProjectType(Dataset.ProjectType.TRANSFORMATION);
          curDs.setRowCount(
              outcome.get("total_output_rows") instanceof Number n ? n.longValue() : 0L);
          Dataset saved = datasetRepository.save(curDs);
          lineageService.recordLineage(
              tenantId, srcId, saved.getId(), null, "TRANSFORMATION_PIPELINE", "[]");
          log.info("Recorded persistent pipeline lineage: {} -> {}", srcId, saved.getId());
        }
      } catch (Exception e) {
        log.warn("Lineage recording skipped for pipeline execution: {}", e.getMessage());
      }
    }
    return outcome;
  }
}
