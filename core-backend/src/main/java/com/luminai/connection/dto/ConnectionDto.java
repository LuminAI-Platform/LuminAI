package com.luminai.connection.dto;

import com.luminai.connection.model.Connection;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;

/** Data Transfer Objects for Connection CRUD operations. */
public final class ConnectionDto {

  private ConnectionDto() {}

  // ----------------------------------------------------------------
  // Request DTOs
  // ----------------------------------------------------------------

  /** Request body for creating a new connection configuration. */
  public record CreateRequest(
      @NotBlank(message = "name is required") String name,
      @NotNull(message = "type is required") Connection.Type type,
      String config,
      String credentialsRef) {}

  /** Request body for updating an existing connection. */
  public record UpdateRequest(
      String name,
      String config,
      String credentialsRef,
      Connection.Status status) {}

  // ----------------------------------------------------------------
  // Response DTOs
  // ----------------------------------------------------------------

  /** Response body returned from all connection endpoints. */
  public record Response(
      UUID id,
      UUID tenantId,
      String name,
      Connection.Type type,
      String config,
      String credentialsRef,
      Connection.Status status,
      Instant lastSyncAt,
      UUID createdBy,
      Instant createdAt,
      Instant updatedAt) {

    /** Factory method to convert a Connection entity to a response DTO. */
    public static Response from(Connection entity) {
      return new Response(
          entity.getId(),
          entity.getTenantId(),
          entity.getName(),
          entity.getType(),
          entity.getConfig(),
          entity.getCredentialsRef(),
          entity.getStatus(),
          entity.getLastSyncAt(),
          entity.getCreatedBy(),
          entity.getCreatedAt(),
          entity.getUpdatedAt());
    }
  }
}
