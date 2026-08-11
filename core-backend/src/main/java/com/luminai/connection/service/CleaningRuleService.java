package com.luminai.connection.service;

import com.luminai.common.exception.ResourceNotFoundException;
import com.luminai.common.security.JwtClaimsExtractor;
import com.luminai.connection.dto.CleaningRuleDto;
import com.luminai.connection.model.CleaningRule;
import com.luminai.connection.repository.CleaningRuleRepository;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service layer for CleaningRule CRUD operations. Tenant isolation is enforced on every operation
 * by extracting the tenant ID from the authenticated JWT. A request from Tenant A can never read,
 * update, or delete Tenant B's cleaning rules.
 */
@Service
public class CleaningRuleService {

  private static final Logger log = LoggerFactory.getLogger(CleaningRuleService.class);

  private final CleaningRuleRepository repository;
  private final JwtClaimsExtractor claimsExtractor;

  public CleaningRuleService(
      CleaningRuleRepository repository, JwtClaimsExtractor claimsExtractor) {
    this.repository = repository;
    this.claimsExtractor = claimsExtractor;
  }

  /** Create a new cleaning rule for the given connector, scoped to the authenticated tenant. */
  @Transactional
  public CleaningRuleDto.Response create(UUID connectionId, CleaningRuleDto.CreateRequest request) {
    UUID tenantId = getCurrentTenantId();

    CleaningRule rule =
        new CleaningRule(
            tenantId,
            connectionId,
            request.columnName(),
            request.ruleType(),
            request.ruleConfig(),
            request.priority(),
            request.enabled());

    CleaningRule saved = repository.save(rule);
    log.info(
        "Created cleaning rule '{}' on column '{}' (id={}) for connection {} in tenant {}",
        saved.getRuleType(),
        saved.getColumnName(),
        saved.getId(),
        connectionId,
        tenantId);

    return CleaningRuleDto.Response.from(saved);
  }

  /**
   * List all cleaning rules for a connector, scoped to the authenticated tenant, ordered by
   * priority ascending.
   */
  @Transactional(readOnly = true)
  public List<CleaningRuleDto.Response> getAllForConnection(UUID connectionId) {
    UUID tenantId = getCurrentTenantId();

    return repository
        .findAllByConnectionIdAndTenantIdOrderByPriorityAsc(connectionId, tenantId)
        .stream()
        .map(CleaningRuleDto.Response::from)
        .toList();
  }

  /**
   * Get a cleaning rule by ID, scoped to the authenticated tenant.
   *
   * @throws ResourceNotFoundException if not found or belongs to another tenant
   */
  @Transactional(readOnly = true)
  public CleaningRuleDto.Response getById(UUID ruleId) {
    UUID tenantId = getCurrentTenantId();

    CleaningRule rule =
        repository
            .findByIdAndTenantId(ruleId, tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("CleaningRule", ruleId));

    return CleaningRuleDto.Response.from(rule);
  }

  /**
   * Update an existing cleaning rule. Only non-null fields in the request are applied (partial
   * update).
   *
   * @throws ResourceNotFoundException if not found or belongs to another tenant
   */
  @Transactional
  public CleaningRuleDto.Response update(UUID ruleId, CleaningRuleDto.UpdateRequest request) {
    UUID tenantId = getCurrentTenantId();

    CleaningRule rule =
        repository
            .findByIdAndTenantId(ruleId, tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("CleaningRule", ruleId));

    // Apply partial updates — only overwrite if the field was provided
    if (request.columnName() != null) {
      rule.setColumnName(request.columnName());
    }
    if (request.ruleType() != null) {
      rule.setRuleType(request.ruleType());
    }
    if (request.ruleConfig() != null) {
      rule.setRuleConfig(request.ruleConfig());
    }
    if (request.priority() != null) {
      rule.setPriority(request.priority());
    }
    if (request.enabled() != null) {
      rule.setEnabled(request.enabled());
    }

    CleaningRule updated = repository.save(rule);
    log.info(
        "Updated cleaning rule '{}' (id={}) for tenant {}",
        updated.getRuleType(),
        updated.getId(),
        tenantId);

    return CleaningRuleDto.Response.from(updated);
  }

  /**
   * Delete a cleaning rule by ID, scoped to the authenticated tenant.
   *
   * @throws ResourceNotFoundException if not found or belongs to another tenant
   */
  @Transactional
  public void delete(UUID ruleId) {
    UUID tenantId = getCurrentTenantId();

    long deleted = repository.deleteByIdAndTenantId(ruleId, tenantId);
    if (deleted == 0) {
      throw new ResourceNotFoundException("CleaningRule", ruleId);
    }
    log.info("Deleted cleaning rule (id={}) for tenant {}", ruleId, tenantId);
  }

  // Helpers

  private UUID getCurrentTenantId() {
    return UUID.fromString(claimsExtractor.getCurrentTenantId());
  }
}
