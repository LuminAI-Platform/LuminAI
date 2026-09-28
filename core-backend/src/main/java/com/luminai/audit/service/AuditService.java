package com.luminai.audit.service;

import com.luminai.audit.dto.AuditLogDto;
import com.luminai.audit.model.AuditLog;
import com.luminai.audit.repository.AuditLogRepository;
import com.luminai.common.tenant.TenantContext;
import com.luminai.config.KafkaConfig;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Service providing enterprise audit trail persistence, querying, and Kafka event publishing. */
@Service
public class AuditService {

  private static final Logger log = LoggerFactory.getLogger(AuditService.class);

  private final AuditLogRepository auditLogRepository;
  private final KafkaTemplate<String, Object> kafkaTemplate;

  public AuditService(
      AuditLogRepository auditLogRepository, KafkaTemplate<String, Object> kafkaTemplate) {
    this.auditLogRepository = auditLogRepository;
    this.kafkaTemplate = kafkaTemplate;
  }

  /** Records an audit event for the current tenant context and persists it to the database. */
  @Transactional
  public AuditLogDto.Response recordEvent(
      UUID userId,
      String action,
      String resourceType,
      UUID resourceId,
      String changes,
      String ipAddress) {
    UUID tenantId = TenantContext.getTenantUuid();
    if (tenantId == null) {
      tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");
    }
    return recordEvent(tenantId, userId, action, resourceType, resourceId, changes, ipAddress);
  }

  /** Records an explicit tenant-scoped audit event. */
  @Transactional
  public AuditLogDto.Response recordEvent(
      UUID tenantId,
      UUID userId,
      String action,
      String resourceType,
      UUID resourceId,
      String changes,
      String ipAddress) {

    UUID safeUserId =
        userId != null ? userId : UUID.fromString("00000000-0000-0000-0000-000000000001");

    AuditLog entity =
        new AuditLog(tenantId, safeUserId, action, resourceType, resourceId, changes, ipAddress);
    AuditLog saved = auditLogRepository.save(entity);

    log.info(
        "Recorded audit event '{}' on '{}' (id={}) for tenant '{}' by user '{}'",
        action,
        resourceType,
        resourceId,
        tenantId,
        safeUserId);

    // Asynchronously dispatch to Kafka audit.log for SIEM / external compliance pipelines
    try {
      if (kafkaTemplate != null) {
        kafkaTemplate.send(
            KafkaConfig.TOPIC_AUDIT_LOG,
            tenantId.toString(),
            Map.of(
                "id",
                saved.getId().toString(),
                "tenantId",
                tenantId.toString(),
                "userId",
                safeUserId.toString(),
                "action",
                action,
                "resourceType",
                resourceType != null ? resourceType : "",
                "resourceId",
                resourceId != null ? resourceId.toString() : "",
                "ipAddress",
                ipAddress != null ? ipAddress : "",
                "createdAt",
                saved.getCreatedAt().toString()));
      }
    } catch (Exception e) {
      log.warn("Failed to broadcast audit event to Kafka: {}", e.getMessage());
    }

    return AuditLogDto.Response.fromEntity(saved);
  }

  /** Queries tenant-scoped audit logs with optional filtering by action and resourceType. */
  @Transactional(readOnly = true)
  public Page<AuditLogDto.Response> getAuditLogs(
      String action, String resourceType, Pageable pageable) {
    UUID tenantId = TenantContext.getTenantUuid();
    if (tenantId == null) {
      tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");
    }

    Page<AuditLog> page;
    boolean hasAction = action != null && !action.isBlank() && !"ALL".equalsIgnoreCase(action);
    boolean hasResource =
        resourceType != null && !resourceType.isBlank() && !"ALL".equalsIgnoreCase(resourceType);

    if (hasAction && hasResource) {
      page =
          auditLogRepository.findByTenantIdAndActionAndResourceTypeOrderByCreatedAtDesc(
              tenantId, action.trim(), resourceType.trim(), pageable);
    } else if (hasAction) {
      page =
          auditLogRepository.findByTenantIdAndActionOrderByCreatedAtDesc(
              tenantId, action.trim(), pageable);
    } else if (hasResource) {
      page =
          auditLogRepository.findByTenantIdAndResourceTypeOrderByCreatedAtDesc(
              tenantId, resourceType.trim(), pageable);
    } else {
      page = auditLogRepository.findByTenantIdOrderByCreatedAtDesc(tenantId, pageable);
    }

    return page.map(AuditLogDto.Response::fromEntity);
  }
}
