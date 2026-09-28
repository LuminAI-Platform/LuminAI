package com.luminai.connection.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * JPA entity representing encrypted connector credentials (maps to {@code
 * public.vault_credentials}).
 *
 * <p>AES-256-GCM ciphertext is stored persistently to survive pod restarts and horizontal scaling.
 */
@Entity
@Table(
    name = "vault_credentials",
    schema = "public",
    uniqueConstraints =
        @UniqueConstraint(
            name = "uq_vault_credentials_tenant_connector",
            columnNames = {"tenant_id", "connector_id"}))
public class VaultCredential {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @Column(name = "tenant_id", nullable = false)
  private UUID tenantId;

  @Column(name = "connector_id", nullable = false)
  private UUID connectorId;

  @Column(name = "encrypted_data", nullable = false, columnDefinition = "text")
  private String encryptedData;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @UpdateTimestamp
  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  protected VaultCredential() {
    // JPA required
  }

  public VaultCredential(UUID tenantId, UUID connectorId, String encryptedData) {
    this.tenantId = tenantId;
    this.connectorId = connectorId;
    this.encryptedData = encryptedData;
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

  public UUID getConnectorId() {
    return connectorId;
  }

  public void setConnectorId(UUID connectorId) {
    this.connectorId = connectorId;
  }

  public String getEncryptedData() {
    return encryptedData;
  }

  public void setEncryptedData(String encryptedData) {
    this.encryptedData = encryptedData;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }
}
