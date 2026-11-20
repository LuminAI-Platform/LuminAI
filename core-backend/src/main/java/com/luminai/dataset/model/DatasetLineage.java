package com.luminai.dataset.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** End-to-end dataset-level and column-level lineage graph edge. */
@Entity
@Table(name = "dataset_lineage")
public class DatasetLineage {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @NotNull
  @Column(name = "tenant_id", nullable = false)
  private UUID tenantId;

  @NotNull
  @Column(name = "source_dataset_id", nullable = false)
  private UUID sourceDatasetId;

  @NotNull
  @Column(name = "target_dataset_id", nullable = false)
  private UUID targetDatasetId;

  @Column(name = "pipeline_id")
  private UUID pipelineId;

  @Column(name = "transformation_type", nullable = false, length = 50)
  private String transformationType = "TRANSFORM";

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "column_lineage", columnDefinition = "jsonb")
  private String columnLineage = "[]";

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  public DatasetLineage() {}

  public UUID getId() {
    return id;
  }

  public void setId(UUID id) {
    this.id = id;
  }

  public UUID getTenantId() {
    return tenantId;
  }

  public void setTenantId(UUID tenantId) {
    this.tenantId = tenantId;
  }

  public UUID getSourceDatasetId() {
    return sourceDatasetId;
  }

  public void setSourceDatasetId(UUID sourceDatasetId) {
    this.sourceDatasetId = sourceDatasetId;
  }

  public UUID getTargetDatasetId() {
    return targetDatasetId;
  }

  public void setTargetDatasetId(UUID targetDatasetId) {
    this.targetDatasetId = targetDatasetId;
  }

  public UUID getPipelineId() {
    return pipelineId;
  }

  public void setPipelineId(UUID pipelineId) {
    this.pipelineId = pipelineId;
  }

  public String getTransformationType() {
    return transformationType;
  }

  public void setTransformationType(String transformationType) {
    this.transformationType = transformationType;
  }

  public String getColumnLineage() {
    return columnLineage;
  }

  public void setColumnLineage(String columnLineage) {
    this.columnLineage = columnLineage;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(Instant createdAt) {
    this.createdAt = createdAt;
  }
}
