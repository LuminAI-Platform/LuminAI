package com.luminai.audit.repository;

import com.luminai.audit.model.AuditLog;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** Spring Data repository for tenant-scoped {@link AuditLog} entries. */
@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

  Page<AuditLog> findByTenantIdOrderByCreatedAtDesc(UUID tenantId, Pageable pageable);

  Page<AuditLog> findByTenantIdAndActionOrderByCreatedAtDesc(
      UUID tenantId, String action, Pageable pageable);

  Page<AuditLog> findByTenantIdAndResourceTypeOrderByCreatedAtDesc(
      UUID tenantId, String resourceType, Pageable pageable);

  Page<AuditLog> findByTenantIdAndActionAndResourceTypeOrderByCreatedAtDesc(
      UUID tenantId, String action, String resourceType, Pageable pageable);
}
