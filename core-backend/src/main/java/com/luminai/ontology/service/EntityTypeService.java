package com.luminai.ontology.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luminai.common.exception.ConflictException;
import com.luminai.common.exception.ResourceNotFoundException;
import com.luminai.common.security.JwtClaimsExtractor;
import com.luminai.common.tenant.TenantContext;
import com.luminai.ontology.dto.EntityTypeDto;
import com.luminai.ontology.model.EntityType;
import com.luminai.ontology.repository.EntityTypeRepository;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service managing dynamic Ontology Entity Types.
 *
 * <p>Enforces multi-tenant isolation, unique entity type names, and JSON Schema serialization.
 */
@Service
public class EntityTypeService {

  private static final Logger log = LoggerFactory.getLogger(EntityTypeService.class);
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final UUID DEFAULT_SYSTEM_TENANT =
      UUID.fromString("00000000-0000-0000-0000-000000000001");

  private final EntityTypeRepository repository;
  private final JwtClaimsExtractor claimsExtractor;

  public EntityTypeService(EntityTypeRepository repository, JwtClaimsExtractor claimsExtractor) {
    this.repository = repository;
    this.claimsExtractor = claimsExtractor;
  }

  /** Lists all entity types defined for the current tenant. */
  @Transactional(readOnly = true)
  public List<EntityTypeDto.Response> getAll() {
    UUID tenantId = getCurrentTenantId();
    return repository.findAllByTenantIdOrderByNameAsc(tenantId).stream()
        .map(EntityTypeDto.Response::from)
        .toList();
  }

  /** Retrieves a specific entity type by ID. */
  @Transactional(readOnly = true)
  public EntityTypeDto.Response getById(UUID id) {
    UUID tenantId = getCurrentTenantId();
    EntityType entityType =
        repository
            .findByIdAndTenantId(id, tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("EntityType", id));
    return EntityTypeDto.Response.from(entityType);
  }

  /** Creates a new entity type definition. */
  @Transactional
  public EntityTypeDto.Response create(EntityTypeDto.CreateRequest request) {
    UUID tenantId = getCurrentTenantId();

    if (repository.existsByNameIgnoreCaseAndTenantId(request.name(), tenantId)) {
      throw new ConflictException(
          "Entity type with name '" + request.name() + "' already exists for this tenant");
    }

    String schemaJson = resolvePropertiesSchema(request.properties(), request.propertiesSchema());

    EntityType entityType =
        new EntityType(
            tenantId,
            null, // draft version
            request.name().trim(),
            request.label(),
            request.color(),
            request.icon(),
            request.description(),
            schemaJson);

    EntityType saved = repository.save(entityType);
    log.info(
        "Created entity type '{}' (id={}) for tenant {}", saved.getName(), saved.getId(), tenantId);
    return EntityTypeDto.Response.from(saved);
  }

  /** Updates an existing entity type definition. */
  @Transactional
  public EntityTypeDto.Response update(UUID id, EntityTypeDto.UpdateRequest request) {
    UUID tenantId = getCurrentTenantId();

    EntityType entityType =
        repository
            .findByIdAndTenantId(id, tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("EntityType", id));

    if (request.name() != null
        && !request.name().isBlank()
        && !request.name().equalsIgnoreCase(entityType.getName())) {
      if (repository.existsByNameIgnoreCaseAndTenantId(request.name().trim(), tenantId)) {
        throw new ConflictException(
            "Entity type with name '" + request.name() + "' already exists for this tenant");
      }
      entityType.setName(request.name().trim());
    }

    if (request.label() != null) {
      entityType.setLabel(request.label().trim());
    }
    if (request.color() != null) {
      entityType.setColor(request.color().trim());
    }
    if (request.icon() != null) {
      entityType.setIcon(request.icon().trim());
    }
    if (request.description() != null) {
      entityType.setDescription(request.description());
    }

    if (request.properties() != null || request.propertiesSchema() != null) {
      String schemaJson = resolvePropertiesSchema(request.properties(), request.propertiesSchema());
      entityType.setPropertiesSchema(schemaJson);
    }

    EntityType updated = repository.save(entityType);
    log.info(
        "Updated entity type '{}' (id={}) for tenant {}",
        updated.getName(),
        updated.getId(),
        tenantId);
    return EntityTypeDto.Response.from(updated);
  }

  /** Deletes an entity type definition by ID. */
  @Transactional
  public void delete(UUID id) {
    UUID tenantId = getCurrentTenantId();
    long deleted = repository.deleteByIdAndTenantId(id, tenantId);
    if (deleted == 0) {
      throw new ResourceNotFoundException("EntityType", id);
    }
    log.info("Deleted entity type (id={}) for tenant {}", id, tenantId);
  }

  /** Resolves properties schema from explicit map or structured property list. */
  private String resolvePropertiesSchema(
      List<EntityTypeDto.PropertyDefinition> properties, Map<String, Object> propertiesSchema) {
    if (propertiesSchema != null && !propertiesSchema.isEmpty()) {
      try {
        return OBJECT_MAPPER.writeValueAsString(propertiesSchema);
      } catch (JsonProcessingException e) {
        log.warn("Failed to serialize propertiesSchema map, falling back to empty object", e);
      }
    }

    if (properties != null && !properties.isEmpty()) {
      Map<String, Object> schema = new LinkedHashMap<>();
      schema.put("type", "object");

      Map<String, Object> propsMap = new LinkedHashMap<>();
      List<String> requiredList = new ArrayList<>();

      for (EntityTypeDto.PropertyDefinition prop : properties) {
        if (prop == null || prop.name() == null || prop.name().isBlank()) {
          continue;
        }
        Map<String, Object> fieldDef = new LinkedHashMap<>();
        fieldDef.put("type", prop.type() != null ? prop.type().toLowerCase() : "string");
        if (prop.description() != null) {
          fieldDef.put("description", prop.description());
        }
        if (prop.defaultValue() != null) {
          fieldDef.put("default", prop.defaultValue());
        }
        propsMap.put(prop.name().trim(), fieldDef);

        if (prop.required()) {
          requiredList.add(prop.name().trim());
        }
      }

      schema.put("properties", propsMap);
      if (!requiredList.isEmpty()) {
        schema.put("required", requiredList);
      }

      try {
        return OBJECT_MAPPER.writeValueAsString(schema);
      } catch (JsonProcessingException e) {
        log.warn("Failed to serialize constructed property schema", e);
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
