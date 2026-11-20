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
 * Data Science experiment run and registered machine learning model.
 */
@Entity
@Table(name = "ml_models")
public class MlModel {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @NotNull
  @Column(name = "tenant_id", nullable = false)
  private UUID tenantId;

  @NotBlank
  @Column(nullable = false)
  private String name;

  @NotBlank
  @Column(nullable = false, length = 100)
  private String algorithm;

  @NotBlank
  @Column(name = "task_type", nullable = false, length = 50)
  private String taskType = "CLASSIFICATION";

  @Column(name = "training_dataset_id")
  private UUID trainingDatasetId;

  @Column(name = "dataset_version")
  private Integer datasetVersion = 1;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(columnDefinition = "jsonb")
  private String features = "[]";

  @Column(name = "target_column")
  private String targetColumn;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(columnDefinition = "jsonb")
  private String hyperparameters = "{}";

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(columnDefinition = "jsonb")
  private String metrics = "{}";

  @Column(nullable = false, length = 50)
  private String status = "CHALLENGER";

  @Column(name = "model_artifact_path", length = 1000)
  private String modelArtifactPath;

  @Column(name = "created_by")
  private UUID createdBy;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @UpdateTimestamp
  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  public MlModel() {}

  public UUID getId() { return id; }
  public void setId(UUID id) { this.id = id; }

  public UUID getTenantId() { return tenantId; }
  public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

  public String getName() { return name; }
  public void setName(String name) { this.name = name; }

  public String getAlgorithm() { return algorithm; }
  public void setAlgorithm(String algorithm) { this.algorithm = algorithm; }

  public String getTaskType() { return taskType; }
  public void setTaskType(String taskType) { this.taskType = taskType; }

  public UUID getTrainingDatasetId() { return trainingDatasetId; }
  public void setTrainingDatasetId(UUID trainingDatasetId) { this.trainingDatasetId = trainingDatasetId; }

  public Integer getDatasetVersion() { return datasetVersion; }
  public void setDatasetVersion(Integer datasetVersion) { this.datasetVersion = datasetVersion; }

  public String getFeatures() { return features; }
  public void setFeatures(String features) { this.features = features; }

  public String getTargetColumn() { return targetColumn; }
  public void setTargetColumn(String targetColumn) { this.targetColumn = targetColumn; }

  public String getHyperparameters() { return hyperparameters; }
  public void setHyperparameters(String hyperparameters) { this.hyperparameters = hyperparameters; }

  public String getMetrics() { return metrics; }
  public void setMetrics(String metrics) { this.metrics = metrics; }

  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }

  public String getModelArtifactPath() { return modelArtifactPath; }
  public void setModelArtifactPath(String modelArtifactPath) { this.modelArtifactPath = modelArtifactPath; }

  public UUID getCreatedBy() { return createdBy; }
  public void setCreatedBy(UUID createdBy) { this.createdBy = createdBy; }

  public Instant getCreatedAt() { return createdAt; }
  public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

  public Instant getUpdatedAt() { return updatedAt; }
  public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
