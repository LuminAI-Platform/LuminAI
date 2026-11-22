package com.luminai.dataset.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.luminai.common.tenant.TenantContext;
import com.luminai.dataset.dto.MlModelDto;
import com.luminai.dataset.dto.TrainModelRequestDto;
import com.luminai.dataset.model.MlModel;
import com.luminai.dataset.repository.MlModelRepository;
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
class MlModelServiceTest {

  @Mock private MlModelRepository mlModelRepository;
  @Mock private DataEngineClient dataEngineClient;

  private MlModelService mlModelService;
  private final ObjectMapper objectMapper = new ObjectMapper();
  private final UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");
  private final UUID modelId = UUID.randomUUID();
  private final UUID datasetId = UUID.randomUUID();

  @BeforeEach
  void setUp() {
    mlModelService = new MlModelService(mlModelRepository, dataEngineClient, objectMapper);
    TenantContext.setTenant(tenantId, "acme");
  }

  @AfterEach
  void tearDown() {
    TenantContext.clear();
  }

  @Test
  @DisplayName("trainAndPersist triggers training on Data Engine and persists model in PostgreSQL")
  void testTrainAndPersist() {
    TrainModelRequestDto req =
        new TrainModelRequestDto(
            "Customer Churn Predictor",
            datasetId,
            "churn_dataset",
            1,
            "churn",
            List.of(Map.of("age", 30, "churn", 0)),
            List.of("age"),
            "Random Forest",
            "CLASSIFICATION",
            0.2,
            Map.of("n_estimators", 100));

    Map<String, Object> engineOutcome = new HashMap<>();
    engineOutcome.put("status", "SUCCESS");
    engineOutcome.put("run_id", "run-12345");
    engineOutcome.put("metrics", Map.of("accuracy", 0.95, "f1_score", 0.94));

    when(dataEngineClient.trainMlModel(any())).thenReturn(engineOutcome);
    when(mlModelRepository.save(any(MlModel.class)))
        .thenAnswer(
            inv -> {
              MlModel m = inv.getArgument(0);
              m.setId(modelId);
              return m;
            });

    Map<String, Object> result = mlModelService.trainAndPersist(req);

    assertNotNull(result);
    assertEquals("SUCCESS", result.get("status"));
    assertTrue(result.containsKey("persistedModel"));

    MlModelDto dto = (MlModelDto) result.get("persistedModel");
    assertEquals("Customer Churn Predictor", dto.name());
    assertEquals("CHALLENGER", dto.status());
    verify(mlModelRepository, times(1)).save(any(MlModel.class));
  }

  @Test
  @DisplayName("promoteModel updates status and demotes previous champion for the same dataset")
  void testPromoteModelDemotesPreviousChampion() {
    MlModel existingModel = new MlModel();
    existingModel.setId(modelId);
    existingModel.setTenantId(tenantId);
    existingModel.setTrainingDatasetId(datasetId);
    existingModel.setName("Model B");
    existingModel.setStatus("CHALLENGER");

    UUID prevChampionId = UUID.randomUUID();
    MlModel prevChampion = new MlModel();
    prevChampion.setId(prevChampionId);
    prevChampion.setTenantId(tenantId);
    prevChampion.setTrainingDatasetId(datasetId);
    prevChampion.setName("Model A");
    prevChampion.setStatus("CHAMPION");

    when(mlModelRepository.findByIdAndTenantId(modelId, tenantId))
        .thenReturn(Optional.of(existingModel));
    when(mlModelRepository.findAllByTenantIdAndStatus(tenantId, "CHAMPION"))
        .thenReturn(List.of(prevChampion));
    when(mlModelRepository.save(any(MlModel.class))).thenAnswer(inv -> inv.getArgument(0));

    MlModelDto promoted = mlModelService.promoteModel(modelId, "CHAMPION");

    assertNotNull(promoted);
    assertEquals("CHAMPION", promoted.status());

    // Verify previous champion was demoted to CHALLENGER
    assertEquals("CHALLENGER", prevChampion.getStatus());
    verify(mlModelRepository, atLeast(2)).save(any(MlModel.class));
  }

  @Test
  @DisplayName("listExperiments fetches leaderboard from DataEngineClient")
  void testListExperiments() {
    when(dataEngineClient.listMlExperiments("acme"))
        .thenReturn(List.of(Map.of("run_id", "run-1", "accuracy", 0.92)));

    List<Map<String, Object>> experiments = mlModelService.listExperiments();
    assertNotNull(experiments);
    assertEquals(1, experiments.size());
    verify(dataEngineClient, times(1)).listMlExperiments("acme");
  }
}
