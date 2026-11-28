package com.luminai.dataset.dto;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luminai.dataset.model.DataQualityRule;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class DataQualityRuleDto {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

  private DataQualityRuleDto() {}

  public record CreateRequest(
      @NotBlank String ruleName,
      @NotBlank String dimension,
      String columnName,
      @NotBlank String ruleType,
      Map<String, Object> parameters,
      String severity) {}

  public record Response(
      UUID id,
      UUID datasetId,
      String ruleName,
      String dimension,
      String columnName,
      String ruleType,
      Map<String, Object> parameters,
      String severity,
      String status,
      Instant lastRunAt,
      String lastStatus,
      Instant createdAt,
      Instant updatedAt) {

    public static Response fromEntity(DataQualityRule rule) {
      Map<String, Object> parsedParams = Map.of();
      if (rule.getParameters() != null && !rule.getParameters().isBlank()) {
        try {
          parsedParams = MAPPER.readValue(rule.getParameters(), MAP_TYPE);
        } catch (Exception ignored) {
        }
      }
      return new Response(
          rule.getId(),
          rule.getDatasetId(),
          rule.getRuleName(),
          rule.getDimension(),
          rule.getColumnName(),
          rule.getRuleType(),
          parsedParams,
          rule.getSeverity(),
          rule.getStatus(),
          rule.getLastRunAt(),
          rule.getLastStatus(),
          rule.getCreatedAt(),
          rule.getUpdatedAt());
    }
  }

  public record RuleEvaluationResult(
      UUID ruleId,
      String ruleName,
      String dimension,
      String columnName,
      String ruleType,
      String status,
      int totalEvaluated,
      int failedCount,
      double passRate,
      List<String> sampleFailures) {}

  public record EvaluationSummary(
      UUID datasetId,
      int totalRules,
      int passedRules,
      int failedRules,
      Instant evaluatedAt,
      List<RuleEvaluationResult> results) {}
}
