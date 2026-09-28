package com.luminai.audit.dto;

import com.luminai.audit.model.AuditLog;
import java.time.Instant;
import java.util.UUID;

/** DTO records representing audit log entries in compliance and admin interfaces. */
public final class AuditLogDto {

  private AuditLogDto() {}

  public record Response(
      UUID id,
      UUID tenantId,
      UUID userId,
      String action,
      String resourceType,
      UUID resourceId,
      String changes,
      String ipAddress,
      Instant createdAt) {

    public static Response fromEntity(AuditLog log) {
      return new Response(
          log.getId(),
          log.getTenantId(),
          log.getUserId(),
          log.getAction(),
          log.getResourceType(),
          log.getResourceId(),
          log.getChanges(),
          log.getIpAddress(),
          log.getCreatedAt());
    }
  }

  public record CreateRequest(
      String action, String resourceType, UUID resourceId, String changes, String ipAddress) {}
}
