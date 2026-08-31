package com.luminai.ontology.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luminai.common.exception.ConflictException;
import com.luminai.common.exception.ResourceNotFoundException;
import com.luminai.common.security.JwtClaimsExtractor;
import com.luminai.common.tenant.TenantContext;
import com.luminai.ontology.dto.OntologyVersionDto;
import com.luminai.ontology.model.EntityType;
import com.luminai.ontology.model.OntologyVersion;
import com.luminai.ontology.model.RelationshipType;
import com.luminai.ontology.repository.EntityTypeRepository;
import com.luminai.ontology.repository.OntologyVersionRepository;
import com.luminai.ontology.repository.RelationshipTypeRepository;
import java.time.Instant;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service managing Ontology Schema Versions, immutable release publishing, and diff computation.
 */
@Service
public class OntologyVersionService {

  private static final Logger log = LoggerFactory.getLogger(OntologyVersionService.class);
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final UUID DEFAULT_SYSTEM_TENANT =
      UUID.fromString("00000000-0000-0000-0000-000000000001");

  private final OntologyVersionRepository repository;
  private final EntityTypeRepository entityTypeRepository;
  private final RelationshipTypeRepository relationshipTypeRepository;
  private final JwtClaimsExtractor claimsExtractor;

  public OntologyVersionService(
      OntologyVersionRepository repository,
      EntityTypeRepository entityTypeRepository,
      RelationshipTypeRepository relationshipTypeRepository,
      JwtClaimsExtractor claimsExtractor) {
    this.repository = repository;
    this.entityTypeRepository = entityTypeRepository;
    this.relationshipTypeRepository = relationshipTypeRepository;
    this.claimsExtractor = claimsExtractor;
  }

  /** Lists all ontology versions defined for the current tenant. */
  @Transactional(readOnly = true)
  public List<OntologyVersionDto.Response> getAll() {
    UUID tenantId = getCurrentTenantId();
    return repository.findAllByTenantIdOrderByCreatedAtDesc(tenantId).stream()
        .map(OntologyVersionDto.Response::from)
        .toList();
  }

  /** Retrieves a specific ontology version by ID. */
  @Transactional(readOnly = true)
  public OntologyVersionDto.Response getById(UUID id) {
    UUID tenantId = getCurrentTenantId();
    OntologyVersion version =
        repository
            .findByIdAndTenantId(id, tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("OntologyVersion", id));
    return OntologyVersionDto.Response.from(version);
  }

  /** Publishes a new immutable snapshot of the active ontology schema. */
  @Transactional
  public OntologyVersionDto.Response publishVersion(OntologyVersionDto.CreateRequest request) {
    UUID tenantId = getCurrentTenantId();
    String versionTag = request.version().trim();

    if (repository.findByTenantIdAndVersion(tenantId, versionTag).isPresent()) {
      throw new ConflictException("Ontology version '" + versionTag + "' already exists");
    }

    List<EntityType> entityTypes = entityTypeRepository.findAllByTenantIdOrderByNameAsc(tenantId);
    List<RelationshipType> relTypes =
        relationshipTypeRepository.findAllByTenantIdOrderByNameAsc(tenantId);

    // Build immutable schema snapshot
    Map<String, Object> snapshot = new LinkedHashMap<>();
    snapshot.put("version", versionTag);
    snapshot.put("publishedAt", Instant.now().toString());

    List<Map<String, Object>> entitySnapshots = new ArrayList<>();
    for (EntityType et : entityTypes) {
      Map<String, Object> map = new LinkedHashMap<>();
      map.put("name", et.getName());
      map.put("label", et.getLabel());
      map.put("color", et.getColor());
      map.put("icon", et.getIcon());
      map.put("description", et.getDescription());
      map.put("propertiesSchema", et.getPropertiesSchema());
      entitySnapshots.add(map);
    }
    snapshot.put("entityTypes", entitySnapshots);

    List<Map<String, Object>> relSnapshots = new ArrayList<>();
    for (RelationshipType rt : relTypes) {
      Map<String, Object> map = new LinkedHashMap<>();
      map.put("name", rt.getName());
      map.put("description", rt.getDescription());
      map.put("sourceEntityTypeId", rt.getSourceEntityTypeId().toString());
      map.put("targetEntityTypeId", rt.getTargetEntityTypeId().toString());
      map.put("cardinality", rt.getCardinality().name());
      map.put("propertiesSchema", rt.getPropertiesSchema());
      relSnapshots.add(map);
    }
    snapshot.put("relationshipTypes", relSnapshots);

    String snapshotJson = "{}";
    try {
      snapshotJson = OBJECT_MAPPER.writeValueAsString(snapshot);
    } catch (Exception e) {
      log.error("Failed to serialize ontology schema snapshot", e);
    }

    UUID currentUserId = null;
    try {
      currentUserId = UUID.fromString(claimsExtractor.getCurrentUserId());
    } catch (Exception ignored) {
    }

    OntologyVersion newVersion =
        new OntologyVersion(
            tenantId,
            versionTag,
            OntologyVersion.Status.PUBLISHED,
            request.changelog(),
            currentUserId);
    newVersion.setSchemaSnapshot(snapshotJson);
    newVersion.setPublishedAt(Instant.now());

    OntologyVersion saved = repository.save(newVersion);

    // Link entity types and relationship types to this published version
    for (EntityType et : entityTypes) {
      et.setOntologyId(saved.getId());
      entityTypeRepository.save(et);
    }
    for (RelationshipType rt : relTypes) {
      rt.setOntologyId(saved.getId());
      relationshipTypeRepository.save(rt);
    }

    log.info(
        "Published ontology version '{}' (id={}) for tenant {}",
        saved.getVersion(),
        saved.getId(),
        tenantId);
    return OntologyVersionDto.Response.from(saved);
  }

