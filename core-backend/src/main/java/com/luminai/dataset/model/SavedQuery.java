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
 * Analyst workspace saved queries with visualization configurations.
 */
@Entity
@Table(name = "saved_queries")
public class SavedQuery {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @NotNull
  @Column(name = "tenant_id", nullable = false)
  private UUID tenantId;

  @NotBlank
  @Column(nullable = false)
  private String title;

  @Column(columnDefinition = "TEXT")
  private String description;

  @NotBlank
  @Column(name = "sql_query", nullable = false, columnDefinition = "TEXT")
  private String sqlQuery;

  @Column(name = "dataset_id")
  private UUID datasetId;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "visual_config", columnDefinition = "jsonb")
  private String visualConfig = "{}";

  @Column(name = "created_by")
  private UUID createdBy;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @UpdateTimestamp
  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  public SavedQuery() {}

  public UUID getId() { return id; }
  public void setId(UUID id) { this.id = id; }

  public UUID getTenantId() { return tenantId; }
  public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

  public String getTitle() { return title; }
  public void setTitle(String title) { this.title = title; }

  public String getDescription() { return description; }
  public void setDescription(String description) { this.description = description; }

  public String getSqlQuery() { return sqlQuery; }
  public void setSqlQuery(String sqlQuery) { this.sqlQuery = sqlQuery; }

  public UUID getDatasetId() { return datasetId; }
  public void setDatasetId(UUID datasetId) { this.datasetId = datasetId; }

  public String getVisualConfig() { return visualConfig; }
  public void setVisualConfig(String visualConfig) { this.visualConfig = visualConfig; }

  public UUID getCreatedBy() { return createdBy; }
  public void setCreatedBy(UUID createdBy) { this.createdBy = createdBy; }

  public Instant getCreatedAt() { return createdAt; }
  public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

  public Instant getUpdatedAt() { return updatedAt; }
  public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
