package com.luminai.audit.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * JPA entity representing an enterprise audit log entry (maps to {@code audit_log}).
 *
 * <p>Enforces multi-tenant SOC2 and HIPAA compliance traceability for every write action,
 * configuration change, and entity resolution review.
 */
@Entity
@Table(
    name = "audit_log",
    indexes = {
      @Index(name = "idx_audit_tenant", columnList = "tenant_id"),
      @Index(name = "idx_audit_user", columnList = "user_id"),
      @Index(name = "idx_audit_resource", columnList = "resource_type, resource_id")
    })
public class AuditLog {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @NotNull
  @Column(name = "tenant_id", nullable = false)
  private UUID tenantId;

  @NotNull
  @Column(name = "user_id", nullable = false)
  private UUID userId;

  @NotBlank
  @Column(nullable = false, length = 100)
  private String action;

  @Column(name = "resource_type", length = 100)
  private String resourceType;

  @Column(name = "resource_id")
  private UUID resourceId;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(columnDefinition = "jsonb")
  private String changes;

  @Column(name = "ip_address", length = 45)
  private String ipAddress;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  protected AuditLog() {
    // JPA required
  }

  public AuditLog(
      UUID tenantId,
      UUID userId,
      String action,
      String resourceType,
      UUID resourceId,
      String changes,
      String ipAddress) {
    this.tenantId = tenantId;
    this.userId = userId;
    this.action = action;
    this.resourceType = resourceType;
    this.resourceId = resourceId;
    this.changes = changes != null ? changes : "{}";
    this.ipAddress = ipAddress;
  }

  public UUID getId() {
    return id;
  }

  public UUID getTenantId() {
    return tenantId;
  }

  public void setTenantId(UUID tenantId) {
    this.tenantId = tenantId;
  }

  public UUID getUserId() {
    return userId;
  }

  public void setUserId(UUID userId) {
    this.userId = userId;
  }

  public String getAction() {
    return action;
  }

  public void setAction(String action) {
    this.action = action;
  }

  public String getResourceType() {
    return resourceType;
  }

  public void setResourceType(String resourceType) {
    this.resourceType = resourceType;
  }

  public UUID getResourceId() {
    return resourceId;
  }

  public void setResourceId(UUID resourceId) {
    this.resourceId = resourceId;
  }

  public String getChanges() {
    return changes;
  }

  public void setChanges(String changes) {
    this.changes = changes;
  }

  public String getIpAddress() {
    return ipAddress;
  }

  public void setIpAddress(String ipAddress) {
    this.ipAddress = ipAddress;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }
}
