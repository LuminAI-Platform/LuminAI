package com.luminai.connection;

import com.luminai.common.exception.ResourceNotFoundException;
import com.luminai.common.security.JwtClaimsExtractor;
import com.luminai.connection.dto.ConnectionDto;
import com.luminai.connection.model.Connection;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service layer for Connection CRUD operations.
 *
 * <p>Tenant isolation is enforced on every operation by extracting the tenant ID from the
 * authenticated JWT context.
 */
@Service
public class ConnectionService {

  private static final Logger log = LoggerFactory.getLogger(ConnectionService.class);

  private final ConnectionRepository repository;
  private final JwtClaimsExtractor claimsExtractor;

  public ConnectionService(ConnectionRepository repository, JwtClaimsExtractor claimsExtractor) {
    this.repository = repository;
    this.claimsExtractor = claimsExtractor;
  }

  /** Create a new connection registry entry for the authenticated tenant. */
  @Transactional
  public ConnectionDto.Response create(ConnectionDto.CreateRequest request) {
    UUID tenantId = getCurrentTenantId();

    Connection connection =
        new Connection(
            tenantId,
            request.name(),
            request.type(),
            request.config(),
            request.credentialsRef(),
            null);

    Connection saved = repository.save(connection);
    log.info(
        "Created connection '{}' (id={}) for tenant {}",
        saved.getName(),
        saved.getId(),
        tenantId);

    return ConnectionDto.Response.from(saved);
  }

  /** Get a connection by ID, scoped to the authenticated tenant. */
  @Transactional(readOnly = true)
  public ConnectionDto.Response getById(UUID id) {
    UUID tenantId = getCurrentTenantId();

    Connection connection =
        repository
            .findByIdAndTenantId(id, tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("Connection", id));

    return ConnectionDto.Response.from(connection);
  }

  /** Get all connections configured for the authenticated tenant. */
  @Transactional(readOnly = true)
  public List<ConnectionDto.Response> getAllForTenant() {
    UUID tenantId = getCurrentTenantId();

    return repository.findAllByTenantId(tenantId).stream()
        .map(ConnectionDto.Response::from)
        .toList();
  }

  /** Update an existing connection entry (partial update). */
  @Transactional
  public ConnectionDto.Response update(UUID id, ConnectionDto.UpdateRequest request) {
    UUID tenantId = getCurrentTenantId();

    Connection connection =
        repository
            .findByIdAndTenantId(id, tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("Connection", id));

    if (request.name() != null) {
      connection.setName(request.name());
    }
    if (request.config() != null) {
      connection.setConfig(request.config());
    }
    if (request.credentialsRef() != null) {
      connection.setCredentialsRef(request.credentialsRef());
    }
    if (request.status() != null) {
      connection.setStatus(request.status());
    }

    Connection updated = repository.save(connection);
    log.info(
        "Updated connection '{}' (id={}) for tenant {}",
        updated.getName(),
        updated.getId(),
        tenantId);

    return ConnectionDto.Response.from(updated);
  }

  /** Delete a connection entry by ID, scoped to the authenticated tenant. */
  @Transactional
  public void delete(UUID id) {
    UUID tenantId = getCurrentTenantId();

    long deleted = repository.deleteByIdAndTenantId(id, tenantId);
    if (deleted == 0) {
      throw new ResourceNotFoundException("Connection", id);
    }
    log.info("Deleted connection (id={}) for tenant {}", id, tenantId);
  }

  private UUID getCurrentTenantId() {
    return UUID.fromString(claimsExtractor.getCurrentTenantId());
  }
}
