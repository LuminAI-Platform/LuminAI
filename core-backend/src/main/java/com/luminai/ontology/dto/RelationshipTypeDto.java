package com.luminai.ontology.dto;

import com.luminai.ontology.model.RelationshipType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public final class RelationshipTypeDto {

  private RelationshipTypeDto() {}

  public record CreateRequest(
      @NotBlank(message = "Relationship type name is required")
          @Size(min = 2, max = 100, message = "Name must be between 2 and 100 characters")
          @Pattern(
              regexp = "^[A-Za-z][A-Za-z0-9_]*$",
              message =
                  "Name must start with a letter and contain only alphanumeric characters and underscores")
          String name,
      String description,
      @NotNull(message = "Source entity type ID is required") UUID sourceEntityTypeId,
      @NotNull(message = "Target entity type ID is required") UUID targetEntityTypeId,
      RelationshipType.Cardinality cardinality,
      Map<String, Object> propertiesSchema) {}

  public record UpdateRequest(
      @Size(min = 2, max = 100, message = "Name must be between 2 and 100 characters")
          @Pattern(
              regexp = "^[A-Za-z][A-Za-z0-9_]*$",
              message =
                  "Name must start with a letter and contain only alphanumeric characters and underscores")
          String name,
      String description,
      UUID sourceEntityTypeId,
      UUID targetEntityTypeId,
      RelationshipType.Cardinality cardinality,
      Map<String, Object> propertiesSchema) {}

  public record Response(
      UUID id,
      UUID tenantId,
      UUID ontologyId,
      String name,
      String description,
      UUID sourceEntityTypeId,
      UUID targetEntityTypeId,
      RelationshipType.Cardinality cardinality,
      String propertiesSchema,
      Instant createdAt,
      Instant updatedAt) {

    public static Response from(RelationshipType entity) {
      return new Response(
          entity.getId(),
          entity.getTenantId(),
          entity.getOntologyId(),
          entity.getName(),
          entity.getDescription(),
          entity.getSourceEntityTypeId(),
          entity.getTargetEntityTypeId(),
          entity.getCardinality(),
          entity.getPropertiesSchema(),
          entity.getCreatedAt(),
          entity.getUpdatedAt());
    }
  }
}
