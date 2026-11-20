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
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DatasetService {

  private static final Logger log = LoggerFactory.getLogger(DatasetService.class);

  private final DatasetRepository datasetRepository;
  private final DatasetVersionRepository versionRepository;

  public DatasetService(
      DatasetRepository datasetRepository,
      DatasetVersionRepository versionRepository
  ) {
    this.datasetRepository = datasetRepository;
    this.versionRepository = versionRepository;
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
    UUID tenantId = requireTenant();
    List<Dataset> list;
    if (layer != null) {
      list = datasetRepository.findAllByTenantIdAndLayerOrderByUpdatedAtDesc(tenantId, layer);
    } else if (projectType != null) {
      list = datasetRepository.findAllByTenantIdAndProjectTypeOrderByUpdatedAtDesc(tenantId, projectType);
    } else {
      list = datasetRepository.findAllByTenantIdOrderByUpdatedAtDesc(tenantId);
    }
    return list.stream().map(DatasetDto::fromEntity).toList();
  }

  @Transactional(readOnly = true)
  public DatasetDto getDataset(UUID id) {
    UUID tenantId = requireTenant();
    Dataset dataset = datasetRepository.findByIdAndTenantId(id, tenantId)
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
  public DatasetVersionDto commitVersion(UUID datasetId, String storageLocation, long rowCount, String schema, String profiling, String commitMessage) {
    UUID tenantId = requireTenant();
    Dataset dataset = datasetRepository.findByIdAndTenantId(datasetId, tenantId)
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
    version.setStorageLocation(storageLocation != null ? storageLocation : dataset.getStorageLocation());
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
    return versionRepository.findAllByDatasetIdAndTenantIdOrderByVersionDesc(datasetId, tenantId)
        .stream().map(DatasetVersionDto::fromEntity).toList();
  }

  @Transactional
  public DatasetDto updateProfiling(UUID datasetId, String profilingSummary, Dataset.QualityStatus status) {
    UUID tenantId = requireTenant();
    Dataset dataset = datasetRepository.findByIdAndTenantId(datasetId, tenantId)
        .orElseThrow(() -> new ResourceNotFoundException("Dataset", datasetId));

    if (profilingSummary != null) dataset.setProfilingSummary(profilingSummary);
    if (status != null) dataset.setQualityStatus(status);

    Dataset saved = datasetRepository.save(dataset);
    return DatasetDto.fromEntity(saved);
  }
}
