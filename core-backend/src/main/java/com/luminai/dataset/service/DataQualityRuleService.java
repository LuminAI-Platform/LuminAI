package com.luminai.dataset.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luminai.common.exception.ResourceNotFoundException;
import com.luminai.common.tenant.TenantContext;
import com.luminai.dataset.dto.DataQualityRuleDto;
import com.luminai.dataset.model.DataQualityRule;
import com.luminai.dataset.model.Dataset;
import com.luminai.dataset.repository.DataQualityRuleRepository;
import com.luminai.dataset.repository.DatasetRepository;
import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Service managing tenant-scoped continuous Data Quality Rules and dataset evaluation runs. */
@Service
public class DataQualityRuleService {

  private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

  private final DataQualityRuleRepository ruleRepository;
  private final DatasetRepository datasetRepository;
  private final DatasetService datasetService;
  private final ObjectMapper objectMapper;

  public DataQualityRuleService(
      DataQualityRuleRepository ruleRepository,
      DatasetRepository datasetRepository,
      DatasetService datasetService,
      ObjectMapper objectMapper) {
    this.ruleRepository = ruleRepository;
    this.datasetRepository = datasetRepository;
    this.datasetService = datasetService;
    this.objectMapper = objectMapper;
  }

  private UUID requireTenant() {
    UUID tenantId = TenantContext.getTenantUuid();
    if (tenantId == null) {
      throw new AccessDeniedException("Unauthorized: missing tenant context");
    }
    return tenantId;
  }

  private Dataset requireDataset(UUID datasetId, UUID tenantId) {
    return datasetRepository
        .findByIdAndTenantId(datasetId, tenantId)
        .orElseThrow(() -> new ResourceNotFoundException("Dataset", datasetId));
  }

  @Transactional(readOnly = true)
  public List<DataQualityRuleDto.Response> listRules(UUID datasetId) {
    UUID tenantId = requireTenant();
    requireDataset(datasetId, tenantId);
    return ruleRepository.findAllByTenantIdAndDatasetId(tenantId, datasetId).stream()
        .map(DataQualityRuleDto.Response::fromEntity)
        .toList();
  }

  @Transactional
  public DataQualityRuleDto.Response createRule(
      UUID datasetId, DataQualityRuleDto.CreateRequest req) {
    UUID tenantId = requireTenant();
    requireDataset(datasetId, tenantId);

    DataQualityRule rule = new DataQualityRule();
    rule.setTenantId(tenantId);
    rule.setDatasetId(datasetId);
    rule.setRuleName(req.ruleName().trim());
    rule.setDimension(req.dimension().trim().toUpperCase());
    rule.setColumnName(req.columnName() != null ? req.columnName().trim() : null);
    rule.setRuleType(req.ruleType().trim().toUpperCase());
    rule.setSeverity(
        req.severity() != null && !req.severity().isBlank()
            ? req.severity().trim().toUpperCase()
            : "ERROR");
    rule.setStatus("ACTIVE");
    try {
      rule.setParameters(
          req.parameters() != null ? objectMapper.writeValueAsString(req.parameters()) : "{}");
    } catch (Exception e) {
      rule.setParameters("{}");
    }

    DataQualityRule saved = ruleRepository.save(rule);
    return DataQualityRuleDto.Response.fromEntity(saved);
  }

  @Transactional
  public void deleteRule(UUID datasetId, UUID ruleId) {
    UUID tenantId = requireTenant();
    DataQualityRule rule =
        ruleRepository
            .findByIdAndTenantId(ruleId, tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("DataQualityRule", ruleId));
    if (!Objects.equals(rule.getDatasetId(), datasetId)) {
      throw new ResourceNotFoundException("DataQualityRule", ruleId);
    }
    ruleRepository.delete(rule);
  }

  @Transactional
  public DataQualityRuleDto.EvaluationSummary evaluateRules(UUID datasetId) {
    UUID tenantId = requireTenant();
    Dataset dataset = requireDataset(datasetId, tenantId);
    List<DataQualityRule> rules = ruleRepository.findAllByTenantIdAndDatasetId(tenantId, datasetId);
    List<Map<String, Object>> records = datasetService.loadDatasetRecords(dataset, 5000);
    Instant now = Instant.now();

    if (rules.isEmpty()) {
      return new DataQualityRuleDto.EvaluationSummary(datasetId, 0, 0, 0, now, List.of());
    }

    int passedCount = 0;
    int failedRulesCount = 0;
    List<DataQualityRuleDto.RuleEvaluationResult> results = new ArrayList<>();

    for (DataQualityRule rule : rules) {
      DataQualityRuleDto.RuleEvaluationResult res = evaluateSingleRule(rule, records);
      rule.setLastRunAt(now);
      rule.setLastStatus(res.status());
      ruleRepository.save(rule);
      if ("PASSED".equals(res.status())) {
        passedCount++;
      } else if ("FAILED".equals(res.status())) {
        failedRulesCount++;
      }
      results.add(res);
    }

    return new DataQualityRuleDto.EvaluationSummary(
        datasetId, rules.size(), passedCount, failedRulesCount, now, results);
  }

