package com.luminai.dataset.service;

import com.luminai.common.exception.ResourceNotFoundException;
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
      DatasetLineageRepository lineageRepository, DatasetRepository datasetRepository) {
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
    List<Dataset> datasets = datasetRepository.findAllByTenantIdOrderByUpdatedAtDesc(tenantId);
    Map<UUID, Dataset> datasetMap = new LinkedHashMap<>();
    for (Dataset d : datasets) {
      datasetMap.put(d.getId(), d);
    }

    List<DatasetLineage> validEdges =
        lineageRepository.findAllByTenantId(tenantId).stream()
            .filter(
                e ->
                    datasetMap.containsKey(e.getSourceDatasetId())
                        && datasetMap.containsKey(e.getTargetDatasetId()))
            .toList();

    List<Dataset> scopedDatasets = datasets;
    List<DatasetLineage> scopedEdges = validEdges;

    if (datasetId != null) {
      if (!datasetMap.containsKey(datasetId)) {
        throw new ResourceNotFoundException("Dataset", datasetId);
      }

      Map<UUID, Set<UUID>> adjacency = new HashMap<>();
      for (DatasetLineage e : validEdges) {
        adjacency
            .computeIfAbsent(e.getSourceDatasetId(), k -> new LinkedHashSet<>())
            .add(e.getTargetDatasetId());
        adjacency
            .computeIfAbsent(e.getTargetDatasetId(), k -> new LinkedHashSet<>())
            .add(e.getSourceDatasetId());
      }

      Set<UUID> connectedIds = new LinkedHashSet<>();
      Deque<UUID> queue = new ArrayDeque<>();
      connectedIds.add(datasetId);
      queue.add(datasetId);
      while (!queue.isEmpty()) {
        UUID current = queue.poll();
        for (UUID neighbor : adjacency.getOrDefault(current, Set.of())) {
          if (connectedIds.add(neighbor)) {
            queue.add(neighbor);
          }
        }
      }

      scopedDatasets = datasets.stream().filter(d -> connectedIds.contains(d.getId())).toList();
      scopedEdges =
          validEdges.stream()
              .filter(
                  e ->
                      connectedIds.contains(e.getSourceDatasetId())
                          && connectedIds.contains(e.getTargetDatasetId()))
              .toList();
    }

    List<Map<String, Object>> nodes = new ArrayList<>();
    for (Dataset d : scopedDatasets) {
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
    for (DatasetLineage e : scopedEdges) {
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
  public void deleteLineageForDataset(UUID tenantId, UUID datasetId) {
    UUID safeTenantId = (tenantId != null) ? tenantId : requireTenant();
    lineageRepository.deleteBySourceDatasetIdAndTenantId(datasetId, safeTenantId);
    lineageRepository.deleteByTargetDatasetIdAndTenantId(datasetId, safeTenantId);
  }

  @Transactional
  public DatasetLineage recordLineage(
      UUID sourceId, UUID targetId, UUID pipelineId, String transformType) {
    return recordLineage(null, sourceId, targetId, pipelineId, transformType, "[]");
  }

  @Transactional
  public DatasetLineage recordLineage(
      UUID tenantId,
      UUID sourceId,
      UUID targetId,
      UUID pipelineId,
      String transformType,
      String columnLineage) {
    UUID safeTenantId = (tenantId != null) ? tenantId : requireTenant();
    DatasetLineage lineage = new DatasetLineage();
    lineage.setTenantId(safeTenantId);
    lineage.setSourceDatasetId(sourceId);
    lineage.setTargetDatasetId(targetId);
    lineage.setPipelineId(pipelineId);
    lineage.setTransformationType(transformType != null ? transformType : "TRANSFORM");
    if (columnLineage != null) {
      lineage.setColumnLineage(columnLineage);
    }
    return lineageRepository.save(lineage);
  }
}
