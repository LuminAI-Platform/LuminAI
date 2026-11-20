package com.luminai.dataset.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

/**
 * Continuous boundary data quality rule for datasets.
 */
@Entity
@Table(name = "data_quality_rules")
public class DataQualityRule {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @NotNull
  @Column(name = "tenant_id", nullable = false)
  private UUID tenantId;

  @Column(name = "dataset_id")
  private UUID datasetId;

  @NotBlank
  @Column(name = "rule_name", nullable = false)
  private String ruleName;

  @NotBlank
  @Column(nullable = false, length = 50)
  private String dimension = "COMPLETENESS";

  @Column(name = "column_name")
  private String columnName;

  @NotBlank
  @Column(name = "rule_type", nullable = false, length = 50)
  private String ruleType = "NOT_NULL";

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(columnDefinition = "jsonb")
  private String parameters = "{}";

  @Column(nullable = false, length = 20)
  private String severity = "ERROR";

  @Column(nullable = false, length = 20)
  private String status = "ACTIVE";

  @Column(name = "last_run_at")
  private Instant lastRunAt;

  @Column(name = "last_status", length = 20)
  private String lastStatus;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @UpdateTimestamp
  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  public DataQualityRule() {}

  public UUID getId() { return id; }
  public void setId(UUID id) { this.id = id; }

  public UUID getTenantId() { return tenantId; }
  public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

  public UUID getDatasetId() { return datasetId; }
  public void setDatasetId(UUID datasetId) { this.datasetId = datasetId; }

  public String getRuleName() { return ruleName; }
  public void setRuleName(String ruleName) { this.ruleName = ruleName; }

  public String getDimension() { return dimension; }
  public void setDimension(String dimension) { this.dimension = dimension; }

  public String getColumnName() { return columnName; }
  public void setColumnName(String columnName) { this.columnName = columnName; }

  public String getRuleType() { return ruleType; }
  public void setRuleType(String ruleType) { this.ruleType = ruleType; }

  public String getParameters() { return parameters; }
  public void setParameters(String parameters) { this.parameters = parameters; }

  public String getSeverity() { return severity; }
  public void setSeverity(String severity) { this.severity = severity; }

  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }

  public Instant getLastRunAt() { return lastRunAt; }
  public void setLastRunAt(Instant lastRunAt) { this.lastRunAt = lastRunAt; }

  public String getLastStatus() { return lastStatus; }
  public void setLastStatus(String lastStatus) { this.lastStatus = lastStatus; }

  public Instant getCreatedAt() { return createdAt; }
  public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

  public Instant getUpdatedAt() { return updatedAt; }
  public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
