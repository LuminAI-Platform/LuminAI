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

  private static final com.fasterxml.jackson.databind.ObjectMapper OBJECT_MAPPER =
      new com.fasterxml.jackson.databind.ObjectMapper();

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
      List<PropertyDefinition> properties,
      Instant createdAt,
      Instant updatedAt) {

    public Response(
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
      this(
          id,
          tenantId,
          ontologyId,
          name,
          label,
          color,
          icon,
          description,
          propertiesSchema,
          parseProperties(propertiesSchema),
          createdAt,
          updatedAt);
    }

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
          parseProperties(entity.getPropertiesSchema()),
          entity.getCreatedAt(),
          entity.getUpdatedAt());
    }

    public static List<PropertyDefinition> parseProperties(String propertiesSchema) {
      if (propertiesSchema == null
          || propertiesSchema.isBlank()
          || propertiesSchema.trim().equals("{}")) {
        return java.util.Collections.emptyList();
      }
      try {
        Map<String, Object> schema =
            OBJECT_MAPPER.readValue(
                propertiesSchema,
                new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
        if (schema == null) {
          return java.util.Collections.emptyList();
        }

        Object propsObj = schema.get("properties");
        if (!(propsObj instanceof Map<?, ?> propsMap)) {
          return java.util.Collections.emptyList();
        }

        List<String> requiredList = java.util.Collections.emptyList();
        Object reqObj = schema.get("required");
        if (reqObj instanceof List<?> list) {
          requiredList = list.stream().map(Object::toString).toList();
        }

        List<PropertyDefinition> result = new java.util.ArrayList<>();
        for (Map.Entry<?, ?> entry : propsMap.entrySet()) {
          String propName = entry.getKey().toString();
          String propType = "string";
          String description = null;
          Object defaultVal = null;

          if (entry.getValue() instanceof Map<?, ?> defMap) {
            Object t = defMap.get("type");
            if (t != null) {
              propType = t.toString();
            }
            Object d = defMap.get("description");
            if (d != null) {
              description = d.toString();
            }
            defaultVal = defMap.get("default");
          }

          boolean required = requiredList.contains(propName);
          result.add(new PropertyDefinition(propName, propType, required, defaultVal, description));
        }
        return result;
      } catch (Exception e) {
        return java.util.Collections.emptyList();
      }
    }
  }
}
