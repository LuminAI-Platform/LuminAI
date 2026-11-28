package com.luminai.graph.service;

import com.luminai.graph.EntityResolvedEvent;
import com.luminai.graph.repository.Neo4jGraphRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Coordinates synchronizing a resolved Golden Record into the Neo4j {@code :Entity} graph.
 *
 * <p><strong>Node sync</strong> always runs: {@code golden_id} → {@code id}, {@code entity_type},
 * and {@code tenant_id} come straight from the event; {@code canonical_name} isn't a field the
 * producer emits, so it's derived from the event's free-form {@code data} map with a fallback chain
 * ({@code data.canonical_name} → {@code data.name} → {@code golden_id}).
 *
 * <p><strong>Relationship sync</strong> is additive and defensive, not a real field on the event
 * today (see {@link EntityResolvedEvent}). An optional {@code data.relationships} array is
 * supported — each entry expected to carry {@code target_id}/{@code targetId}, {@code type}, and an
 * optional {@code direction} — and synced verbatim if present. If absent, which is the case for
 * every event the producer emits today, this is a no-op: no relationship type or semantics are
 * invented here.
 */
@Service
public class Neo4jSyncService {

  private static final Logger log = LoggerFactory.getLogger(Neo4jSyncService.class);

  private final Neo4jGraphRepository repository;

  public Neo4jSyncService(Neo4jGraphRepository repository) {
    this.repository = repository;
  }

  public void sync(EntityResolvedEvent event) {
    validate(event);

    String normalizedId = Neo4jGraphRepository.normalizeEntityId(event.goldenId());
    String canonicalName = resolveCanonicalName(event, normalizedId);
    repository.ensureEntityTypeIndexes(event.entityType());
    repository.mergeEntityNode(event.tenantId(), normalizedId, canonicalName, event.entityType());
    Map<String, Object> safeProperties = extractScalarProperties(event.data());
    if (!safeProperties.isEmpty()) {
      repository.mergeEntityProperties(event.tenantId(), normalizedId, safeProperties);
    }
    log.info(
        "Synced :Entity node id={} tenant={} type={} canonical_name='{}'",
        normalizedId,
        event.tenantId(),
        event.entityType(),
        canonicalName);

    List<RelationshipRef> relationships = extractRelationships(event);
    if (relationships.isEmpty()) {
      log.debug(
          "No relationship data present on entity.resolved event for id={} tenant={} — node-only sync",
          normalizedId,
          event.tenantId());
      return;
    }

    for (RelationshipRef rel : relationships) {
      String targetId = Neo4jGraphRepository.normalizeEntityId(rel.targetId());
      boolean created =
          repository.mergeRelationship(
              event.tenantId(), normalizedId, targetId, rel.type(), rel.direction());
      if (!created && rel.targetType() != null && !rel.targetType().isBlank()) {
        repository.ensureEntityTypeIndexes(rel.targetType());
        String targetLabel =
            rel.targetLabel() != null && !rel.targetLabel().isBlank()
                ? rel.targetLabel()
                : targetId;
        repository.mergeEntityNode(event.tenantId(), targetId, targetLabel, rel.targetType());
        created =
            repository.mergeRelationship(
                event.tenantId(), normalizedId, targetId, rel.type(), rel.direction());
      }
      if (created) {
        log.info(
            "Synced relationship {} -[{}]-> {} for tenant {}",
            normalizedId,
            rel.type(),
            targetId,
            event.tenantId());
      }
    }
  }

  private void validate(EntityResolvedEvent event) {
    if (event.tenantId() == null || event.tenantId().isBlank()) {
      throw new IllegalArgumentException("entity.resolved event is missing tenant_id");
    }
    if (event.goldenId() == null || event.goldenId().isBlank()) {
      throw new IllegalArgumentException("entity.resolved event is missing golden_id");
    }
    if (event.entityType() == null || event.entityType().isBlank()) {
      throw new IllegalArgumentException("entity.resolved event is missing entity_type");
    }
  }

  private String resolveCanonicalName(EntityResolvedEvent event, String fallbackId) {
    Map<String, Object> data = event.data() != null ? event.data() : Map.of();

    for (String key :
        List.of(
            "canonical_name",
            "canonicalName",
            "name",
            "full_name",
            "company_name",
            "customer_name",
            "client_name",
            "patient_name",
            "title",
            "label")) {
      Object val = data.get(key);
      if (val instanceof String s && !s.isBlank() && !"null".equalsIgnoreCase(s.trim())) {
        return s.trim();
      }
    }

    log.debug(
        "No canonical_name/name attribute on golden record {} — falling back to id", fallbackId);
    return fallbackId;
  }

  private Map<String, Object> extractScalarProperties(Map<String, Object> data) {
    if (data == null || data.isEmpty()) {
      return Map.of();
    }
    java.util.Set<String> excluded =
        java.util.Set.of(
            "id",
            "golden_id",
            "tenant_id",
            "canonical_name",
            "canonicalName",
            "entity_type",
            "entityType",
            "relationships",
            "source_record_ids",
            "raw_golden_id");
    Map<String, Object> props = new java.util.LinkedHashMap<>();
    for (Map.Entry<String, Object> entry : data.entrySet()) {
      String key = entry.getKey();
      Object val = entry.getValue();
      if (key == null || key.startsWith("_") || excluded.contains(key) || val == null) {
        continue;
      }
      if (val instanceof String s && !s.isBlank()) {
        props.put(key, s);
      } else if (val instanceof Number || val instanceof Boolean) {
        props.put(key, val);
      }
    }
    return props;
  }

  @SuppressWarnings("unchecked")
  private List<RelationshipRef> extractRelationships(EntityResolvedEvent event) {
    Map<String, Object> data = event.data();
    if (data == null) {
      return List.of();
    }

    Object raw = data.get("relationships");
    if (!(raw instanceof List<?> rawList)) {
      return List.of();
    }

    List<RelationshipRef> refs = new ArrayList<>();
    for (Object item : rawList) {
      if (!(item instanceof Map<?, ?> map)) {
        log.warn(
            "Skipping malformed relationship entry (not an object) on entity.resolved event for id={}",
            event.goldenId());
        continue;
      }

      Object targetId = map.get("target_id") != null ? map.get("target_id") : map.get("targetId");
      Object type = map.get("type");
      Object direction = map.get("direction");
      if (direction == null) {
        direction = "OUTGOING";
      }

      if (targetId == null || type == null) {
        log.warn(
            "Skipping malformed relationship entry (missing target_id/type) on entity.resolved "
                + "event for id={}: {}",
            event.goldenId(),
            map);
        continue;
      }

      String targetType =
          map.get("target_type") != null
              ? String.valueOf(map.get("target_type"))
              : (map.get("targetType") != null ? String.valueOf(map.get("targetType")) : null);
      String targetLabel =
          map.get("target_name") != null
              ? String.valueOf(map.get("target_name"))
              : (map.get("targetLabel") != null ? String.valueOf(map.get("targetLabel")) : null);
      refs.add(
          new RelationshipRef(
              targetId.toString(), type.toString(), direction.toString(), targetType, targetLabel));
    }
    return refs;
  }

  private record RelationshipRef(
      String targetId, String type, String direction, String targetType, String targetLabel) {}
}
