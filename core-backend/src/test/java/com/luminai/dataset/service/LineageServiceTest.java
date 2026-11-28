package com.luminai.dataset.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.luminai.common.tenant.TenantContext;
import com.luminai.dataset.dto.LineageGraphDto;
import com.luminai.dataset.model.Dataset;
import com.luminai.dataset.model.DatasetLineage;
import com.luminai.dataset.repository.DatasetLineageRepository;
import com.luminai.dataset.repository.DatasetRepository;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class LineageServiceTest {

  @Mock private DatasetLineageRepository lineageRepository;
  @Mock private DatasetRepository datasetRepository;

  private LineageService lineageService;
  private final UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");

  @BeforeEach
  void setUp() {
    lineageService = new LineageService(lineageRepository, datasetRepository);
    TenantContext.setTenant(tenantId, "test_tenant");
  }

  @AfterEach
  void tearDown() {
    TenantContext.clear();
  }

  @Test
  void getLineageGraphScopesToConnectedComponentWhenDatasetIdProvided() {
    UUID dsRaw = UUID.randomUUID();
    UUID dsClean = UUID.randomUUID();
    UUID dsCurated = UUID.randomUUID();
    UUID dsUnrelated = UUID.randomUUID();
    UUID dsDeleted = UUID.randomUUID();

    Dataset raw = dataset(dsRaw, "raw_orders", Dataset.Layer.RAW);
    Dataset clean = dataset(dsClean, "clean_orders", Dataset.Layer.WORKING);
    Dataset curated = dataset(dsCurated, "curated_orders", Dataset.Layer.CURATED);
    Dataset unrelated = dataset(dsUnrelated, "unrelated_hr", Dataset.Layer.RAW);

    DatasetLineage edge1 = edge(dsRaw, dsClean, "CLEANING");
    DatasetLineage edge2 = edge(dsClean, dsCurated, "TRANSFORMATION_PIPELINE");
    DatasetLineage orphanEdge = edge(dsUnrelated, dsDeleted, "CLEANING");

    when(datasetRepository.findAllByTenantIdOrderByUpdatedAtDesc(tenantId))
        .thenReturn(List.of(raw, clean, curated, unrelated));
    when(lineageRepository.findAllByTenantId(tenantId))
        .thenReturn(List.of(edge1, edge2, orphanEdge));

    LineageGraphDto scoped = lineageService.getLineageGraph(dsClean);
    assertEquals(3, scoped.nodes().size());
    assertEquals(2, scoped.edges().size());
    assertTrue(scoped.nodes().stream().noneMatch(n -> dsUnrelated.toString().equals(n.get("id"))));

    LineageGraphDto global = lineageService.getLineageGraph(null);
    assertEquals(4, global.nodes().size());
    assertEquals(
        2, global.edges().size(), "Orphan edge referencing deleted dataset must be excluded");
  }

  private Dataset dataset(UUID id, String name, Dataset.Layer layer) {
    Dataset d = new Dataset();
    d.setId(id);
    d.setTenantId(tenantId);
    d.setName(name);
    d.setDisplayName(name);
    d.setLayer(layer);
    d.setProjectType(Dataset.ProjectType.SOURCE);
    d.setQualityStatus(Dataset.QualityStatus.VERIFIED);
    return d;
  }

  private DatasetLineage edge(UUID src, UUID tgt, String type) {
    DatasetLineage l = new DatasetLineage();
    l.setId(UUID.randomUUID());
    l.setTenantId(tenantId);
    l.setSourceDatasetId(src);
    l.setTargetDatasetId(tgt);
    l.setTransformationType(type);
    return l;
  }
}
