package com.luminai.audit.consumer;

import com.luminai.audit.model.AuditLog;
import com.luminai.audit.repository.AuditLogRepository;
import com.luminai.auth.repository.TenantRepository;
import com.luminai.common.tenant.TenantContext;
import com.luminai.config.KafkaConfig;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Component;

/** Kafka listener consuming external audit events from {@code audit.log}. */
@Component
public class AuditLogConsumer {

  private static final Logger log = LoggerFactory.getLogger(AuditLogConsumer.class);

  private final AuditLogRepository auditLogRepository;
  private final TenantRepository tenantRepository;

  public AuditLogConsumer(
      AuditLogRepository auditLogRepository, TenantRepository tenantRepository) {
    this.auditLogRepository = auditLogRepository;
    this.tenantRepository = tenantRepository;
  }

  @KafkaListener(
      topics = KafkaConfig.TOPIC_AUDIT_LOG,
      groupId = "${spring.kafka.consumer.group-id}",
      containerFactory = "kafkaListenerContainerFactory")
  public void onAuditLog(
      @Payload Map<String, Object> payload,
      @Header(value = KafkaHeaders.RECEIVED_KEY, required = false) String messageKey,
      Acknowledgment ack) {

    try {
      // Check if message was already persisted locally by backend publisher
      if (payload.containsKey("id") && payload.get("id") != null) {
        ack.acknowledge();
        return;
      }

      String rawTenant = (String) payload.get("tenantId");
      if (rawTenant == null && messageKey != null) {
        rawTenant = messageKey;
      }

      if (rawTenant == null) {
        log.warn("Audit event missing tenant identifier — acknowledging without persistence");
        ack.acknowledge();
        return;
      }

      UUID tenantId = UUID.fromString(rawTenant);
      var tenantOpt = tenantRepository.findById(tenantId);
      tenantOpt.ifPresent(t -> TenantContext.setTenant(t.getId(), t.getSlug()));

      try {
        UUID userId =
            payload.get("userId") != null
                ? UUID.fromString((String) payload.get("userId"))
                : UUID.fromString("00000000-0000-0000-0000-000000000001");
        String action = (String) payload.getOrDefault("action", "UNKNOWN_ACTION");
        String resourceType = (String) payload.get("resourceType");
        UUID resourceId =
            payload.get("resourceId") != null
                ? UUID.fromString((String) payload.get("resourceId"))
                : null;
        String changes = (String) payload.getOrDefault("changes", "{}");
        String ipAddress = (String) payload.get("ipAddress");

        AuditLog logEntry =
            new AuditLog(tenantId, userId, action, resourceType, resourceId, changes, ipAddress);
        auditLogRepository.save(logEntry);

        log.debug("Persisted audit log from Kafka topic: action={}", action);
      } finally {
        TenantContext.clear();
      }

      ack.acknowledge();

    } catch (Exception e) {
      log.error("Failed to process audit event from Kafka: {}", e.getMessage(), e);
      ack.acknowledge();
    }
  }
}
