package com.luminai.connection.repository;

import com.luminai.connection.model.VaultCredential;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** Spring Data repository for durable database-backed credential storage. */
@Repository
public interface VaultCredentialRepository extends JpaRepository<VaultCredential, UUID> {

  Optional<VaultCredential> findByTenantIdAndConnectorId(UUID tenantId, UUID connectorId);

  void deleteByTenantIdAndConnectorId(UUID tenantId, UUID connectorId);
}
