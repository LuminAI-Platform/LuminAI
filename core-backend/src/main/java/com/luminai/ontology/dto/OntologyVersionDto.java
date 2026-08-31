package com.luminai.ontology.dto;

import com.luminai.ontology.model.OntologyVersion;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class OntologyVersionDto {

  private OntologyVersionDto() {}

  public record CreateRequest(
      @NotBlank(message = "Version string is required")
          @Pattern(
              regexp = "^v?[0-9]+\\.[0-9]+\\.[0-9]+$",
              message = "Version must follow semver format (e.g., 'v1.0.0' or '1.0.0')")
          String version,
      String changelog) {}

  public record Response(
      UUID id,
      UUID tenantId,
      String version,
      OntologyVersion.Status status,
      String changelog,
      String schemaSnapshot,
      UUID createdBy,
      Instant createdAt,
      Instant publishedAt) {

    public static Response from(OntologyVersion entity) {
      return new Response(
          entity.getId(),
          entity.getTenantId(),
          entity.getVersion(),
          entity.getStatus(),
          entity.getChangelog(),
          entity.getSchemaSnapshot(),
          entity.getCreatedBy(),
          entity.getCreatedAt(),
          entity.getPublishedAt());
    }
  }

  public record DiffResponse(
      String currentVersion,
      String previousVersion,
      List<String> addedEntityTypes,
      List<String> modifiedEntityTypes,
      List<String> removedEntityTypes,
      List<String> addedRelationshipTypes,
      List<String> removedRelationshipTypes) {}
}
