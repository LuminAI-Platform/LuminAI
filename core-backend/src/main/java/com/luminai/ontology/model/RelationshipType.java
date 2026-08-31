package com.luminai.ontology.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * JPA entity representing a directional Ontology Relationship Type connecting two Entity Types
 * (maps to table `relationship_types`).
 *
 * <p>Example: {@code Person} -[{@code EMPLOYED_BY}]-&gt; {@code Company}
 */
@Entity
@Table(name = "relationship_types")
public class RelationshipType {

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

  @Column(columnDefinition = "TEXT")
  private String description;

  @NotNull
  @Column(name = "source_entity_type_id", nullable = false)
  private UUID sourceEntityTypeId;

  @NotNull
  @Column(name = "target_entity_type_id", nullable = false)
  private UUID targetEntityTypeId;

  @NotNull
  @Column(nullable = false, length = 30)
  @Enumerated(EnumType.STRING)
  private Cardinality cardinality = Cardinality.MANY_TO_MANY;

  @Column(name = "properties_schema", columnDefinition = "jsonb", nullable = false)
  private String propertiesSchema = "{}";

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @UpdateTimestamp
  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  // ----------------------------------------------------------------
  // Enums
  // ----------------------------------------------------------------

  public enum Cardinality {
    ONE_TO_ONE,
    ONE_TO_MANY,
    MANY_TO_ONE,
    MANY_TO_MANY
  }

  // ----------------------------------------------------------------
  // Constructors
  // ----------------------------------------------------------------

  protected RelationshipType() {
    // JPA required no-arg constructor
  }

  public RelationshipType(
      UUID tenantId,
      UUID ontologyId,
      String name,
      String description,
      UUID sourceEntityTypeId,
      UUID targetEntityTypeId,
      Cardinality cardinality,
      String propertiesSchema) {
    this.tenantId = tenantId;
    this.ontologyId = ontologyId;
    this.name = name;
    this.description = description;
    this.sourceEntityTypeId = sourceEntityTypeId;
    this.targetEntityTypeId = targetEntityTypeId;
    this.cardinality = cardinality != null ? cardinality : Cardinality.MANY_TO_MANY;
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

  public String getDescription() {
    return description;
  }

  public void setDescription(String description) {
    this.description = description;
  }

  public UUID getSourceEntityTypeId() {
    return sourceEntityTypeId;
  }

  public void setSourceEntityTypeId(UUID sourceEntityTypeId) {
    this.sourceEntityTypeId = sourceEntityTypeId;
  }

  public UUID getTargetEntityTypeId() {
    return targetEntityTypeId;
  }

  public void setTargetEntityTypeId(UUID targetEntityTypeId) {
    this.targetEntityTypeId = targetEntityTypeId;
  }

  public Cardinality getCardinality() {
    return cardinality;
  }

  public void setCardinality(Cardinality cardinality) {
    this.cardinality = cardinality;
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
