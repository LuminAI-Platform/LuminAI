package com.luminai.connection.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import com.luminai.connection.model.VaultCredential;
import com.luminai.connection.repository.VaultCredentialRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CredentialsVaultServiceTest {

  @Mock private VaultCredentialRepository vaultCredentialRepository;

  private CredentialsVaultService service;

  private static final String ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef";

  @BeforeEach
  void setUp() {
    service = new CredentialsVaultService(ENCRYPTION_KEY, vaultCredentialRepository);
  }

  @Test
  @DisplayName("storeCredentials encrypts data and saves to database and cache")
  void storeCredentialsSuccess() {
    UUID tenantId = UUID.randomUUID();
    UUID connectorId = UUID.randomUUID();
    String plaintext = "{\"username\":\"admin\",\"password\":\"secret123\"}";

    when(vaultCredentialRepository.findByTenantIdAndConnectorId(tenantId, connectorId))
        .thenReturn(Optional.empty());

    String vaultKey = service.storeCredentials(tenantId, connectorId, plaintext);

    assertThat(vaultKey).isEqualTo(tenantId + "::" + connectorId);

    ArgumentCaptor<VaultCredential> captor = ArgumentCaptor.forClass(VaultCredential.class);
    verify(vaultCredentialRepository).save(captor.capture());
    VaultCredential saved = captor.getValue();

    assertThat(saved.getTenantId()).isEqualTo(tenantId);
    assertThat(saved.getConnectorId()).isEqualTo(connectorId);
    assertThat(saved.getEncryptedData()).isNotBlank();
    assertThat(saved.getEncryptedData()).isNotEqualTo(plaintext);

    // Retrieve from hot cache
    Optional<String> retrieved = service.retrieveCredentials(tenantId, connectorId);
    assertThat(retrieved).isPresent();
    assertThat(retrieved.get()).isEqualTo(plaintext);
  }

  @Test
  @DisplayName("retrieveCredentials falls back to database on cache miss")
  void retrieveCredentialsFromDatabase() {
    UUID tenantId = UUID.randomUUID();
    UUID connectorId = UUID.randomUUID();
    String plaintext = "{\"apiKey\":\"lum_live_998877\"}";

    // First store to get valid encrypted ciphertext
    String vaultKey = service.storeCredentials(tenantId, connectorId, plaintext);

    // Create a new instance without hot cache
    CredentialsVaultService newInstance =
        new CredentialsVaultService(ENCRYPTION_KEY, vaultCredentialRepository);

    // Re-encrypt to simulate pre-existing database record
    String reStoredKey = service.storeCredentials(tenantId, connectorId, plaintext);
    ArgumentCaptor<VaultCredential> captor = ArgumentCaptor.forClass(VaultCredential.class);
    verify(vaultCredentialRepository, atLeastOnce()).save(captor.capture());
    VaultCredential stored = captor.getValue();

    when(vaultCredentialRepository.findByTenantIdAndConnectorId(tenantId, connectorId))
        .thenReturn(Optional.of(stored));

    Optional<String> retrieved = newInstance.retrieveCredentials(tenantId, connectorId);

    assertThat(retrieved).isPresent();
    assertThat(retrieved.get()).isEqualTo(plaintext);
  }

  @Test
  @DisplayName("deleteCredentials removes from cache and database")
  void deleteCredentialsSuccess() {
    UUID tenantId = UUID.randomUUID();
    UUID connectorId = UUID.randomUUID();
    String plaintext = "secret";

    service.storeCredentials(tenantId, connectorId, plaintext);

    VaultCredential credential = new VaultCredential(tenantId, connectorId, "encrypted");
    when(vaultCredentialRepository.findByTenantIdAndConnectorId(tenantId, connectorId))
        .thenReturn(Optional.of(credential));

    boolean deleted = service.deleteCredentials(tenantId, connectorId);

    assertThat(deleted).isTrue();
    verify(vaultCredentialRepository).delete(credential);
  }
}
