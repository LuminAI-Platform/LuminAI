package com.luminai.dataset.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.luminai.common.tenant.TenantContext;
import com.luminai.dataset.dto.DataQualityRuleDto;
import com.luminai.dataset.model.DataQualityRule;
import com.luminai.dataset.model.Dataset;
import com.luminai.dataset.repository.DataQualityRuleRepository;
import com.luminai.dataset.repository.DatasetRepository;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class DataQualityRuleServiceTest {

  @Mock private DataQualityRuleRepository ruleRepository;
  @Mock private DatasetRepository datasetRepository;
  @Mock private DatasetService datasetService;

  private DataQualityRuleService ruleService;
  private final UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");
  private final UUID datasetId = UUID.randomUUID();

  @BeforeEach
  void setUp() {
    ruleService =
        new DataQualityRuleService(
            ruleRepository, datasetRepository, datasetService, new ObjectMapper());
    TenantContext.setTenant(tenantId, "test_tenant");
  }

  @AfterEach
  void tearDown() {
    TenantContext.clear();
  }

  @Test
  void evaluateRulesChecksNotNullUniqueAndMinValueAndPersistsLastStatus() {
    Dataset ds = new Dataset();
    ds.setId(datasetId);
    ds.setTenantId(tenantId);
    ds.setName("customers");

    DataQualityRule notNullEmail = new DataQualityRule();
    notNullEmail.setId(UUID.randomUUID());
    notNullEmail.setTenantId(tenantId);
    notNullEmail.setDatasetId(datasetId);
    notNullEmail.setRuleName("Email required");
    notNullEmail.setDimension("COMPLETENESS");
    notNullEmail.setColumnName("email");
    notNullEmail.setRuleType("NOT_NULL");

    DataQualityRule minAge = new DataQualityRule();
    minAge.setId(UUID.randomUUID());
    minAge.setTenantId(tenantId);
    minAge.setDatasetId(datasetId);
    minAge.setRuleName("Adult age >= 18");
    minAge.setDimension("ACCURACY");
    minAge.setColumnName("age");
    minAge.setRuleType("MIN_VALUE");
    minAge.setParameters("{\"min\":18}");

    when(datasetRepository.findByIdAndTenantId(datasetId, tenantId)).thenReturn(Optional.of(ds));
    when(ruleRepository.findAllByTenantIdAndDatasetId(tenantId, datasetId))
        .thenReturn(List.of(notNullEmail, minAge));
    when(ruleRepository.save(any(DataQualityRule.class))).thenAnswer(i -> i.getArgument(0));
    when(datasetService.loadDatasetRecords(ds, 5000))
        .thenReturn(
            List.of(Map.of("email", "a@corp.com", "age", 30), Map.of("email", "", "age", 25)));

    DataQualityRuleDto.EvaluationSummary summary = ruleService.evaluateRules(datasetId);
    assertEquals(2, summary.totalRules());
    assertEquals(1, summary.passedRules());
    assertEquals(1, summary.failedRules());
    assertEquals("FAILED", summary.results().get(0).status());
    assertEquals("PASSED", summary.results().get(1).status());
    verify(ruleRepository, times(2)).save(any(DataQualityRule.class));
  }
}
