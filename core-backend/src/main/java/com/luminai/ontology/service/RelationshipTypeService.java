package com.luminai.ontology.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luminai.common.exception.ConflictException;
import com.luminai.common.exception.ResourceNotFoundException;
import com.luminai.common.security.JwtClaimsExtractor;
import com.luminai.common.tenant.TenantContext;
import com.luminai.ontology.dto.RelationshipTypeDto;
import com.luminai.ontology.model.RelationshipType;
import com.luminai.ontology.repository.EntityTypeRepository;
import com.luminai.ontology.repository.RelationshipTypeRepository;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service managing directional Ontology Relationship Types linking two Entity Types.
 *
 * <p>Enforces multi-tenant isolation, source/target existence validation, and uniqueness.
 */
@Service
public class RelationshipTypeService {

  private static final Logger log = LoggerFactory.getLogger(RelationshipTypeService.class);
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final UUID DEFAULT_SYSTEM_TENANT =
      UUID.fromString("00000000-0000-0000-0000-000000000001");

  private final RelationshipTypeRepository repository;
  private final EntityTypeRepository entityTypeRepository;
  private final JwtClaimsExtractor claimsExtractor;

  public RelationshipTypeService(
      RelationshipTypeRepository repository,
      EntityTypeRepository entityTypeRepository,
      JwtClaimsExtractor claimsExtractor) {
    this.repository = repository;
    this.entityTypeRepository = entityTypeRepository;
    this.claimsExtractor = claimsExtractor;
  }

  /** Lists all relationship types defined for the current tenant. */
  @Transactional(readOnly = true)
  public List<RelationshipTypeDto.Response> getAll() {
    UUID tenantId = getCurrentTenantId();
    return repository.findAllByTenantIdOrderByNameAsc(tenantId).stream()
        .map(RelationshipTypeDto.Response::from)
        .toList();
  }

  /** Retrieves a relationship type by ID. */
  @Transactional(readOnly = true)
  public RelationshipTypeDto.Response getById(UUID id) {
    UUID tenantId = getCurrentTenantId();
    RelationshipType relType =
        repository
            .findByIdAndTenantId(id, tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("RelationshipType", id));
    return RelationshipTypeDto.Response.from(relType);
  }

  /** Creates a new directional relationship type. */
  @Transactional
  public RelationshipTypeDto.Response create(RelationshipTypeDto.CreateRequest request) {
    UUID tenantId = getCurrentTenantId();

    if (repository.existsByNameIgnoreCaseAndTenantId(request.name(), tenantId)) {
      throw new ConflictException(
          "Relationship type with name '" + request.name() + "' already exists for this tenant");
    }

    // Validate that source and target entity types exist for this tenant
    entityTypeRepository
        .findByIdAndTenantId(request.sourceEntityTypeId(), tenantId)
        .orElseThrow(
            () -> new ResourceNotFoundException("Source EntityType", request.sourceEntityTypeId()));

    entityTypeRepository
        .findByIdAndTenantId(request.targetEntityTypeId(), tenantId)
        .orElseThrow(
            () -> new ResourceNotFoundException("Target EntityType", request.targetEntityTypeId()));

    String schemaJson = serializePropertiesSchema(request.propertiesSchema());

    RelationshipType relationshipType =
        new RelationshipType(
            tenantId,
            null,
            request.name().trim(),
            request.description(),
            request.sourceEntityTypeId(),
            request.targetEntityTypeId(),
            request.cardinality() != null
                ? request.cardinality()
                : RelationshipType.Cardinality.MANY_TO_MANY,
            schemaJson);

    RelationshipType saved = repository.save(relationshipType);
    log.info(
        "Created relationship type '{}' (id={}) for tenant {}",
        saved.getName(),
        saved.getId(),
        tenantId);
    return RelationshipTypeDto.Response.from(saved);
  }

  /** Updates an existing relationship type. */
  @Transactional
  public RelationshipTypeDto.Response update(UUID id, RelationshipTypeDto.UpdateRequest request) {
    UUID tenantId = getCurrentTenantId();

    RelationshipType relType =
        repository
            .findByIdAndTenantId(id, tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("RelationshipType", id));

    if (request.name() != null
        && !request.name().isBlank()
        && !request.name().equalsIgnoreCase(relType.getName())) {
      if (repository.existsByNameIgnoreCaseAndTenantId(request.name().trim(), tenantId)) {
        throw new ConflictException(
            "Relationship type with name '" + request.name() + "' already exists for this tenant");
      }
      relType.setName(request.name().trim());
    }

    if (request.description() != null) {
      relType.setDescription(request.description());
    }

    if (request.sourceEntityTypeId() != null) {
      entityTypeRepository
          .findByIdAndTenantId(request.sourceEntityTypeId(), tenantId)
          .orElseThrow(
              () ->
                  new ResourceNotFoundException("Source EntityType", request.sourceEntityTypeId()));
      relType.setSourceEntityTypeId(request.sourceEntityTypeId());
    }

    if (request.targetEntityTypeId() != null) {
      entityTypeRepository
          .findByIdAndTenantId(request.targetEntityTypeId(), tenantId)
          .orElseThrow(
              () ->
                  new ResourceNotFoundException("Target EntityType", request.targetEntityTypeId()));
      relType.setTargetEntityTypeId(request.targetEntityTypeId());
    }

    if (request.cardinality() != null) {
      relType.setCardinality(request.cardinality());
    }

    if (request.propertiesSchema() != null) {
      relType.setPropertiesSchema(serializePropertiesSchema(request.propertiesSchema()));
    }

    RelationshipType updated = repository.save(relType);
    log.info(
        "Updated relationship type '{}' (id={}) for tenant {}",
        updated.getName(),
        updated.getId(),
        tenantId);
    return RelationshipTypeDto.Response.from(updated);
  }

  /** Deletes a relationship type by ID. */
  @Transactional
  public void delete(UUID id) {
    UUID tenantId = getCurrentTenantId();
    long deleted = repository.deleteByIdAndTenantId(id, tenantId);
    if (deleted == 0) {
      throw new ResourceNotFoundException("RelationshipType", id);
    }
    log.info("Deleted relationship type (id={}) for tenant {}", id, tenantId);
  }

  private String serializePropertiesSchema(Map<String, Object> propertiesSchema) {
    if (propertiesSchema != null && !propertiesSchema.isEmpty()) {
      try {
        return OBJECT_MAPPER.writeValueAsString(propertiesSchema);
      } catch (JsonProcessingException e) {
        log.warn("Failed to serialize propertiesSchema map", e);
      }
    }
    return "{}";
  }

  public UUID getCurrentTenantId() {
    try {
      String tenantIdStr = claimsExtractor.getCurrentTenantId();
      if (tenantIdStr != null && !tenantIdStr.isBlank()) {
        return UUID.fromString(tenantIdStr);
      }
    } catch (Exception ignored) {
      // Fall through to ThreadLocal or default tenant
    }

    if (TenantContext.hasTenant()) {
      try {
        return UUID.fromString(TenantContext.getTenantId());
      } catch (Exception ignored) {
        // Fall through
      }
    }

    return DEFAULT_SYSTEM_TENANT;
  }
}
