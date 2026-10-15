package com.luminai.auth.repository;

import com.luminai.auth.model.ApiKey;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ApiKeyRepository extends JpaRepository<ApiKey, UUID> {

  @Query("SELECT k FROM ApiKey k WHERE k.keyHash = :keyHash AND k.isActive = true")
  Optional<ApiKey> findByKeyHashAndIsActiveTrue(@Param("keyHash") String keyHash);

  @Query("SELECT k FROM ApiKey k WHERE k.tenant.id = :tenantId AND k.isActive = true ORDER BY k.createdAt DESC")
  List<ApiKey> findByTenantIdAndIsActiveTrueOrderByCreatedAtDesc(@Param("tenantId") UUID tenantId);

  @Modifying
  @Query("UPDATE ApiKey k SET k.isActive = false WHERE k.tenant.id = :tenantId")
  void deactivateAllForTenant(@Param("tenantId") UUID tenantId);
}
