package com.luminai.connection.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

/**
 * JPA entity representing a configurable cleaning rule for a data connector. Each rule defines a
 * single transformation operation applied to a specific column during the Data Engine cleaning
 * pipeline. Rules are executed in ascending {@code priority} order. The Data Engine fetches these
 * rules via the REST API before each pipeline run. All queries MUST be scoped by {@code tenantId}
 * to enforce multi-tenant isolation at the data layer.
 */
@Entity
@Table(name = "cleaning_rules")
public class CleaningRule {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @NotNull
  @Column(name = "tenant_id", nullable = false)
  private UUID tenantId;

  @NotNull
  @Column(name = "connection_id", nullable = false)
  private UUID connectionId;

  @NotBlank
  @Column(name = "column_name", nullable = false)
  private String columnName;

  @NotNull
  @Enumerated(EnumType.STRING)
  @Column(name = "rule_type", nullable = false, length = 50)
  private RuleType ruleType;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "rule_config", nullable = false, columnDefinition = "jsonb")
  private String ruleConfig = "{}";

  @Min(0)
  @Column(nullable = false)
  private int priority;

  @Column(nullable = false)
  private boolean enabled = true;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @UpdateTimestamp
  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  // Rule type enum

  // Supported cleaning rule types that the Data Engine pipeline can execute.
  public enum RuleType {
    TRIM,
    UPPERCASE,
    LOWERCASE,
    DATE_NORMALIZE,
    NULL_FILL,
    REGEX_REPLACE,
    REMOVE_DUPLICATES
  }

  // Constructors

  protected CleaningRule() {
    // JPA requires a no-arg constructor
  }

  public CleaningRule(
      UUID tenantId,
      UUID connectionId,
      String columnName,
      RuleType ruleType,
      String ruleConfig,
      int priority,
      boolean enabled) {
    this.tenantId = tenantId;
    this.connectionId = connectionId;
    this.columnName = columnName;
    this.ruleType = ruleType;
    this.ruleConfig = ruleConfig != null ? ruleConfig : "{}";
    this.priority = priority;
    this.enabled = enabled;
  }

  // Getters & Setters

  public UUID getId() {
    return id;
  }

  public UUID getTenantId() {
    return tenantId;
  }

  public void setTenantId(UUID tenantId) {
    this.tenantId = tenantId;
  }

  public UUID getConnectionId() {
    return connectionId;
  }

  public void setConnectionId(UUID connectionId) {
    this.connectionId = connectionId;
  }

  public String getColumnName() {
    return columnName;
  }

  public void setColumnName(String columnName) {
    this.columnName = columnName;
  }

  public RuleType getRuleType() {
    return ruleType;
  }

  public void setRuleType(RuleType ruleType) {
    this.ruleType = ruleType;
  }

  public String getRuleConfig() {
    return ruleConfig;
  }

  public void setRuleConfig(String ruleConfig) {
    this.ruleConfig = ruleConfig;
  }

  public int getPriority() {
    return priority;
  }

  public void setPriority(int priority) {
    this.priority = priority;
  }

  public boolean isEnabled() {
    return enabled;
  }

  public void setEnabled(boolean enabled) {
    this.enabled = enabled;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }
}
