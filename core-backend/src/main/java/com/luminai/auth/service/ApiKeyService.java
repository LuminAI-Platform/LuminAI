package com.luminai.auth.service;

import com.luminai.auth.dto.ApiKeyDto;
import com.luminai.auth.dto.ApiKeyRotateResponse;
import com.luminai.auth.model.ApiKey;
import com.luminai.auth.model.Tenant;
import com.luminai.auth.repository.ApiKeyRepository;
import com.luminai.auth.repository.TenantRepository;
import com.luminai.common.exception.ResourceNotFoundException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Service managing enterprise API keys: rotation, hashing, and authentication verification. */
@Service
public class ApiKeyService {

  private static final Logger log = LoggerFactory.getLogger(ApiKeyService.class);
  private static final SecureRandom RANDOM = new SecureRandom();

  private final ApiKeyRepository apiKeyRepository;
  private final TenantRepository tenantRepository;

  public ApiKeyService(ApiKeyRepository apiKeyRepository, TenantRepository tenantRepository) {
    this.apiKeyRepository = apiKeyRepository;
    this.tenantRepository = tenantRepository;
  }

  @Transactional(readOnly = true)
  public Optional<ApiKeyDto> getActiveApiKey(UUID tenantId) {
    List<ApiKey> keys =
        apiKeyRepository.findByTenantIdAndIsActiveTrueOrderByCreatedAtDesc(tenantId);
    if (keys.isEmpty()) {
      return Optional.empty();
    }
    ApiKey key = keys.get(0);
    return Optional.of(
        new ApiKeyDto(
            key.getId(),
            key.getName(),
            key.getKeyPrefix(),
            key.getCreatedAt(),
            key.getLastUsedAt(),
            key.isActive()));
  }

  @Transactional
  public ApiKeyRotateResponse rotateApiKey(UUID tenantId, String keyName) {
    Tenant tenant =
        tenantRepository
            .findById(tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId));

    // 1. Deactivate existing active keys for tenant
    apiKeyRepository.deactivateAllForTenant(tenantId);

    // 2. Generate secure random key: lum_live_<32-hex>
    byte[] randomBytes = new byte[16];
    RANDOM.nextBytes(randomBytes);
    String rawKey = "lum_live_" + HexFormat.of().formatHex(randomBytes);
    String keyPrefix = rawKey.substring(0, 16);
    String keyHash = hashKey(rawKey);

    String resolvedName = (keyName != null && !keyName.isBlank()) ? keyName : "Production Live Key";
    ApiKey apiKey = new ApiKey(tenant, resolvedName, keyPrefix, keyHash);
    apiKey = apiKeyRepository.save(apiKey);

    log.info("Rotated API key for tenant '{}' (prefix={})", tenant.getSlug(), keyPrefix);

    return new ApiKeyRotateResponse(
        apiKey.getId(), rawKey, keyPrefix, apiKey.getName(), apiKey.getCreatedAt());
  }

  @Transactional
  public Optional<ApiKey> validateAndTouch(String rawKey) {
    if (rawKey == null || !rawKey.startsWith("lum_live_")) {
      return Optional.empty();
    }
    String hash = hashKey(rawKey);
    Optional<ApiKey> keyOpt = apiKeyRepository.findByKeyHashAndIsActiveTrue(hash);
    if (keyOpt.isPresent()) {
      ApiKey key = keyOpt.get();
      key.setLastUsedAt(Instant.now());
      apiKeyRepository.save(key);
      return Optional.of(key);
    }
    return Optional.empty();
  }

  public static String hashKey(String rawKey) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hashBytes = digest.digest(rawKey.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(hashBytes);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 algorithm unavailable", e);
    }
  }
}
