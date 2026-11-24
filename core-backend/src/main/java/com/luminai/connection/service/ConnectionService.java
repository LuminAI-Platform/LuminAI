package com.luminai.connection.service;

import com.luminai.common.exception.ResourceNotFoundException;
import com.luminai.common.tenant.TenantContext;
import com.luminai.connection.dto.ConnectionDto;
import com.luminai.connection.model.Connection;
import com.luminai.connection.model.PipelineRun;
import com.luminai.connection.repository.ConnectionRepository;
import com.luminai.connection.repository.PipelineRunRepository;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service layer for Connection CRUD operations.
 *
 * <p>Tenant isolation is enforced on every operation by scoping to the tenant resolved onto {@link
 * TenantContext} for the current request (see {@link com.luminai.common.tenant.TenantFilter} and
 * {@link com.luminai.common.tenant.TenantResolutionService}) — not by trusting any claim on the JWT
 * itself.
 */
@Service
public class ConnectionService {

  private static final Logger log = LoggerFactory.getLogger(ConnectionService.class);

  private final ConnectionRepository repository;
  private final PipelineRunRepository pipelineRunRepository;

  public ConnectionService(
      ConnectionRepository repository,
      @Autowired(required = false) PipelineRunRepository pipelineRunRepository) {
    this.repository = repository;
    this.pipelineRunRepository = pipelineRunRepository;
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
        "Created connection '{}' (id={}) for tenant {}", saved.getName(), saved.getId(), tenantId);

    return toResponse(saved, List.of());
  }

  /** Get a connection by ID, scoped to the authenticated tenant. */
  @Transactional(readOnly = true)
  public ConnectionDto.Response getById(UUID id) {
    UUID tenantId = getCurrentTenantId();

    Connection connection =
        repository
            .findByIdAndTenantId(id, tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("Connection", id));

    List<PipelineRun> runs =
        pipelineRunRepository != null ? pipelineRunRepository.findByConnectionId(id) : List.of();

    return toResponse(connection, runs);
  }

  /** Get all connections configured for the authenticated tenant. */
  @Transactional(readOnly = true)
  public List<ConnectionDto.Response> getAllForTenant() {
    UUID tenantId = getCurrentTenantId();
    List<Connection> connections = repository.findAllByTenantId(tenantId);
    if (connections.isEmpty()) return List.of();

    List<PipelineRun> runs =
        pipelineRunRepository != null ? pipelineRunRepository.findAll() : List.of();
    Map<UUID, List<PipelineRun>> runsByConn =
        runs.stream()
            .filter(r -> r.getConnectionId() != null)
            .collect(Collectors.groupingBy(PipelineRun::getConnectionId));

    return connections.stream()
        .map(conn -> toResponse(conn, runsByConn.getOrDefault(conn.getId(), List.of())))
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

    List<PipelineRun> runs =
        pipelineRunRepository != null ? pipelineRunRepository.findByConnectionId(id) : List.of();
    return toResponse(updated, runs);
  }

  private ConnectionDto.Response toResponse(Connection entity, List<PipelineRun> runs) {
    long rowsSynced = 0;
    boolean isSyncing = false;
    Instant latestCompleted = entity.getLastSyncAt();

    if (runs != null && !runs.isEmpty()) {
      for (PipelineRun run : runs) {
        if (run.getStatus() == PipelineRun.PipelineRunStatus.RUNNING
            || run.getStatus() == PipelineRun.PipelineRunStatus.INGESTING) {
          isSyncing = true;
        }
        rowsSynced += run.getRecordsOutput();
        if (run.getCompletedAt() != null) {
          if (latestCompleted == null || run.getCompletedAt().isAfter(latestCompleted)) {
            latestCompleted = run.getCompletedAt();
          }
        }
      }
    }

    if (rowsSynced == 0) {
      rowsSynced = extractRowsSynced(entity.getConfig());
    }

    Connection.Status status = isSyncing ? Connection.Status.SYNCING : entity.getStatus();

    return new ConnectionDto.Response(
        entity.getId(),
        entity.getTenantId(),
        entity.getName(),
        entity.getType(),
        entity.getConfig(),
        entity.getCredentialsRef(),
        status,
        latestCompleted,
        rowsSynced,
        false,
        entity.getCreatedBy(),
        entity.getCreatedAt(),
        entity.getUpdatedAt());
  }

  private static long extractRowsSynced(String config) {
    if (config == null || config.isBlank()) return 0;
    try {
      com.fasterxml.jackson.databind.JsonNode n =
          new com.fasterxml.jackson.databind.ObjectMapper().readTree(config);
      if (n.has("recordsCount")) return n.get("recordsCount").asLong();
      if (n.has("rowsSynced")) return n.get("rowsSynced").asLong();
    } catch (Exception ignored) {
    }
    return 0;
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
    UUID tenantId = TenantContext.getTenantUuid();
    if (tenantId == null) {
      throw new IllegalStateException(
          "No tenant has been resolved for the current request. TenantFilter should have "
              + "resolved and set one for every authenticated application request.");
    }
    return tenantId;
  }
}
