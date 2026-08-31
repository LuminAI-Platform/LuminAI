package com.luminai.ontology.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * JPA entity representing a dynamic Ontology Entity Type definition (maps to table `entity_types`).
 *
 * <p>Each entity type defines custom JSON Schema property rules, display styling (color, icon), and
 * metadata. Multi-tenant isolation is enforced at the schema and tenant ID level.
 */
@Entity
@Table(name = "entity_types")
public class EntityType {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @NotNull
  @Column(name = "tenant_id", nullable = false)
  private UUID tenantId;

  @Column(name = "ontology_id")
  private UUID ontologyId;

  @NotBlank
  @Column(nullable = false, length = 100)
  private String name;

  @Column(length = 100)
  private String label;

  @Column(length = 30)
  private String color = "#3b82f6";

  @Column(length = 50)
  private String icon = "package";

  @Column(columnDefinition = "TEXT")
  private String description;

  @Column(name = "properties_schema", columnDefinition = "jsonb", nullable = false)
  private String propertiesSchema = "{}";

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @UpdateTimestamp
  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  // ----------------------------------------------------------------
  // Constructors
  // ----------------------------------------------------------------

  protected EntityType() {
    // JPA required no-arg constructor
  }

  public EntityType(
      UUID tenantId,
      UUID ontologyId,
      String name,
      String label,
      String color,
      String icon,
      String description,
      String propertiesSchema) {
    this.tenantId = tenantId;
    this.ontologyId = ontologyId;
    this.name = name;
    this.label = (label != null && !label.isBlank()) ? label : name;
    this.color = (color != null && !color.isBlank()) ? color : "#3b82f6";
    this.icon = (icon != null && !icon.isBlank()) ? icon : "package";
    this.description = description;
    this.propertiesSchema =
        (propertiesSchema != null && !propertiesSchema.isBlank()) ? propertiesSchema : "{}";
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

  public UUID getOntologyId() {
    return ontologyId;
  }

  public void setOntologyId(UUID ontologyId) {
    this.ontologyId = ontologyId;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getLabel() {
    return label;
  }

  public void setLabel(String label) {
    this.label = label;
  }

  public String getColor() {
    return color;
  }

  public void setColor(String color) {
    this.color = color;
  }

  public String getIcon() {
    return icon;
  }

  public void setIcon(String icon) {
    this.icon = icon;
  }

  public String getDescription() {
    return description;
  }

  public void setDescription(String description) {
    this.description = description;
  }

  public String getPropertiesSchema() {
    return propertiesSchema;
  }

  public void setPropertiesSchema(String propertiesSchema) {
    this.propertiesSchema = propertiesSchema;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }
}
