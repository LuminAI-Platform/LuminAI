package com.luminai.auth.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * JPA entity for the tenant registry (maps to {@code public.tenants}).
 *
 * <p>This table lives in the shared {@code public} schema — unlike the per-tenant tables (e.g.
 * {@code connectors}, {@code entity_types}) which live in a {@code tenant_<slug>} schema and are
 * routed to by Hibernate's schema-based multi-tenancy. The explicit {@code schema = "public"} below
 * ensures this entity is always queried against {@code public.tenants} regardless of which tenant
 * schema is currently active on the connection's search_path.
 */
@Entity
@Table(name = "tenants", schema = "public")
public class Tenant {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @Column(nullable = false, length = 100)
  private String name;

  @Column(nullable = false, unique = true, length = 50)
  private String slug;

  @Column(nullable = false, length = 20)
  private String status = "active";

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @UpdateTimestamp
  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  protected Tenant() {
    // JPA required no-arg constructor
  }

  /** Convenience constructor for tests and in-memory construction outside of persistence. */
  public Tenant(UUID id, String name, String slug, String status) {
    this.id = id;
    this.name = name;
    this.slug = slug;
    this.status = (status != null && !status.isBlank()) ? status : "active";
  }

  public UUID getId() {
    return id;
  }

  public String getName() {
    return name;
  }

  public String getSlug() {
    return slug;
  }

  public String getStatus() {
    return status;
  }

  public boolean isActive() {
    return "active".equalsIgnoreCase(status);
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }
}
