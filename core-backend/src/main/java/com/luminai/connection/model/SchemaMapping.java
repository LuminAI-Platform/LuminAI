package com.luminai.connection.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

/**
 * JPA entity representing a schema mapping configuration.
 * Maps a single source column from a connector's dataset to a target
 * ontology entity-type property, with an optional transformation.
 *
 * <p>All queries MUST be scoped by {@code tenantId} to enforce
 * multi-tenant isolation at the data layer.
 */
@Entity
@Table(name = "schema_mappings")
public class SchemaMapping {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @NotNull
    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @NotNull
    @Column(name = "connector_id", nullable = false)
    private UUID connectorId;

    @NotBlank
    @Column(nullable = false)
    private String name;

    @NotBlank
    @Column(name = "source_column", nullable = false)
    private String sourceColumn;

    @NotBlank
    @Column(name = "target_entity_type", nullable = false, length = 100)
    private String targetEntityType;

    @NotBlank
    @Column(name = "target_property", nullable = false, length = 100)
    private String targetProperty;

    @Column(nullable = false, length = 50)
    @Enumerated(EnumType.STRING)
    private Transformation transformation = Transformation.NONE;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    // ----------------------------------------------------------------
    // Transformation enum
    // ----------------------------------------------------------------

    public enum Transformation {
        NONE, UPPERCASE, LOWERCASE, TRIM, DATE_PARSE
    }

    // ----------------------------------------------------------------
    // Constructors
    // ----------------------------------------------------------------

    protected SchemaMapping() {
        // JPA requires a no-arg constructor
    }

    public SchemaMapping(UUID tenantId, UUID connectorId, String name,
                         String sourceColumn, String targetEntityType,
                         String targetProperty, Transformation transformation) {
        this.tenantId = tenantId;
        this.connectorId = connectorId;
        this.name = name;
        this.sourceColumn = sourceColumn;
        this.targetEntityType = targetEntityType;
        this.targetProperty = targetProperty;
        this.transformation = transformation;
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

    public UUID getConnectorId() {
        return connectorId;
    }

    public void setConnectorId(UUID connectorId) {
        this.connectorId = connectorId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getSourceColumn() {
        return sourceColumn;
    }

    public void setSourceColumn(String sourceColumn) {
        this.sourceColumn = sourceColumn;
    }

    public String getTargetEntityType() {
        return targetEntityType;
    }

    public void setTargetEntityType(String targetEntityType) {
        this.targetEntityType = targetEntityType;
    }

    public String getTargetProperty() {
        return targetProperty;
    }

    public void setTargetProperty(String targetProperty) {
        this.targetProperty = targetProperty;
    }

    public Transformation getTransformation() {
        return transformation;
    }

    public void setTransformation(Transformation transformation) {
        this.transformation = transformation;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
