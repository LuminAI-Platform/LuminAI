package com.luminai.connection.service;

import com.luminai.connection.model.VaultCredential;
import com.luminai.connection.repository.VaultCredentialRepository;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Enterprise implementation of a credentials vault. Encrypts connector credentials using
 * AES-256-GCM and durably stores them in PostgreSQL ({@code public.vault_credentials}) with an
 * in-memory hot-cache for ultra-low latency.
 *
 * <p>Credentials are keyed by {@code tenantId + connectorId} to enforce strict multi-tenant
 * isolation.
 */
@Service
public class CredentialsVaultService {

  private static final Logger log = LoggerFactory.getLogger(CredentialsVaultService.class);

  private static final String ALGORITHM = "AES/GCM/NoPadding";
  private static final int GCM_IV_LENGTH = 12; // 96 bits — NIST recommendation
  private static final int GCM_TAG_LENGTH = 128; // 128-bit auth tag

  private final SecretKeySpec secretKey;
  private final SecureRandom secureRandom = new SecureRandom();
  private final VaultCredentialRepository vaultCredentialRepository;

  /**
   * In-memory encrypted credential cache. Key: "tenantId::connectorId", Value: Base64-encoded
   * ciphertext (IV + encrypted data).
   */
  private final Map<String, String> vault = new ConcurrentHashMap<>();

  public CredentialsVaultService(
      @Value("${luminai.vault.encryption-key}") String encryptionKey,
      VaultCredentialRepository vaultCredentialRepository) {
    this.vaultCredentialRepository = vaultCredentialRepository;
    byte[] keyBytes = normalizeKey(encryptionKey);
    this.secretKey = new SecretKeySpec(keyBytes, "AES");
    log.info("CredentialsVaultService initialised with AES-256-GCM durable database vault");
  }

  /**
   * Store encrypted credentials for a connector both durably in PostgreSQL and in hot cache.
   *
   * @param tenantId the tenant owning the connector
   * @param connectorId the connector to associate credentials with
   * @param credentials the plaintext credentials (e.g. JSON with username/password)
   * @return the vault reference key
   */
  @Transactional
  public String storeCredentials(UUID tenantId, UUID connectorId, String credentials) {
    String vaultKey = buildVaultKey(tenantId, connectorId);
    String encrypted = encrypt(credentials);
    vault.put(vaultKey, encrypted);

    if (vaultCredentialRepository != null) {
      vaultCredentialRepository
          .findByTenantIdAndConnectorId(tenantId, connectorId)
          .ifPresentOrElse(
              existing -> {
                existing.setEncryptedData(encrypted);
                vaultCredentialRepository.save(existing);
              },
              () -> {
                vaultCredentialRepository.save(
                    new VaultCredential(tenantId, connectorId, encrypted));
              });
    }

    log.debug(
        "Stored durable encrypted credentials for connector {} (tenant {})", connectorId, tenantId);
    return vaultKey;
  }

  /**
   * Retrieve and decrypt credentials for a connector from cache or durable database store.
   *
   * @param tenantId the tenant owning the connector
   * @param connectorId the connector whose credentials to retrieve
   * @return decrypted credentials, or empty if not found
   */
  @Transactional(readOnly = true)
  public Optional<String> retrieveCredentials(UUID tenantId, UUID connectorId) {
    String vaultKey = buildVaultKey(tenantId, connectorId);
    String encrypted = vault.get(vaultKey);
    if (encrypted == null && vaultCredentialRepository != null) {
      encrypted =
          vaultCredentialRepository
              .findByTenantIdAndConnectorId(tenantId, connectorId)
              .map(VaultCredential::getEncryptedData)
              .orElse(null);
      if (encrypted != null) {
        vault.put(vaultKey, encrypted);
      }
    }
    if (encrypted == null) {
      return Optional.empty();
    }
    return Optional.of(decrypt(encrypted));
  }

  /**
   * Delete credentials for a connector from cache and durable database.
   *
   * @param tenantId the tenant owning the connector
   * @param connectorId the connector whose credentials to delete
   * @return true if credentials existed and were removed
   */
  @Transactional
  public boolean deleteCredentials(UUID tenantId, UUID connectorId) {
    String vaultKey = buildVaultKey(tenantId, connectorId);
    boolean existedInCache = vault.remove(vaultKey) != null;
    boolean existedInDb = false;
    if (vaultCredentialRepository != null) {
      var found = vaultCredentialRepository.findByTenantIdAndConnectorId(tenantId, connectorId);
      if (found.isPresent()) {
        vaultCredentialRepository.delete(found.get());
        existedInDb = true;
      }
    }
    boolean existed = existedInCache || existedInDb;
    if (existed) {
      log.debug("Deleted credentials for connector {} (tenant {})", connectorId, tenantId);
    }
    return existed;
  }

  /**
   * Rotate credentials: atomically replace with new encrypted value.
   *
   * @param tenantId the tenant owning the connector
   * @param connectorId the connector whose credentials to rotate
   * @param newCredentials the new plaintext credentials
   * @return the vault reference key
   */
  public String rotateCredentials(UUID tenantId, UUID connectorId, String newCredentials) {
    return storeCredentials(tenantId, connectorId, newCredentials);
  }

  // ----------------------------------------------------------------
  // Internal encryption helpers
  // ----------------------------------------------------------------

  private String encrypt(String plaintext) {
    try {
      byte[] iv = new byte[GCM_IV_LENGTH];
      secureRandom.nextBytes(iv);

      Cipher cipher = Cipher.getInstance(ALGORITHM);
      cipher.init(Cipher.ENCRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_LENGTH, iv));

      byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

      // Prepend IV to ciphertext for self-contained decryption
      ByteBuffer buffer = ByteBuffer.allocate(GCM_IV_LENGTH + ciphertext.length);
      buffer.put(iv);
      buffer.put(ciphertext);

      return Base64.getEncoder().encodeToString(buffer.array());
    } catch (Exception e) {
      throw new IllegalStateException("Failed to encrypt credentials", e);
    }
  }

  private String decrypt(String base64Ciphertext) {
    try {
      byte[] decoded = Base64.getDecoder().decode(base64Ciphertext);
      ByteBuffer buffer = ByteBuffer.wrap(decoded);

      byte[] iv = new byte[GCM_IV_LENGTH];
      buffer.get(iv);

      byte[] ciphertext = new byte[buffer.remaining()];
      buffer.get(ciphertext);

      Cipher cipher = Cipher.getInstance(ALGORITHM);
      cipher.init(Cipher.DECRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_LENGTH, iv));

      byte[] plaintext = cipher.doFinal(ciphertext);
      return new String(plaintext, StandardCharsets.UTF_8);
    } catch (Exception e) {
      throw new IllegalStateException("Failed to decrypt credentials", e);
    }
  }

  /**
   * Normalise the encryption key to exactly 32 bytes (AES-256). Pads with zeros if too short,
   * truncates if too long.
   */
  private static byte[] normalizeKey(String key) {
    byte[] raw = key.getBytes(StandardCharsets.UTF_8);
    byte[] normalised = new byte[32];
    System.arraycopy(raw, 0, normalised, 0, Math.min(raw.length, 32));
    return normalised;
  }

  private static String buildVaultKey(UUID tenantId, UUID connectorId) {
    return tenantId.toString() + "::" + connectorId.toString();
  }
}
