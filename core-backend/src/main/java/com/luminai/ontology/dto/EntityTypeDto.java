package com.luminai.ontology.dto;

import com.luminai.ontology.model.EntityType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class EntityTypeDto {

  private EntityTypeDto() {}

  public record PropertyDefinition(
      String name,
      String type, // string, number, boolean, date, json
      boolean required,
      Object defaultValue,
      String description) {}

  public record CreateRequest(
      @NotBlank(message = "Entity type name is required")
          @Size(min = 2, max = 100, message = "Name must be between 2 and 100 characters")
          @Pattern(
              regexp = "^[A-Za-z][A-Za-z0-9_]*$",
              message =
                  "Name must start with a letter and contain only alphanumeric characters and underscores")
          String name,
      String label,
      String color,
      String icon,
      String description,
      List<PropertyDefinition> properties,
      Map<String, Object> propertiesSchema) {}

  public record UpdateRequest(
      @Size(min = 2, max = 100, message = "Name must be between 2 and 100 characters")
          @Pattern(
              regexp = "^[A-Za-z][A-Za-z0-9_]*$",
              message =
                  "Name must start with a letter and contain only alphanumeric characters and underscores")
          String name,
      String label,
      String color,
      String icon,
      String description,
      List<PropertyDefinition> properties,
      Map<String, Object> propertiesSchema) {}

  public record Response(
      UUID id,
      UUID tenantId,
      UUID ontologyId,
      String name,
      String label,
      String color,
      String icon,
      String description,
      String propertiesSchema,
      Instant createdAt,
      Instant updatedAt) {

    public static Response from(EntityType entity) {
      return new Response(
          entity.getId(),
          entity.getTenantId(),
          entity.getOntologyId(),
          entity.getName(),
          entity.getLabel(),
          entity.getColor(),
          entity.getIcon(),
          entity.getDescription(),
          entity.getPropertiesSchema(),
          entity.getCreatedAt(),
          entity.getUpdatedAt());
    }
  }
}
