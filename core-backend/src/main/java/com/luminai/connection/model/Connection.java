package com.luminai.connection.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * JPA entity representing a data source connection metadata entry (maps to table `connectors`).
 *
 * <p>All queries MUST be scoped by {@code tenantId} to enforce multi-tenant isolation at the data layer.
 */
@Entity
@Table(name = "connectors")
public class Connection {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @NotNull
  @Column(name = "tenant_id", nullable = false)
  private UUID tenantId;

  @NotBlank
  @Column(nullable = false)
  private String name;

  @NotNull
  @Column(nullable = false, length = 50)
  @Enumerated(EnumType.STRING)
  private Type type;

  @Column(columnDefinition = "jsonb")
  private String config = "{}";

  @Column(name = "credentials_ref")
  private String credentialsRef;

  @NotNull
  @Column(nullable = false, length = 20)
  @Enumerated(EnumType.STRING)
  private Status status = Status.ACTIVE;

  @Column(name = "last_sync_at")
  private Instant lastSyncAt;

  @Column(name = "created_by")
  private UUID createdBy;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @UpdateTimestamp
  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  // ----------------------------------------------------------------
  // Enums
  // ----------------------------------------------------------------

  public enum Type {
    FILE,
    POSTGRESQL,
    MYSQL,
    MSSQL,
    API
  }

  public enum Status {
    ACTIVE,
    INACTIVE,
    ERROR
  }

  // ----------------------------------------------------------------
  // Constructors
  // ----------------------------------------------------------------

  protected Connection() {
    // JPA required no-arg constructor
  }

  public Connection(
      UUID tenantId,
      String name,
      Type type,
      String config,
      String credentialsRef,
      UUID createdBy) {
    this.tenantId = tenantId;
    this.name = name;
    this.type = type;
    this.config = config != null ? config : "{}";
    this.credentialsRef = credentialsRef;
    this.createdBy = createdBy;
    this.status = Status.ACTIVE;
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

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public Type getType() {
    return type;
  }

  public void setType(Type type) {
    this.type = type;
  }

  public String getConfig() {
    return config;
  }

  public void setConfig(String config) {
    this.config = config;
  }

  public String getCredentialsRef() {
    return credentialsRef;
  }

  public void setCredentialsRef(String credentialsRef) {
    this.credentialsRef = credentialsRef;
  }

  public Status getStatus() {
    return status;
  }

  public void setStatus(Status status) {
    this.status = status;
  }

  public Instant getLastSyncAt() {
    return lastSyncAt;
  }

  public void setLastSyncAt(Instant lastSyncAt) {
    this.lastSyncAt = lastSyncAt;
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

  public Instant getUpdatedAt() {
    return updatedAt;
  }
}
