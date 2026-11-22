package com.luminai.dataset.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import com.luminai.common.tenant.TenantContext;
import com.luminai.dataset.model.Dataset;
import com.luminai.dataset.repository.DatasetRepository;
import com.luminai.dataset.repository.DatasetVersionRepository;
import com.luminai.engine.service.DataEngineClient;
import java.util.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class LineageIntegrationTest {

  @Mock private DatasetRepository datasetRepository;
  @Mock private DatasetVersionRepository versionRepository;
  @Mock private DataEngineClient dataEngineClient;
  @Mock private LineageService lineageService;

  private DatasetService datasetService;

  private final UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");
  private final UUID rawDatasetId = UUID.randomUUID();

  @BeforeEach
  void setUp() {
    datasetService = new DatasetService(datasetRepository, versionRepository, dataEngineClient);
    datasetService.setLineageService(lineageService);
    TenantContext.setTenant(tenantId, "acme");
  }

  @AfterEach
  void tearDown() {
    TenantContext.clear();
  }

  @Test
  @DisplayName("executeCleaningRecipe records lineage from raw dataset to working dataset")
  void testCleaningRecordsLineage() {
    Map<String, Object> req = new HashMap<>();
    req.put("sourceDatasetId", rawDatasetId.toString());
    req.put("dataset_name", "clean_customers");

    Map<String, Object> engineOutcome = new HashMap<>();
    engineOutcome.put("status", "COMPLETED");
    engineOutcome.put("dataset_name", "clean_customers");
    engineOutcome.put("total_output_rows", 85);

    when(dataEngineClient.executeCleaningRecipe(req)).thenReturn(engineOutcome);
    when(datasetRepository.save(any(Dataset.class)))
        .thenAnswer(
            i -> {
              Dataset d = i.getArgument(0);
              d.setId(UUID.randomUUID());
              return d;
            });

    Map<String, Object> res = datasetService.executeCleaningRecipe(req);

    assertNotNull(res);
    assertEquals("COMPLETED", res.get("status"));

    // Verify lineage was recorded
    verify(lineageService, times(1))
        .recordLineage(
            eq(tenantId), eq(rawDatasetId), any(UUID.class), isNull(), eq("CLEANING"), eq("[]"));
  }

  @Test
  @DisplayName("executePipeline records lineage from primary input dataset to curated dataset")
  void testPipelineRecordsLineage() {
    Map<String, Object> req = new HashMap<>();
    req.put("primaryDatasetId", rawDatasetId.toString());
    req.put("dataset_name", "curated_customers");

    Map<String, Object> engineOutcome = new HashMap<>();
    engineOutcome.put("status", "SUCCESS");
    engineOutcome.put("curated_dataset_name", "curated_customers");
    engineOutcome.put("total_output_rows", 72);

    when(dataEngineClient.executePipeline(req)).thenReturn(engineOutcome);
    when(datasetRepository.save(any(Dataset.class)))
        .thenAnswer(
            i -> {
              Dataset d = i.getArgument(0);
              d.setId(UUID.randomUUID());
              return d;
            });

    Map<String, Object> res = datasetService.executePipeline(req);

    assertNotNull(res);
    assertEquals("SUCCESS", res.get("status"));

    // Verify lineage was recorded
    verify(lineageService, times(1))
        .recordLineage(
            eq(tenantId),
            eq(rawDatasetId),
            any(UUID.class),
            isNull(),
            eq("TRANSFORMATION_PIPELINE"),
            eq("[]"));
  }
}
