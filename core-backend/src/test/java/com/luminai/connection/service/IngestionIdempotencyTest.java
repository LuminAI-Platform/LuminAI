package com.luminai.connection.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.luminai.common.tenant.TenantContext;
import com.luminai.dataset.dto.DatasetDto;
import com.luminai.dataset.model.Dataset;
import com.luminai.dataset.model.DatasetVersion;
import com.luminai.dataset.repository.DatasetRepository;
import com.luminai.dataset.repository.DatasetVersionRepository;
import com.luminai.dataset.service.DatasetService;
import java.util.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class IngestionIdempotencyTest {

  @Mock private DatasetRepository datasetRepository;
  @Mock private DatasetVersionRepository versionRepository;

  private DatasetService datasetService;

  private final UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");
  private final UUID connectionId1 = UUID.fromString("11111111-1111-1111-1111-111111111111");
  private final UUID connectionId2 = UUID.fromString("22222222-2222-2222-2222-222222222222");

  @BeforeEach
  void setUp() {
    datasetService = new DatasetService(datasetRepository, versionRepository, null);
    TenantContext.setTenant(tenantId, "acme");
  }

  @AfterEach
  void tearDown() {
    TenantContext.clear();
  }

  @Test
  @DisplayName(
      "Re-uploading the same connection increments version to v2 without duplicating dataset")
  void testReuploadSameConnectionIncrementsVersion() {
    Dataset existing = new Dataset();
    existing.setId(UUID.randomUUID());
    existing.setTenantId(tenantId);
    existing.setSourceConnectionId(connectionId1);
    existing.setName("sales_data");
    existing.setLayer(Dataset.Layer.RAW);
    existing.setCurrentVersion(1);
    existing.setRowCount(100);

    when(datasetRepository.findBySourceConnectionIdAndTenantId(connectionId1, tenantId))
        .thenReturn(Optional.of(existing));
    when(datasetRepository.save(any(Dataset.class))).thenAnswer(i -> i.getArgument(0));
    when(versionRepository.save(any(DatasetVersion.class))).thenAnswer(i -> i.getArgument(0));

    DatasetDto updated =
        datasetService.registerRawDataset(
            tenantId,
            connectionId1,
            "sales_data",
            "Sales Data",
            "s3://bucket/sales_v2.csv",
            250L,
            25000L,
            "[\"id\",\"amount\"]");

    assertNotNull(updated);
    assertEquals(2, updated.currentVersion());
    assertEquals(250L, updated.rowCount());
    verify(datasetRepository, times(1)).save(existing);
    verify(versionRepository, times(1))
        .save(argThat(v -> v.getVersion() == 2 && v.getRowCount() == 250L));
  }

  @Test
  @DisplayName("Uploading same file name from different connection disambiguates dataset name")
  void testDisambiguateSameFileNameDifferentConnection() {
    when(datasetRepository.findBySourceConnectionIdAndTenantId(connectionId2, tenantId))
        .thenReturn(Optional.empty());
    when(datasetRepository.findByNameAndTenantId("sales_data", tenantId))
        .thenReturn(Optional.empty());
    when(datasetRepository.existsByNameAndTenantId("sales_data", tenantId)).thenReturn(true);

    when(datasetRepository.save(any(Dataset.class)))
        .thenAnswer(
            i -> {
              Dataset d = i.getArgument(0);
              d.setId(UUID.randomUUID());
              return d;
            });
    when(versionRepository.save(any(DatasetVersion.class))).thenAnswer(i -> i.getArgument(0));

    DatasetDto created =
        datasetService.registerRawDataset(
            tenantId,
            connectionId2,
            "sales_data",
            "Sales Data",
            "s3://bucket/conn2_sales.csv",
            50L,
            5000L,
            "[\"col1\"]");

    assertNotNull(created);
    assertTrue(created.name().startsWith("sales_data_22222222"));
    assertEquals(1, created.currentVersion());
  }

  @Test
  @DisplayName("Partial failure during version persistence propagates error for rollback")
  void testPartialFailureRollsBack() {
    when(datasetRepository.findBySourceConnectionIdAndTenantId(connectionId1, tenantId))
        .thenReturn(Optional.empty());
    when(datasetRepository.findByNameAndTenantId("orders", tenantId)).thenReturn(Optional.empty());

    when(datasetRepository.save(any(Dataset.class)))
        .thenAnswer(
            i -> {
              Dataset d = i.getArgument(0);
              d.setId(UUID.randomUUID());
              return d;
            });

    when(versionRepository.save(any(DatasetVersion.class)))
        .thenThrow(new RuntimeException("Disk full on metadata storage"));

    assertThrows(
        RuntimeException.class,
        () ->
            datasetService.registerRawDataset(
                tenantId,
                connectionId1,
                "orders",
                "Orders",
                "s3://bucket/orders.csv",
                10L,
                1000L,
                "[]"));
  }
}
