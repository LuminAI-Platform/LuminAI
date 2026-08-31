package com.luminai.ontology.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;

/**
 * JPA entity representing an immutable or draft Ontology Version snapshot (maps to table
 * `ontology_versions`).
 */
@Entity
@Table(name = "ontology_versions")
public class OntologyVersion {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @NotNull
  @Column(name = "tenant_id", nullable = false)
  private UUID tenantId;

  @NotBlank
  @Column(nullable = false, length = 20)
  private String version;

  @NotNull
  @Column(nullable = false, length = 20)
  @Enumerated(EnumType.STRING)
  private Status status = Status.DRAFT;

  @Column(columnDefinition = "TEXT")
  private String changelog;

  @Column(name = "schema_snapshot", columnDefinition = "jsonb")
  private String schemaSnapshot = "{}";

  @Column(name = "created_by")
  private UUID createdBy;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "published_at")
  private Instant publishedAt;

  // ----------------------------------------------------------------
  // Enums
  // ----------------------------------------------------------------

  public enum Status {
    DRAFT,
    PUBLISHED,
    DEPRECATED
  }

  // ----------------------------------------------------------------
  // Constructors
  // ----------------------------------------------------------------

  protected OntologyVersion() {
    // JPA required no-arg constructor
  }

  public OntologyVersion(
      UUID tenantId, String version, Status status, String changelog, UUID createdBy) {
    this.tenantId = tenantId;
    this.version = version;
    this.status = status != null ? status : Status.DRAFT;
    this.changelog = changelog;
    this.createdBy = createdBy;
    this.schemaSnapshot = "{}";
  }

  // ----------------------------------------------------------------
  // Getters & Setters
  // ----------------------------------------------------------------

  public UUID getId() {
    return id;
  }

  public UUID getTenantId() {
    return tenantId;
  }

  public void setTenantId(UUID tenantId) {
    this.tenantId = tenantId;
  }

  public String getVersion() {
    return version;
  }

  public void setVersion(String version) {
    this.version = version;
  }

  public Status getStatus() {
    return status;
  }

  public void setStatus(Status status) {
    this.status = status;
  }

  public String getChangelog() {
    return changelog;
  }

  public void setChangelog(String changelog) {
    this.changelog = changelog;
  }

  public String getSchemaSnapshot() {
    return schemaSnapshot;
  }

  public void setSchemaSnapshot(String schemaSnapshot) {
    this.schemaSnapshot = schemaSnapshot;
  }

  public UUID getCreatedBy() {
    return createdBy;
  }

  public void setCreatedBy(UUID createdBy) {
    this.createdBy = createdBy;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getPublishedAt() {
    return publishedAt;
  }

  public void setPublishedAt(Instant publishedAt) {
    this.publishedAt = publishedAt;
  }
}
