package com.luminai.connection.dto;

import com.luminai.connection.model.CleaningRule;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;

/** Data Transfer Objects for CleaningRule CRUD operations. */
public final class CleaningRuleDto {

  private CleaningRuleDto() {}

  // Request DTOs

  /** Request body for creating a new cleaning rule. */
  public record CreateRequest(
      @NotBlank(message = "columnName is required") String columnName,
      @NotNull(message = "ruleType is required") CleaningRule.RuleType ruleType,
      String ruleConfig,
      @Min(value = 0, message = "priority must be >= 0") int priority,
      Boolean enabled) {
    /** Defaults enabled to true and ruleConfig to empty JSON if not provided. */
    public CreateRequest {
      if (enabled == null) {
        enabled = true;
      }
      if (ruleConfig == null) {
        ruleConfig = "{}";
      }
    }
  }

  /** Request body for updating an existing cleaning rule. */
  public record UpdateRequest(
      String columnName,
      CleaningRule.RuleType ruleType,
      String ruleConfig,
      Integer priority,
      Boolean enabled) {}

  // Response DTOs

  /** Response body returned from all cleaning rule endpoints. */
  public record Response(
      UUID id,
      UUID tenantId,
      UUID connectionId,
      String columnName,
      CleaningRule.RuleType ruleType,
      String ruleConfig,
      int priority,
      boolean enabled,
      Instant createdAt,
      Instant updatedAt) {
    /** Factory method to convert a JPA entity to a response DTO. */
    public static Response from(CleaningRule entity) {
      return new Response(
          entity.getId(),
          entity.getTenantId(),
          entity.getConnectionId(),
          entity.getColumnName(),
          entity.getRuleType(),
          entity.getRuleConfig(),
          entity.getPriority(),
          entity.isEnabled(),
          entity.getCreatedAt(),
          entity.getUpdatedAt());
    }
  }
}