  /** Computes schema diff between a specified version and its predecessor. */
  @Transactional(readOnly = true)
  public OntologyVersionDto.DiffResponse getVersionDiff(UUID id) {
    UUID tenantId = getCurrentTenantId();
    OntologyVersion current =
        repository
            .findByIdAndTenantId(id, tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("OntologyVersion", id));

    List<OntologyVersion> allVersions = repository.findAllByTenantIdOrderByCreatedAtDesc(tenantId);

    OntologyVersion previous = null;
    for (int i = 0; i < allVersions.size(); i++) {
      if (allVersions.get(i).getId().equals(current.getId()) && i + 1 < allVersions.size()) {
        previous = allVersions.get(i + 1);
        break;
      }
    }

    Set<String> currentEntities = extractEntityNames(current.getSchemaSnapshot());
    Set<String> previousEntities =
        previous != null
            ? extractEntityNames(previous.getSchemaSnapshot())
            : Collections.emptySet();

    Set<String> currentRels = extractRelationshipNames(current.getSchemaSnapshot());
    Set<String> previousRels =
        previous != null
            ? extractRelationshipNames(previous.getSchemaSnapshot())
            : Collections.emptySet();

    List<String> addedEntities = new ArrayList<>();
    List<String> removedEntities = new ArrayList<>();
    for (String e : currentEntities) {
      if (!previousEntities.contains(e)) {
        addedEntities.add(e);
      }
    }
    for (String e : previousEntities) {
      if (!currentEntities.contains(e)) {
        removedEntities.add(e);
      }
    }

    List<String> addedRels = new ArrayList<>();
    List<String> removedRels = new ArrayList<>();
    for (String r : currentRels) {
      if (!previousRels.contains(r)) {
        addedRels.add(r);
      }
    }
    for (String r : previousRels) {
      if (!currentRels.contains(r)) {
        removedRels.add(r);
      }
    }

    return new OntologyVersionDto.DiffResponse(
        current.getVersion(),
        previous != null ? previous.getVersion() : "none",
        addedEntities,
        Collections.emptyList(),
        removedEntities,
        addedRels,
        removedRels);
  }

  @SuppressWarnings("unchecked")
  private Set<String> extractEntityNames(String snapshotJson) {
    Set<String> names = new LinkedHashSet<>();
    if (snapshotJson == null || snapshotJson.isBlank()) {
      return names;
    }
    try {
      Map<String, Object> map =
          OBJECT_MAPPER.readValue(snapshotJson, new TypeReference<Map<String, Object>>() {});
      List<Map<String, Object>> entityTypes =
          (List<Map<String, Object>>) map.getOrDefault("entityTypes", Collections.emptyList());
      for (Map<String, Object> et : entityTypes) {
        Object name = et.get("name");
        if (name != null) {
          names.add(name.toString());
        }
      }
    } catch (Exception ignored) {
    }
    return names;
  }

  @SuppressWarnings("unchecked")
  private Set<String> extractRelationshipNames(String snapshotJson) {
    Set<String> names = new LinkedHashSet<>();
    if (snapshotJson == null || snapshotJson.isBlank()) {
      return names;
    }
    try {
      Map<String, Object> map =
          OBJECT_MAPPER.readValue(snapshotJson, new TypeReference<Map<String, Object>>() {});
      List<Map<String, Object>> relTypes =
          (List<Map<String, Object>>)
              map.getOrDefault("relationshipTypes", Collections.emptyList());
      for (Map<String, Object> rt : relTypes) {
        Object name = rt.get("name");
        if (name != null) {
          names.add(name.toString());
        }
      }
    } catch (Exception ignored) {
    }
    return names;
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
