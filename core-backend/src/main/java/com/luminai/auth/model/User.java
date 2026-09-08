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
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * JPA entity for LuminAI application users (maps to {@code public.users}).
 *
 * <p>This is the link between a Keycloak identity and a LuminAI tenant: Keycloak authenticates the
 * user and issues a JWT identifying them by {@code sub} (their Keycloak ID); LuminAI looks that
 * user up here by {@link #getKeycloakId()} to find which tenant they belong to. The tenant is never
 * trusted from the JWT itself.
 *
 * <p>Lives in the shared {@code public} schema — see {@link Tenant} for why {@code schema =
 * "public"} is required here despite schema-based multi-tenancy being active for tenant-scoped
 * entities.
 */
@Entity
@Table(name = "users", schema = "public")
public class User {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @NotBlank
  @Column(name = "keycloak_id", nullable = false, unique = true)
  private String keycloakId;

  @NotBlank
  @Column(nullable = false)
  private String email;

  @Column(name = "full_name")
  private String fullName;

  @ManyToOne(fetch = FetchType.EAGER, optional = false)
  @JoinColumn(name = "tenant_id", nullable = false)
  private Tenant tenant;

  @Column(nullable = false, length = 50)
  private String role = "VIEWER";

  @Column(name = "is_active", nullable = false)
  private boolean active = true;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @UpdateTimestamp
  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  protected User() {
    // JPA required no-arg constructor
  }

  /** Convenience constructor for tests and in-memory construction outside of persistence. */
  public User(
      UUID id,
      String keycloakId,
      String email,
      String fullName,
      Tenant tenant,
      String role,
      boolean active) {
    this.id = id;
    this.keycloakId = keycloakId;
    this.email = email;
    this.fullName = fullName;
    this.tenant = tenant;
    this.role = (role != null && !role.isBlank()) ? role : "VIEWER";
    this.active = active;
  }

  public UUID getId() {
    return id;
  }

  public String getKeycloakId() {
    return keycloakId;
  }

  public String getEmail() {
    return email;
  }

  public String getFullName() {
    return fullName;
  }

  public Tenant getTenant() {
    return tenant;
  }

  public String getRole() {
    return role;
  }

  public boolean isActive() {
    return active;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }
}
