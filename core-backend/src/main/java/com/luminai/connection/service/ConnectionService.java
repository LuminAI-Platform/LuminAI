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
  private static final int MAX_LIST_SAMPLE_ROWS = 10;

  private final ConnectionRepository repository;
  private final PipelineRunRepository pipelineRunRepository;
  private CredentialsVaultService credentialsVaultService;
  private com.fasterxml.jackson.databind.ObjectMapper objectMapper;

  @Autowired(required = false)
  private org.springframework.cache.CacheManager cacheManager;

  public ConnectionService(
      ConnectionRepository repository,
      @Autowired(required = false) PipelineRunRepository pipelineRunRepository) {
    this.repository = repository;
    this.pipelineRunRepository = pipelineRunRepository;
  }

  @Autowired(required = false)
  public void setCredentialsVaultService(CredentialsVaultService credentialsVaultService) {
    this.credentialsVaultService = credentialsVaultService;
  }

  @Autowired(required = false)
  public void setObjectMapper(com.fasterxml.jackson.databind.ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  @Autowired(required = false)
  public void setCacheManager(org.springframework.cache.CacheManager cacheManager) {
    this.cacheManager = cacheManager;
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

    // Persist encrypted database/API credentials in vault when supplied on creation
    if (credentialsVaultService != null && hasInlineCredentials(request)) {
      String credsJson = buildCredentialsJson(request);
      String vaultRef =
          credentialsVaultService.storeCredentials(tenantId, saved.getId(), credsJson);
      if (saved.getCredentialsRef() == null || saved.getCredentialsRef().isBlank()) {
        saved.setCredentialsRef(vaultRef);
        saved = repository.save(saved);
      }
    }

    log.info(
        "Created connection '{}' (id={}) for tenant {}", saved.getName(), saved.getId(), tenantId);

    return toResponse(saved, List.of());
  }

  private boolean hasInlineCredentials(ConnectionDto.CreateRequest request) {
    return (request.password() != null && !request.password().isBlank())
        || (request.username() != null && !request.username().isBlank())
        || (request.host() != null && !request.host().isBlank());
  }

  private String buildCredentialsJson(ConnectionDto.CreateRequest request) {
    Map<String, Object> creds = new java.util.LinkedHashMap<>();
    if (request.config() != null && !request.config().isBlank() && objectMapper != null) {
      try {
        @SuppressWarnings("unchecked")
        Map<String, Object> cfg = objectMapper.readValue(request.config(), Map.class);
        if (cfg.containsKey("host")) creds.put("host", cfg.get("host"));
        if (cfg.containsKey("port")) creds.put("port", cfg.get("port"));
        if (cfg.containsKey("database")) creds.put("database", cfg.get("database"));
        if (cfg.containsKey("username")) creds.put("username", cfg.get("username"));
      } catch (Exception ignored) {
      }
    }
    if (request.host() != null) creds.put("host", request.host());
    if (request.port() != null) creds.put("port", request.port());
    if (request.database() != null) creds.put("database", request.database());
    if (request.username() != null) creds.put("username", request.username());
    if (request.password() != null) creds.put("password", request.password());

    try {
      com.fasterxml.jackson.databind.ObjectMapper mapper =
          objectMapper != null ? objectMapper : new com.fasterxml.jackson.databind.ObjectMapper();
      return mapper.writeValueAsString(creds);
    } catch (Exception e) {
      throw new IllegalStateException("Failed to serialize connector credentials", e);
    }
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
        .map(conn -> toResponse(conn, runsByConn.getOrDefault(conn.getId(), List.of()), true))
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
    ConnectionCleanPreviewService.evictPreviewCache(cacheManager, tenantId, id);
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
    return toResponse(entity, runs, false);
  }

  private ConnectionDto.Response toResponse(
      Connection entity, List<PipelineRun> runs, boolean compactList) {
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
    String configPayload =
        compactList ? summarizeConfigForList(entity.getConfig()) : entity.getConfig();

    return new ConnectionDto.Response(
        entity.getId(),
        entity.getTenantId(),
        entity.getName(),
        entity.getType(),
        configPayload,
        entity.getCredentialsRef(),
        status,
        latestCompleted,
        rowsSynced,
        false,
        entity.getCreatedBy(),
        entity.getCreatedAt(),
        entity.getUpdatedAt());
  }

  private String summarizeConfigForList(String rawConfig) {
    if (rawConfig == null || rawConfig.isBlank()) {
      return rawConfig;
    }
    try {
      com.fasterxml.jackson.databind.ObjectMapper mapper =
          objectMapper != null ? objectMapper : new com.fasterxml.jackson.databind.ObjectMapper();
      com.fasterxml.jackson.databind.JsonNode root = mapper.readTree(rawConfig);
      if (!root.isObject()) {
        return rawConfig;
      }
      boolean modified = false;
      com.fasterxml.jackson.databind.node.ObjectNode obj =
          (com.fasterxml.jackson.databind.node.ObjectNode) root;
      modified |= trimSampleRowsArray(obj.get("sampleRows"));
      if (obj.has("tables") && obj.get("tables").isArray()) {
        for (com.fasterxml.jackson.databind.JsonNode tbl : obj.get("tables")) {
          if (tbl.isObject()) {
            modified |= trimSampleRowsArray(tbl.get("sampleRows"));
          }
        }
      }
      return modified ? mapper.writeValueAsString(obj) : rawConfig;
    } catch (Exception e) {
      return rawConfig;
    }
  }

  private static boolean trimSampleRowsArray(com.fasterxml.jackson.databind.JsonNode node) {
    if (node instanceof com.fasterxml.jackson.databind.node.ArrayNode arr
        && arr.size() > MAX_LIST_SAMPLE_ROWS) {
      while (arr.size() > MAX_LIST_SAMPLE_ROWS) {
        arr.remove(arr.size() - 1);
      }
      return true;
    }
    return false;
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
    ConnectionCleanPreviewService.evictPreviewCache(cacheManager, tenantId, id);
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
