package com.luminai.dataset.service;

import com.luminai.common.tenant.TenantContext;
import com.luminai.dataset.dto.LineageGraphDto;
import com.luminai.dataset.model.Dataset;
import com.luminai.dataset.model.DatasetLineage;
import com.luminai.dataset.repository.DatasetLineageRepository;
import com.luminai.dataset.repository.DatasetRepository;
import java.util.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LineageService {

  private final DatasetLineageRepository lineageRepository;
  private final DatasetRepository datasetRepository;

  public LineageService(
      DatasetLineageRepository lineageRepository,
      DatasetRepository datasetRepository
  ) {
    this.lineageRepository = lineageRepository;
    this.datasetRepository = datasetRepository;
  }

  private UUID requireTenant() {
    UUID tenantId = TenantContext.getTenantUuid();
    if (tenantId == null) {
      throw new AccessDeniedException("Unauthorized: missing tenant context");
    }
    return tenantId;
  }

  @Transactional(readOnly = true)
  public LineageGraphDto getLineageGraph(UUID datasetId) {
    UUID tenantId = requireTenant();
    List<DatasetLineage> edges = datasetId != null
        ? lineageRepository.findAllByTenantId(tenantId)
        : lineageRepository.findAllByTenantId(tenantId);

    List<Dataset> datasets = datasetRepository.findAllByTenantIdOrderByUpdatedAtDesc(tenantId);
    Map<UUID, Dataset> datasetMap = new HashMap<>();
    for (Dataset d : datasets) {
      datasetMap.put(d.getId(), d);
    }

    List<Map<String, Object>> nodes = new ArrayList<>();
    for (Dataset d : datasets) {
      Map<String, Object> node = new LinkedHashMap<>();
      node.put("id", d.getId().toString());
      node.put("label", d.getDisplayName() != null ? d.getDisplayName() : d.getName());
      node.put("layer", d.getLayer().name());
      node.put("projectType", d.getProjectType().name());
      node.put("rowCount", d.getRowCount());
      node.put("qualityStatus", d.getQualityStatus().name());
      nodes.add(node);
    }

    List<Map<String, Object>> edgeList = new ArrayList<>();
    for (DatasetLineage e : edges) {
      Map<String, Object> edge = new LinkedHashMap<>();
      edge.put("id", e.getId().toString());
      edge.put("source", e.getSourceDatasetId().toString());
      edge.put("target", e.getTargetDatasetId().toString());
      edge.put("transformationType", e.getTransformationType());
      edgeList.add(edge);
    }

    return new LineageGraphDto(nodes, edgeList);
  }

  @Transactional
  public DatasetLineage recordLineage(UUID sourceId, UUID targetId, UUID pipelineId, String transformType) {
    UUID tenantId = requireTenant();
    DatasetLineage lineage = new DatasetLineage();
    lineage.setTenantId(tenantId);
    lineage.setSourceDatasetId(sourceId);
    lineage.setTargetDatasetId(targetId);
    lineage.setPipelineId(pipelineId);
    lineage.setTransformationType(transformType != null ? transformType : "TRANSFORM");
    return lineageRepository.save(lineage);
  }
}
