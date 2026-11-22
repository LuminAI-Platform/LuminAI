package com.luminai.dataset.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.luminai.common.tenant.TenantContext;
import com.luminai.dataset.dto.CreateDatasetRequest;
import com.luminai.dataset.dto.DatasetDto;
import com.luminai.dataset.model.Dataset;
import com.luminai.dataset.model.DatasetVersion;
import com.luminai.dataset.repository.DatasetRepository;
import com.luminai.dataset.repository.DatasetVersionRepository;
import com.luminai.engine.service.DataEngineClient;
import java.util.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class DatasetServiceTest {

  @Mock private DatasetRepository datasetRepository;
  @Mock private DatasetVersionRepository versionRepository;
  @Mock private DataEngineClient dataEngineClient;

  @InjectMocks private DatasetService datasetService;

  private final UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");
  private final UUID datasetId = UUID.randomUUID();

  @BeforeEach
  void setUp() {
    TenantContext.setTenant(tenantId, "test_tenant");
  }

  @AfterEach
  void tearDown() {
    TenantContext.clear();
  }

  @Test
  @DisplayName("createDataset creates dataset and initial version 1")
  void testCreateDataset() {
    CreateDatasetRequest req =
        new CreateDatasetRequest(
            "raw_customers",
            "Raw Customers",
            "Customer data",
            Dataset.Layer.RAW,
            Dataset.ProjectType.SOURCE,
            null,
            "[\"id\",\"name\"]",
            "minio://bucket/raw.csv",
            100L,
            1024L);

    Dataset savedEntity = new Dataset();
    savedEntity.setId(datasetId);
    savedEntity.setTenantId(tenantId);
    savedEntity.setName(req.name());
    savedEntity.setDisplayName(req.displayName());
    savedEntity.setLayer(Dataset.Layer.RAW);
    savedEntity.setCurrentVersion(1);

    when(datasetRepository.save(any(Dataset.class))).thenReturn(savedEntity);
    when(versionRepository.save(any(DatasetVersion.class))).thenAnswer(i -> i.getArgument(0));

    DatasetDto dto = datasetService.createDataset(req);
    assertNotNull(dto);
    assertEquals("raw_customers", dto.name());
    assertEquals(Dataset.Layer.RAW, dto.layer());
    verify(versionRepository, times(1)).save(any(DatasetVersion.class));
  }

  @Test
  @DisplayName("registerRawDataset creates new RAW dataset and commits initial version")
  void testRegisterRawDatasetNew() {
    UUID connId = UUID.randomUUID();
    when(datasetRepository.findBySourceConnectionIdAndTenantId(connId, tenantId))
        .thenReturn(Optional.empty());
    when(datasetRepository.findByNameAndTenantId("sales_raw", tenantId))
        .thenReturn(Optional.empty());

    Dataset saved = new Dataset();
    saved.setId(datasetId);
    saved.setName("sales_raw");
    saved.setLayer(Dataset.Layer.RAW);
    saved.setCurrentVersion(1);

    when(datasetRepository.save(any(Dataset.class))).thenReturn(saved);
    when(versionRepository.save(any(DatasetVersion.class))).thenAnswer(i -> i.getArgument(0));

    DatasetDto dto =
        datasetService.registerRawDataset(
            tenantId,
            connId,
            "sales_raw",
            "Sales Raw",
            "s3://bucket/sales.csv",
            500L,
            50000L,
            "[\"tx_id\",\"amount\"]");

    assertNotNull(dto);
    assertEquals("sales_raw", dto.name());
    assertEquals(Dataset.Layer.RAW, dto.layer());
    verify(datasetRepository, times(1)).save(any(Dataset.class));
    verify(versionRepository, times(1)).save(any(DatasetVersion.class));
  }

  @Test
  @DisplayName("transitionLayer updates dataset layer to WORKING or CURATED")
  void testTransitionLayer() {
    Dataset existing = new Dataset();
    existing.setId(datasetId);
    existing.setTenantId(tenantId);
    existing.setName("orders");
    existing.setLayer(Dataset.Layer.RAW);

    when(datasetRepository.findByIdAndTenantId(datasetId, tenantId))
        .thenReturn(Optional.of(existing));
    when(datasetRepository.save(any(Dataset.class))).thenAnswer(i -> i.getArgument(0));

    DatasetDto updated = datasetService.transitionLayer(datasetId, Dataset.Layer.WORKING);
    assertNotNull(updated);
    assertEquals(Dataset.Layer.WORKING, updated.layer());

    DatasetDto curated = datasetService.transitionLayer(datasetId, Dataset.Layer.CURATED);
    assertEquals(Dataset.Layer.CURATED, curated.layer());
  }

  @Test
  @DisplayName("generateEdaReport delegates to DataEngineClient")
  void testGenerateEdaReport() {
    Dataset existing = new Dataset();
    existing.setId(datasetId);
    existing.setName("orders");

    when(datasetRepository.findByIdAndTenantId(datasetId, tenantId))
        .thenReturn(Optional.of(existing));
    when(dataEngineClient.generateEdaReport(any()))
        .thenReturn(Map.of("summary", Map.of("rows", 100), "status", "SUCCESS"));

    Map<String, Object> report =
        datasetService.generateEdaReport(datasetId, List.of(Map.of("col1", "val1")));

    assertNotNull(report);
    assertEquals("SUCCESS", report.get("status"));
    verify(dataEngineClient, times(1)).generateEdaReport(any());
  }

  @Test
  @DisplayName("deleteDataset removes dataset by ID and tenant")
  void testDeleteDataset() {
    Dataset existing = new Dataset();
    existing.setId(datasetId);
    existing.setTenantId(tenantId);

    when(datasetRepository.findByIdAndTenantId(datasetId, tenantId))
        .thenReturn(Optional.of(existing));

    datasetService.deleteDataset(datasetId);
    verify(datasetRepository, times(1)).deleteByIdAndTenantId(datasetId, tenantId);
  }
}
