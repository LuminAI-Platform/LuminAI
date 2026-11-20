package com.luminai.dataset.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Immutable snapshot of a dataset version commit.
 */
@Entity
@Table(name = "dataset_versions")
public class DatasetVersion {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @NotNull
  @Column(name = "tenant_id", nullable = false)
  private UUID tenantId;

  @NotNull
  @Column(name = "dataset_id", nullable = false)
  private UUID datasetId;

  @Column(nullable = false)
  private int version;

  @Column(name = "storage_location", length = 1000)
  private String storageLocation;

  @Column(name = "row_count", nullable = false)
  private long rowCount = 0;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "schema_snapshot", columnDefinition = "jsonb")
  private String schemaSnapshot = "[]";

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "profiling_snapshot", columnDefinition = "jsonb")
  private String profilingSnapshot = "{}";

  @Column(name = "commit_message", length = 500)
  private String commitMessage;

  @Column(name = "created_by")
  private UUID createdBy;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  public DatasetVersion() {}

  public UUID getId() { return id; }
  public void setId(UUID id) { this.id = id; }

  public UUID getTenantId() { return tenantId; }
  public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

  public UUID getDatasetId() { return datasetId; }
  public void setDatasetId(UUID datasetId) { this.datasetId = datasetId; }

  public int getVersion() { return version; }
  public void setVersion(int version) { this.version = version; }

  public String getStorageLocation() { return storageLocation; }
  public void setStorageLocation(String storageLocation) { this.storageLocation = storageLocation; }

  public long getRowCount() { return rowCount; }
  public void setRowCount(long rowCount) { this.rowCount = rowCount; }

  public String getSchemaSnapshot() { return schemaSnapshot; }
  public void setSchemaSnapshot(String schemaSnapshot) { this.schemaSnapshot = schemaSnapshot; }

  public String getProfilingSnapshot() { return profilingSnapshot; }
  public void setProfilingSnapshot(String profilingSnapshot) { this.profilingSnapshot = profilingSnapshot; }

  public String getCommitMessage() { return commitMessage; }
  public void setCommitMessage(String commitMessage) { this.commitMessage = commitMessage; }

  public UUID getCreatedBy() { return createdBy; }
  public void setCreatedBy(UUID createdBy) { this.createdBy = createdBy; }

  public Instant getCreatedAt() { return createdAt; }
  public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
