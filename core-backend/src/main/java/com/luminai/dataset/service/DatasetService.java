package com.luminai.dataset.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luminai.common.exception.ResourceNotFoundException;
import com.luminai.common.tenant.TenantContext;
import com.luminai.connection.service.MinioStorageService;
import com.luminai.dataset.dto.CreateDatasetRequest;
import com.luminai.dataset.dto.DatasetDto;
import com.luminai.dataset.dto.DatasetVersionDto;
import com.luminai.dataset.model.Dataset;
import com.luminai.dataset.model.DatasetVersion;
import com.luminai.dataset.repository.DataQualityRuleRepository;
import com.luminai.dataset.repository.DatasetRepository;
import com.luminai.dataset.repository.DatasetVersionRepository;
import com.luminai.engine.service.DataEngineClient;
import java.io.ByteArrayInputStream;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DatasetService {

  private static final Logger log = LoggerFactory.getLogger(DatasetService.class);
  private static final ObjectMapper EDA_MAPPER = new ObjectMapper();

  private final DatasetRepository datasetRepository;
  private final DatasetVersionRepository versionRepository;
  private final DataEngineClient dataEngineClient;
  private LineageService lineageService;
  private com.luminai.connection.repository.ConnectionPreviewService connectionPreviewService;
  private MinioStorageService minioStorageService;
  private DataQualityRuleRepository dataQualityRuleRepository;

  @Autowired(required = false)
  public void setLineageService(LineageService lineageService) {
    this.lineageService = lineageService;
  }

  @Autowired(required = false)
  public void setConnectionPreviewService(
      com.luminai.connection.repository.ConnectionPreviewService connectionPreviewService) {
    this.connectionPreviewService = connectionPreviewService;
  }

  @Autowired(required = false)
  public void setMinioStorageService(MinioStorageService minioStorageService) {
    this.minioStorageService = minioStorageService;
  }

  @Autowired(required = false)
  public void setDataQualityRuleRepository(DataQualityRuleRepository dataQualityRuleRepository) {
    this.dataQualityRuleRepository = dataQualityRuleRepository;
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
    return registerRawDataset(
        tenantId,
        connectionId,
        name,
        displayName,
        storageLocation,
        rowCount,
        byteSize,
        schemaJson,
        false);
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
      String schemaJson,
      boolean allowMultiplePerConnection) {
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
      existingOpt =
          allowMultiplePerConnection
              ? datasetRepository.findBySourceConnectionIdAndNameAndTenantId(
                  connectionId, name, tenantId)
              : datasetRepository.findBySourceConnectionIdAndTenantId(connectionId, tenantId);
    }
    if (existingOpt.isEmpty()) {
      Optional<Dataset> byName = datasetRepository.findByNameAndTenantId(name, tenantId);
      if (byName.isPresent()
          && (connectionId == null
              || byName.get().getSourceConnectionId() == null
              || connectionId.equals(byName.get().getSourceConnectionId()))) {
        existingOpt = byName;
      }
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

    String storageLoc = dataset.getStorageLocation();
    if (minioStorageService != null
        && storageLoc != null
        && storageLoc.startsWith(tenantId + "/datasets/" + datasetId + "/")) {
      try {
        minioStorageService.delete(storageLoc);
      } catch (Exception e) {
        log.warn("Failed to remove dataset storage object '{}': {}", storageLoc, e.getMessage());
      }
    }

    versionRepository.deleteByDatasetIdAndTenantId(datasetId, tenantId);
    if (dataQualityRuleRepository != null) {
      dataQualityRuleRepository.deleteByDatasetIdAndTenantId(datasetId, tenantId);
    }
    if (lineageService != null) {
      lineageService.deleteLineageForDataset(tenantId, datasetId);
    }
    datasetRepository.deleteByIdAndTenantId(datasetId, tenantId);
  }

  @Transactional(readOnly = true)
  public Map<String, Object> previewDataset(UUID datasetId, int limit) {
    UUID tenantId = requireTenant();
    Dataset dataset =
        datasetRepository
            .findByIdAndTenantId(datasetId, tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("Dataset", datasetId));

    int capped = limit > 0 ? Math.min(limit, 1000) : 100;
    List<Map<String, Object>> rows = loadDatasetRecords(dataset, capped);
    List<Map<String, String>> columns = resolvePreviewColumns(dataset, rows);

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("datasetId", dataset.getId());
    result.put(
        "datasetName",
        dataset.getDisplayName() != null ? dataset.getDisplayName() : dataset.getName());
    result.put("columns", columns);
    result.put("rows", rows);
    result.put("totalRows", dataset.getRowCount());
    result.put("previewCount", rows.size());
    return result;
  }

  @SuppressWarnings("unchecked")
  public List<Map<String, Object>> loadDatasetRecords(Dataset dataset, int maxRows) {
    if (dataset == null) {
      return List.of();
    }
    int capped = maxRows > 0 ? Math.min(maxRows, 5000) : 500;
    String storageLoc = dataset.getStorageLocation();
    boolean hasTenantStorageKey =
        storageLoc != null
            && !storageLoc.isBlank()
            && dataset.getTenantId() != null
            && storageLoc.startsWith(dataset.getTenantId() + "/");

    if (hasTenantStorageKey && connectionPreviewService != null) {
      List<Map<String, Object>> storageRows =
          connectionPreviewService.previewStorageObject(dataset.getTenantId(), storageLoc, capped);
      if (storageRows != null && !storageRows.isEmpty()) {
        return storageRows;
      }
    }

    if (hasTenantStorageKey && dataEngineClient != null) {
      Map<String, Object> previewReq = new LinkedHashMap<>();
      previewReq.put("tenant_id", dataset.getTenantId().toString());
      previewReq.put("storage_location", storageLoc);
      previewReq.put("limit", Math.min(capped, 500));
      Map<String, Object> enginePreview = dataEngineClient.previewDataset(previewReq);
      if (enginePreview != null
          && enginePreview.get("rows") instanceof List<?> rawRows
          && !rawRows.isEmpty()) {
        List<Map<String, Object>> parsed = new ArrayList<>(rawRows.size());
        for (Object item : rawRows) {
          if (item instanceof Map<?, ?> m) {
            parsed.add((Map<String, Object>) m);
          }
        }
        if (!parsed.isEmpty()) {
          return parsed;
        }
      }
    }

    if (dataset.getSourceConnectionId() != null && connectionPreviewService != null) {
      String tableCandidate =
          (dataset.getDisplayName() != null && !dataset.getDisplayName().isBlank())
              ? dataset.getDisplayName()
              : dataset.getName();
      List<Map<String, Object>> tableRows =
          connectionPreviewService.previewTable(dataset.getSourceConnectionId(), tableCandidate);
      if ((tableRows == null || tableRows.isEmpty())
          && dataset.getName() != null
          && !dataset.getName().equals(tableCandidate)) {
        tableRows =
            connectionPreviewService.previewTable(
                dataset.getSourceConnectionId(), dataset.getName());
      }
      if (tableRows != null && !tableRows.isEmpty()) {
        return tableRows.size() > capped ? tableRows.subList(0, capped) : tableRows;
      }

      List<Map<String, Object>> fileRows =
          connectionPreviewService.previewFile(dataset.getSourceConnectionId());
      if (fileRows != null && !fileRows.isEmpty()) {
        return fileRows.size() > capped ? fileRows.subList(0, capped) : fileRows;
      }
    }

    return List.of();
  }

  public Map<String, Object> generateEdaReport(
      UUID datasetId, List<Map<String, Object>> sampleRecords) {
    UUID tenantId = requireTenant();
    Dataset dataset =
        datasetRepository
            .findByIdAndTenantId(datasetId, tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("Dataset", datasetId));

    if (dataEngineClient == null) {
      return Map.of("status", "ERROR", "error", "Data Engine client is offline");
    }

    String storageLoc = dataset.getStorageLocation();
    boolean hasTenantStorageKey =
        storageLoc != null && !storageLoc.isBlank() && storageLoc.startsWith(tenantId + "/");

    List<Map<String, Object>> records = sampleRecords;
    if ((records == null || records.isEmpty()) && !hasTenantStorageKey) {
      records = loadDatasetRecords(dataset, 2000);
    }
    if ((records == null || records.isEmpty()) && !hasTenantStorageKey) {
      return Map.of(
          "status",
          "ERROR",
          "error",
          "No sample records available for dataset '" + dataset.getName() + "' to profile");
    }

    Map<String, Object> edaReq = new LinkedHashMap<>();
    edaReq.put("tenant_id", tenantId.toString());
    edaReq.put("dataset_name", dataset.getName());
    if (hasTenantStorageKey) {
      edaReq.put("storage_location", storageLoc);
    }
    if (records != null && !records.isEmpty()) {
      edaReq.put("records", records);
    }
    Map<String, Object> report = dataEngineClient.generateEdaReport(edaReq);
    if (report != null
        && !report.containsKey("error")
        && !"ERROR".equalsIgnoreCase(String.valueOf(report.get("status")))) {
      try {
        dataset.setProfilingSummary(EDA_MAPPER.writeValueAsString(report));
        backfillTypedSchemaFromReport(dataset, report);
        datasetRepository.save(dataset);
      } catch (Exception e) {
        log.debug(
            "Failed persisting EDA profilingSummary for dataset {}: {}", datasetId, e.getMessage());
      }
    }
    return report;
  }

  public Map<String, Object> previewCleaning(Map<String, Object> requestPayload) {
    if (dataEngineClient == null) {
      return Map.of("status", "ERROR", "error", "Data Engine client is offline");
    }
    UUID tenantId = TenantContext.getTenantUuid();
    Map<String, Object> prepared =
        prepareCleaningOrPipelinePayload(requestPayload, tenantId, true, false);
    return dataEngineClient.previewCleaning(prepared);
  }

  @Transactional
  public Map<String, Object> executeCleaningRecipe(Map<String, Object> requestPayload) {
    if (dataEngineClient == null) {
      return Map.of("status", "ERROR", "error", "Data Engine client is offline");
    }
    UUID tenantId = TenantContext.getTenantUuid();
    Map<String, Object> prepared =
        prepareCleaningOrPipelinePayload(requestPayload, tenantId, false, false);
    Map<String, Object> outcome = dataEngineClient.executeCleaningRecipe(prepared);
    if (outcome != null && !outcome.containsKey("error")) {
      try {
        Object srcIdObj =
            resolveFirstNonNull(
                requestPayload, "sourceDatasetId", "source_dataset_id", "datasetId");
        if (tenantId != null
            && (lineageService != null || outcome.get("rows") instanceof List<?>)) {
          UUID srcId = srcIdObj != null ? UUID.fromString(srcIdObj.toString()) : null;
          String requestedName =
              String.valueOf(
                  outcome.getOrDefault(
                      "dataset_name", requestPayload.getOrDefault("datasetName", "clean_dataset")));
          Dataset saved =
              persistDerivedDataset(
                  tenantId,
                  srcId,
                  requestedName,
                  "Cleaned: " + requestedName,
                  Dataset.Layer.WORKING,
                  Dataset.ProjectType.PREPARATION,
                  "CLEANING",
                  outcome,
                  List.of());
          Map<String, Object> enriched = new LinkedHashMap<>(outcome);
          enriched.put("datasetId", saved.getId().toString());
          enriched.put("dataset_id", saved.getId().toString());
          enriched.put("datasetName", saved.getName());
          if (saved.getStorageLocation() != null) {
            enriched.put("storageLocation", saved.getStorageLocation());
          }
          return enriched;
        }
      } catch (Exception e) {
        log.warn("Lineage or persistence skipped for cleaning execution: {}", e.getMessage());
      }
    }
    return outcome;
  }

  @Transactional
  public Map<String, Object> executePipeline(Map<String, Object> requestPayload) {
    if (dataEngineClient == null) {
      return Map.of("status", "ERROR", "error", "Data Engine client is offline");
    }
    UUID tenantId = TenantContext.getTenantUuid();
    Map<String, Object> prepared =
        prepareCleaningOrPipelinePayload(requestPayload, tenantId, false, true);
    Map<String, Object> outcome = dataEngineClient.executePipeline(prepared);
    if (outcome != null && !outcome.containsKey("error")) {
      try {
        Object srcIdObj =
            resolveFirstNonNull(requestPayload, "primaryDatasetId", "sourceDatasetId", "datasetId");
        if (tenantId != null
            && (lineageService != null || outcome.get("rows") instanceof List<?>)) {
          UUID srcId = srcIdObj != null ? UUID.fromString(srcIdObj.toString()) : null;
          String curName =
              String.valueOf(
                  outcome.getOrDefault(
                      "curated_dataset_name",
                      requestPayload.getOrDefault("datasetName", "curated_dataset")));
          List<UUID> secondaryIds = extractSecondaryDatasetIds(requestPayload);
          Dataset saved =
              persistDerivedDataset(
                  tenantId,
                  srcId,
                  curName,
                  "Curated: " + curName,
                  Dataset.Layer.CURATED,
                  Dataset.ProjectType.TRANSFORMATION,
                  "TRANSFORMATION_PIPELINE",
                  outcome,
                  secondaryIds);
          Map<String, Object> enriched = new LinkedHashMap<>(outcome);
          enriched.put("datasetId", saved.getId().toString());
          enriched.put("dataset_id", saved.getId().toString());
          enriched.put("datasetName", saved.getName());
          if (saved.getStorageLocation() != null) {
            enriched.put("storageLocation", saved.getStorageLocation());
          }
          return enriched;
        }
      } catch (Exception e) {
        log.warn("Lineage or persistence skipped for pipeline execution: {}", e.getMessage());
      }
    }
    return outcome;
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> prepareCleaningOrPipelinePayload(
      Map<String, Object> rawPayload, UUID tenantId, boolean isPreview, boolean isPipeline) {
    if (rawPayload == null || tenantId == null) {
      return rawPayload != null ? rawPayload : Map.of();
    }

    Object srcIdObj =
        isPipeline
            ? resolveFirstNonNull(rawPayload, "primaryDatasetId", "sourceDatasetId", "datasetId")
            : resolveFirstNonNull(rawPayload, "sourceDatasetId", "source_dataset_id", "datasetId");
    Dataset srcDataset = null;
    if (srcIdObj != null) {
      try {
        UUID srcId = UUID.fromString(srcIdObj.toString());
        srcDataset = datasetRepository.findByIdAndTenantId(srcId, tenantId).orElse(null);
      } catch (IllegalArgumentException ignored) {
      }
    }

    boolean hasInlineRecords = rawPayload.get("records") instanceof List<?> r && !r.isEmpty();
    boolean hasCamelKeys =
        rawPayload.containsKey("datasetName")
            || rawPayload.containsKey("secondaryDatasetIds")
            || hasCamelStepKeys(rawPayload.get("steps"))
            || (rawPayload.get("step") instanceof Map<?, ?> sm && hasCamelStepKeys(List.of(sm)));

    // Keep pass-through reference equality when neither hydration nor camelCase translation
    // applies.
    if (srcDataset == null && !hasCamelKeys) {
      return rawPayload;
    }

    Map<String, Object> prepared = new LinkedHashMap<>(rawPayload);
    prepared.put("tenant_id", tenantId.toString());
    if (prepared.containsKey("datasetName") && !prepared.containsKey("dataset_name")) {
      prepared.put("dataset_name", prepared.get("datasetName"));
    }

    if (!hasInlineRecords && srcDataset != null) {
      String storageLoc = srcDataset.getStorageLocation();
      if (storageLoc != null && storageLoc.startsWith(tenantId + "/")) {
        prepared.putIfAbsent("storage_location", storageLoc);
      } else {
        List<Map<String, Object>> loaded = loadDatasetRecords(srcDataset, 5000);
        if (!loaded.isEmpty()) {
          prepared.put("records", loaded);
        }
      }
    }

    if (rawPayload.get("step") instanceof Map<?, ?> singleStep) {
      prepared.put("step", translateStepMap((Map<String, Object>) singleStep, isPipeline));
    }
    if (rawPayload.get("steps") instanceof List<?> rawSteps) {
      List<Map<String, Object>> translatedSteps = new ArrayList<>(rawSteps.size());
      for (Object s : rawSteps) {
        if (s instanceof Map<?, ?> sm) {
          translatedSteps.add(translateStepMap((Map<String, Object>) sm, isPipeline));
        }
      }
      prepared.put("steps", translatedSteps);
    }

    if (isPipeline && rawPayload.get("secondaryDatasetIds") instanceof Map<?, ?> secIdsMap) {
      Map<String, List<Map<String, Object>>> secInline = new LinkedHashMap<>();
      Map<String, String> secStorage = new LinkedHashMap<>();
      for (Map.Entry<?, ?> entry : secIdsMap.entrySet()) {
        if (entry.getKey() == null || entry.getValue() == null) continue;
        String alias = entry.getKey().toString();
        try {
          UUID secUuid = UUID.fromString(entry.getValue().toString());
          Dataset secDs = datasetRepository.findByIdAndTenantId(secUuid, tenantId).orElse(null);
          if (secDs != null) {
            if (secDs.getStorageLocation() != null
                && secDs.getStorageLocation().startsWith(tenantId + "/")) {
              secStorage.put(alias, secDs.getStorageLocation());
            } else {
              secInline.put(alias, loadDatasetRecords(secDs, 5000));
            }
          }
        } catch (IllegalArgumentException ignored) {
        }
      }
      if (!secInline.isEmpty()) prepared.putIfAbsent("secondary_datasets", secInline);
      if (!secStorage.isEmpty()) prepared.putIfAbsent("secondary_storage_locations", secStorage);
    }

    return prepared;
  }

  private boolean hasCamelStepKeys(Object stepsObj) {
    if (!(stepsObj instanceof List<?> steps)) return false;
    for (Object item : steps) {
      if (item instanceof Map<?, ?> m
          && (m.containsKey("targetColumns")
              || m.containsKey("targetColumn")
              || m.containsKey("stepType"))) {
        return true;
      }
    }
    return false;
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> translateStepMap(Map<String, Object> rawStep, boolean isPipeline) {
    Map<String, Object> step = new LinkedHashMap<>(rawStep);
    if (isPipeline) {
      if (!step.containsKey("step_type") && step.get("stepType") != null) {
        step.put("step_type", step.get("stepType"));
      }
    } else {
      if (!step.containsKey("operation") && step.get("stepType") != null) {
        step.put("operation", step.get("stepType"));
      }
      if (!step.containsKey("column") && step.get("targetColumn") != null) {
        step.put("column", step.get("targetColumn"));
      }
      if (!step.containsKey("columns") && step.get("targetColumns") instanceof List<?> cols) {
        step.put("columns", new ArrayList<>(cols));
        if (!cols.isEmpty() && !step.containsKey("column")) {
          step.put("column", String.valueOf(cols.get(0)));
        }
      }
    }
    step.putIfAbsent("parameters", Map.of());
    return step;
  }

  @SuppressWarnings("unchecked")
  private Dataset persistDerivedDataset(
      UUID tenantId,
      UUID sourceDatasetId,
      String baseName,
      String displayName,
      Dataset.Layer layer,
      Dataset.ProjectType projectType,
      String lineageType,
      Map<String, Object> outcome,
      List<UUID> secondaryIds) {
    String cleanBase = sanitizeName(baseName);
    String finalName = cleanBase;
    if (datasetRepository.existsByNameAndTenantId(finalName, tenantId)) {
      finalName = cleanBase + "_" + UUID.randomUUID().toString().substring(0, 8);
    }

    Dataset derived = new Dataset();
    derived.setTenantId(tenantId);
    derived.setName(finalName);
    derived.setDisplayName(displayName);
    derived.setLayer(layer);
    derived.setProjectType(projectType);
    derived.setCurrentVersion(1);
    long rowCount = outcome.get("total_output_rows") instanceof Number n ? n.longValue() : 0L;
    derived.setRowCount(rowCount);

    String schemaJson = extractSchemaJsonFromOutcome(outcome);
    if (schemaJson != null) {
      derived.setSchemaMetadata(schemaJson);
    }

    if (sourceDatasetId != null) {
      datasetRepository
          .findByIdAndTenantId(sourceDatasetId, tenantId)
          .ifPresent(src -> derived.setSourceConnectionId(src.getSourceConnectionId()));
    }

    Dataset saved = datasetRepository.save(derived);

    if (minioStorageService != null && outcome.get("rows") instanceof List<?> rows) {
      try {
        byte[] jsonBytes = EDA_MAPPER.writeValueAsBytes(rows);
        String key = tenantId + "/datasets/" + saved.getId() + "/" + finalName + ".json";
        minioStorageService.upload(
            key, new ByteArrayInputStream(jsonBytes), "application/json", jsonBytes.length);
        saved.setStorageLocation(key);
        saved.setByteSize(jsonBytes.length);
        saved = datasetRepository.save(saved);
      } catch (Exception e) {
        log.warn("Failed uploading derived dataset JSON to MinIO: {}", e.getMessage());
      }
    }

    DatasetVersion v1 = new DatasetVersion();
    v1.setTenantId(tenantId);
    v1.setDatasetId(saved.getId());
    v1.setVersion(1);
    v1.setStorageLocation(saved.getStorageLocation());
    v1.setRowCount(saved.getRowCount());
    v1.setSchemaSnapshot(saved.getSchemaMetadata());
    v1.setCommitMessage("Generated by " + lineageType.toLowerCase() + " execution");
    versionRepository.save(v1);

    if (lineageService != null && sourceDatasetId != null) {
      lineageService.recordLineage(
          tenantId, sourceDatasetId, saved.getId(), null, lineageType, "[]");
      log.info(
          "Recorded persistent {} lineage: {} -> {}", lineageType, sourceDatasetId, saved.getId());
      for (UUID secId : secondaryIds) {
        lineageService.recordLineage(tenantId, secId, saved.getId(), null, "JOIN_INPUT", "[]");
      }
    }

    return saved;
  }

  private List<Map<String, String>> resolvePreviewColumns(
      Dataset dataset, List<Map<String, Object>> rows) {
    Map<String, String> schemaMap = new LinkedHashMap<>();
    String schemaJson = dataset.getSchemaMetadata();
    if (schemaJson != null && !schemaJson.isBlank()) {
      try {
        JsonNode root = EDA_MAPPER.readTree(schemaJson);
        if (root.isObject()) {
          root.fields()
              .forEachRemaining(e -> schemaMap.put(e.getKey(), e.getValue().asText("string")));
        } else if (root.isArray()) {
          for (JsonNode n : root) {
            if (n.isTextual()) {
              schemaMap.put(n.asText(), "string");
            }
          }
        }
      } catch (Exception ignored) {
      }
    }
    if (schemaMap.isEmpty() && !rows.isEmpty()) {
      for (String key : rows.get(0).keySet()) {
        Object val = rows.get(0).get(key);
        String dtype =
            val instanceof Integer || val instanceof Long
                ? "integer"
                : (val instanceof Number
                    ? "float"
                    : (val instanceof Boolean ? "boolean" : "string"));
        schemaMap.put(key, dtype);
      }
    }
    List<Map<String, String>> list = new ArrayList<>(schemaMap.size());
    schemaMap.forEach((k, v) -> list.add(Map.of("name", k, "type", v)));
    return list;
  }

  private void backfillTypedSchemaFromReport(Dataset dataset, Map<String, Object> report) {
    try {
      String existing = dataset.getSchemaMetadata();
      boolean needsSchema =
          existing == null
              || existing.isBlank()
              || existing.trim().startsWith("[")
              || "{}".equals(existing.trim());
      if (!needsSchema) return;

      Map<String, String> inferred = new LinkedHashMap<>();
      if (report.get("columns") instanceof Map<?, ?> colsMap) {
        for (Map.Entry<?, ?> entry : colsMap.entrySet()) {
          if (entry.getValue() instanceof Map<?, ?> colProf) {
            Object t = colProf.get("inferred_type");
            inferred.put(
                String.valueOf(entry.getKey()),
                t != null ? String.valueOf(t).toLowerCase() : "string");
          }
        }
      } else if (report.get("schema") instanceof Map<?, ?> schemaMap) {
        schemaMap.forEach(
            (k, v) -> inferred.put(String.valueOf(k), String.valueOf(v).toLowerCase()));
      }
      if (!inferred.isEmpty()) {
        dataset.setSchemaMetadata(EDA_MAPPER.writeValueAsString(inferred));
      }
    } catch (Exception ignored) {
    }
  }

  private String extractSchemaJsonFromOutcome(Map<String, Object> outcome) {
    try {
      Map<String, String> schema = new LinkedHashMap<>();
      if (outcome.get("columns") instanceof List<?> cols) {
        for (Object item : cols) {
          if (item instanceof Map<?, ?> colMap && colMap.get("name") != null) {
            schema.put(
                String.valueOf(colMap.get("name")),
                String.valueOf(colMap.get("type") != null ? colMap.get("type") : "string"));
          }
        }
      }
      if (!schema.isEmpty()) {
        return EDA_MAPPER.writeValueAsString(schema);
      }
    } catch (Exception ignored) {
    }
    return null;
  }

  private static Object resolveFirstNonNull(Map<String, Object> map, String... keys) {
    for (String key : keys) {
      if (map.get(key) != null) return map.get(key);
    }
    return null;
  }

  private static List<UUID> extractSecondaryDatasetIds(Map<String, Object> requestPayload) {
    List<UUID> ids = new ArrayList<>();
    if (requestPayload.get("secondaryDatasetIds") instanceof Map<?, ?> secMap) {
      for (Object val : secMap.values()) {
        if (val != null) {
          try {
            ids.add(UUID.fromString(val.toString()));
          } catch (IllegalArgumentException ignored) {
          }
        }
      }
    }
    return ids;
  }

  private static String sanitizeName(String raw) {
    String clean =
        raw == null
            ? ""
            : raw.toLowerCase().replaceAll("[^a-z0-9_]+", "_").replaceAll("^_+|_+$", "");
    return clean.isBlank() ? "dataset" : clean;
  }
}
