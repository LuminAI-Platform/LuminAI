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
 * First-class managed enterprise dataset entity.
 * Repositories and queries MUST enforce tenant_id isolation.
 */
@Entity
@Table(name = "datasets")
public class Dataset {

  public enum Layer {
    RAW,
    PREPARED,
    CURATED,
    ANALYTICAL,
    MODEL_READY
  }

  public enum ProjectType {
    SOURCE,
    PREPARATION,
    TRANSFORMATION,
    SEMANTIC,
    ANALYTICS,
    DATA_SCIENCE,
    WORKFLOW
  }

  public enum QualityStatus {
    VERIFIED,
    NEEDS_REVIEW,
    REJECTED,
    UNASSESSED
  }

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
  @Column(name = "display_name", nullable = false)
  private String displayName;

  @Column(columnDefinition = "TEXT")
  private String description;

  @NotNull
  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 50)
  private Layer layer = Layer.RAW;

  @NotNull
  @Enumerated(EnumType.STRING)
  @Column(name = "project_type", nullable = false, length = 50)
  private ProjectType projectType = ProjectType.SOURCE;

  @Column(name = "source_connection_id")
  private UUID sourceConnectionId;

  @Column(name = "current_version", nullable = false)
  private int currentVersion = 1;

  @Column(name = "row_count", nullable = false)
  private long rowCount = 0;

  @Column(name = "byte_size", nullable = false)
  private long byteSize = 0;

  @Column(name = "storage_location", length = 1000)
  private String storageLocation;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "schema_metadata", columnDefinition = "jsonb")
  private String schemaMetadata = "[]";

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "profiling_summary", columnDefinition = "jsonb")
  private String profilingSummary = "{}";

  @NotNull
  @Enumerated(EnumType.STRING)
  @Column(name = "quality_status", nullable = false, length = 50)
  private QualityStatus qualityStatus = QualityStatus.UNASSESSED;

  @Column(name = "created_by")
  private UUID createdBy;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @UpdateTimestamp
  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  public Dataset() {}

  public UUID getId() { return id; }
  public void setId(UUID id) { this.id = id; }

  public UUID getTenantId() { return tenantId; }
  public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

  public String getName() { return name; }
  public void setName(String name) { this.name = name; }

  public String getDisplayName() { return displayName; }
  public void setDisplayName(String displayName) { this.displayName = displayName; }

  public String getDescription() { return description; }
  public void setDescription(String description) { this.description = description; }

  public Layer getLayer() { return layer; }
  public void setLayer(Layer layer) { this.layer = layer; }

  public ProjectType getProjectType() { return projectType; }
  public void setProjectType(ProjectType projectType) { this.projectType = projectType; }

  public UUID getSourceConnectionId() { return sourceConnectionId; }
  public void setSourceConnectionId(UUID sourceConnectionId) { this.sourceConnectionId = sourceConnectionId; }

  public int getCurrentVersion() { return currentVersion; }
  public void setCurrentVersion(int currentVersion) { this.currentVersion = currentVersion; }

  public long getRowCount() { return rowCount; }
  public void setRowCount(long rowCount) { this.rowCount = rowCount; }

  public long getByteSize() { return byteSize; }
  public void setByteSize(long byteSize) { this.byteSize = byteSize; }

  public String getStorageLocation() { return storageLocation; }
  public void setStorageLocation(String storageLocation) { this.storageLocation = storageLocation; }

  public String getSchemaMetadata() { return schemaMetadata; }
  public void setSchemaMetadata(String schemaMetadata) { this.schemaMetadata = schemaMetadata; }

  public String getProfilingSummary() { return profilingSummary; }
  public void setProfilingSummary(String profilingSummary) { this.profilingSummary = profilingSummary; }

  public QualityStatus getQualityStatus() { return qualityStatus; }
  public void setQualityStatus(QualityStatus qualityStatus) { this.qualityStatus = qualityStatus; }

  public UUID getCreatedBy() { return createdBy; }
  public void setCreatedBy(UUID createdBy) { this.createdBy = createdBy; }

  public Instant getCreatedAt() { return createdAt; }
  public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

  public Instant getUpdatedAt() { return updatedAt; }
  public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
