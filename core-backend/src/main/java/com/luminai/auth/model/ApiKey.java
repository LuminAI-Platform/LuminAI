package com.luminai.auth.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;

/**
 * JPA entity representing an enterprise API Key (maps to {@code public.api_keys}). Full API keys
 * are hashed with SHA-256 for secure storage.
 */
@Entity
@Table(name = "api_keys", schema = "public")
public class ApiKey {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "tenant_id", nullable = false)
  private Tenant tenant;

  @Column(nullable = false, length = 100)
  private String name;

  @Column(name = "key_prefix", nullable = false, length = 16)
  private String keyPrefix;

  @Column(name = "key_hash", nullable = false, unique = true, length = 128)
  private String keyHash;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "last_used_at")
  private Instant lastUsedAt;

  @Column(name = "expires_at")
  private Instant expiresAt;

  @Column(name = "is_active", nullable = false)
  private boolean isActive = true;

  protected ApiKey() {
    // JPA required
  }

  public ApiKey(Tenant tenant, String name, String keyPrefix, String keyHash) {
    this.tenant = tenant;
    this.name = name;
    this.keyPrefix = keyPrefix;
    this.keyHash = keyHash;
    this.isActive = true;
  }

  public UUID getId() {
    return id;
  }

  public Tenant getTenant() {
    return tenant;
  }

  public void setTenant(Tenant tenant) {
    this.tenant = tenant;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getKeyPrefix() {
    return keyPrefix;
  }

  public void setKeyPrefix(String keyPrefix) {
    this.keyPrefix = keyPrefix;
  }

  public String getKeyHash() {
    return keyHash;
  }

  public void setKeyHash(String keyHash) {
    this.keyHash = keyHash;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getLastUsedAt() {
    return lastUsedAt;
  }

  public void setLastUsedAt(Instant lastUsedAt) {
    this.lastUsedAt = lastUsedAt;
  }

  public Instant getExpiresAt() {
    return expiresAt;
  }

  public void setExpiresAt(Instant expiresAt) {
    this.expiresAt = expiresAt;
  }

  public boolean isActive() {
    return isActive;
  }

  public void setActive(boolean active) {
    isActive = active;
  }
}
