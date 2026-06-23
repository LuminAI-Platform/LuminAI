package com.luminai.connection.dto;

import com.luminai.connection.model.SchemaMapping;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;

/** Data Transfer Objects for SchemaMapping CRUD operations. */
public final class SchemaMappingDto {

  private SchemaMappingDto() {}

  // ----------------------------------------------------------------
  // Request DTOs
  // ----------------------------------------------------------------

  /** Request body for creating a new schema mapping. */
  public record CreateRequest(
      @NotNull(message = "connectorId is required") UUID connectorId,
      @NotBlank(message = "name is required") String name,
      @NotBlank(message = "sourceColumn is required") String sourceColumn,
      @NotBlank(message = "targetEntityType is required") String targetEntityType,
      @NotBlank(message = "targetProperty is required") String targetProperty,
      SchemaMapping.Transformation transformation) {
    /** Defaults transformation to NONE if not provided. */
    public CreateRequest {
      if (transformation == null) {
        transformation = SchemaMapping.Transformation.NONE;
      }
    }
  }

  /** Request body for updating an existing schema mapping. */
  public record UpdateRequest(
      String name,
      String sourceColumn,
      String targetEntityType,
      String targetProperty,
      SchemaMapping.Transformation transformation,
      Boolean active) {}

  // ----------------------------------------------------------------
  // Response DTOs
  // ----------------------------------------------------------------

  /** Response body returned from all schema mapping endpoints. */
  public record Response(
      UUID id,
      UUID tenantId,
      UUID connectorId,
      String name,
      String sourceColumn,
      String targetEntityType,
      String targetProperty,
      SchemaMapping.Transformation transformation,
      boolean active,
      Instant createdAt,
      Instant updatedAt) {
    /** Factory method to convert a JPA entity to a response DTO. */
    public static Response from(SchemaMapping entity) {
      return new Response(
          entity.getId(),
          entity.getTenantId(),
          entity.getConnectorId(),
          entity.getName(),
          entity.getSourceColumn(),
          entity.getTargetEntityType(),
          entity.getTargetProperty(),
          entity.getTransformation(),
          entity.isActive(),
          entity.getCreatedAt(),
          entity.getUpdatedAt());
    }
  }
}