  private DataQualityRuleDto.RuleEvaluationResult evaluateSingleRule(
      DataQualityRule rule, List<Map<String, Object>> records) {
    if (records == null || records.isEmpty()) {
      return new DataQualityRuleDto.RuleEvaluationResult(
          rule.getId(),
          rule.getRuleName(),
          rule.getDimension(),
          rule.getColumnName(),
          rule.getRuleType(),
          "SKIPPED",
          0,
          0,
          0.0,
          List.of("No dataset records available to evaluate."));
    }

    Map<String, Object> params = parseParameters(rule.getParameters());
    String col = rule.getColumnName();
    String ruleType = rule.getRuleType() != null ? rule.getRuleType().toUpperCase() : "NOT_NULL";

    int failed = 0;
    List<String> failures = new ArrayList<>();
    Set<String> seenUnique = new HashSet<>();

    Pattern compiledPattern = null;
    if ("REGEX".equals(ruleType)) {
      String patternStr = String.valueOf(params.getOrDefault("pattern", ".*"));
      compiledPattern = Pattern.compile(patternStr);
    }

    Double thresholdMin = parseDoubleOrNull(params.getOrDefault("min", params.get("value")));
    Double thresholdMax = parseDoubleOrNull(params.getOrDefault("max", params.get("value")));
    Set<String> allowedValues = extractAllowedValues(params.get("values"));

    for (int i = 0; i < records.size(); i++) {
      Map<String, Object> row = records.get(i);
      Object rawVal = col != null ? row.get(col) : null;
      String strVal = rawVal != null ? String.valueOf(rawVal).trim() : null;
      boolean isMissing = rawVal == null || (strVal != null && strVal.isEmpty());

      String err = null;
      switch (ruleType) {
        case "NOT_NULL" -> {
          if (isMissing) err = "Row " + (i + 1) + ": missing value";
        }
        case "UNIQUE" -> {
          if (!isMissing && !seenUnique.add(strVal)) {
            err = "Row " + (i + 1) + ": duplicate value '" + strVal + "'";
          }
        }
        case "MIN_VALUE" -> {
          if (!isMissing && thresholdMin != null) {
            Double num = parseDoubleOrNull(rawVal);
            if (num == null || num < thresholdMin) {
              err = "Row " + (i + 1) + ": value '" + strVal + "' < min " + thresholdMin;
            }
          }
        }
        case "MAX_VALUE" -> {
          if (!isMissing && thresholdMax != null) {
            Double num = parseDoubleOrNull(rawVal);
            if (num == null || num > thresholdMax) {
              err = "Row " + (i + 1) + ": value '" + strVal + "' > max " + thresholdMax;
            }
          }
        }
        case "REGEX" -> {
          if (!isMissing && compiledPattern != null && !compiledPattern.matcher(strVal).matches()) {
            err = "Row " + (i + 1) + ": value '" + strVal + "' failed pattern match";
          }
        }
        case "ALLOWED_VALUES" -> {
          if (!isMissing && !allowedValues.isEmpty() && !allowedValues.contains(strVal)) {
            err = "Row " + (i + 1) + ": unexpected value '" + strVal + "'";
          }
        }
        default -> {
          if (isMissing) err = "Row " + (i + 1) + ": null value";
        }
      }

      if (err != null) {
        failed++;
        if (failures.size() < 5) {
          failures.add(err);
        }
      }
    }

    int total = records.size();
    double passRate = total > 0 ? Math.round(((total - failed) * 1000.0) / total) / 10.0 : 100.0;
    String evalStatus = failed == 0 ? "PASSED" : "FAILED";

    return new DataQualityRuleDto.RuleEvaluationResult(
        rule.getId(),
        rule.getRuleName(),
        rule.getDimension(),
        col,
        ruleType,
        evalStatus,
        total,
        failed,
        passRate,
        failures);
  }

  private Map<String, Object> parseParameters(String json) {
    if (json == null || json.isBlank()) return Map.of();
    try {
      return objectMapper.readValue(json, MAP_TYPE);
    } catch (Exception e) {
      return Map.of();
    }
  }

  private static Double parseDoubleOrNull(Object val) {
    if (val == null) return null;
    if (val instanceof Number n) return n.doubleValue();
    try {
      return Double.parseDouble(String.valueOf(val).trim());
    } catch (NumberFormatException e) {
      return null;
    }
  }

  private static Set<String> extractAllowedValues(Object raw) {
    if (raw instanceof Collection<?> col) {
      Set<String> set = new LinkedHashSet<>();
      for (Object item : col) {
        if (item != null) set.add(String.valueOf(item).trim());
      }
      return set;
    }
    if (raw instanceof String s && !s.isBlank()) {
      Set<String> set = new LinkedHashSet<>();
      for (String part : s.split(",")) {
        if (!part.trim().isEmpty()) set.add(part.trim());
      }
      return set;
    }
    return Set.of();
  }
}
