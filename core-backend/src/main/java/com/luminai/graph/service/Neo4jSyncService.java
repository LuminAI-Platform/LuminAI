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

    String canonicalName = resolveCanonicalName(event);
    repository.mergeEntityNode(
        event.tenantId(), event.goldenId(), canonicalName, event.entityType());
    log.info(
        "Synced :Entity node id={} tenant={} type={} canonical_name='{}'",
        event.goldenId(),
        event.tenantId(),
        event.entityType(),
        canonicalName);

    List<RelationshipRef> relationships = extractRelationships(event);
    if (relationships.isEmpty()) {
      log.debug(
          "No relationship data present on entity.resolved event for id={} tenant={} — node-only sync",
          event.goldenId(),
          event.tenantId());
      return;
    }

    for (RelationshipRef rel : relationships) {
      boolean created =
          repository.mergeRelationship(
              event.tenantId(), event.goldenId(), rel.targetId(), rel.type(), rel.direction());
      if (created) {
        log.info(
            "Synced relationship {} -[{}]-> {} for tenant {}",
            event.goldenId(),
            rel.type(),
            rel.targetId(),
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

  private String resolveCanonicalName(EntityResolvedEvent event) {
    Map<String, Object> data = event.data() != null ? event.data() : Map.of();

    Object canonicalName = data.get("canonical_name");
    if (canonicalName instanceof String s && !s.isBlank()) {
      return s;
    }

    Object name = data.get("name");
    if (name instanceof String s && !s.isBlank()) {
      return s;
    }

    log.debug(
        "No canonical_name/name attribute on golden record {} — falling back to golden_id",
        event.goldenId());
    return event.goldenId();
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

      refs.add(new RelationshipRef(targetId.toString(), type.toString(), direction.toString()));
    }
    return refs;
  }

  private record RelationshipRef(String targetId, String type, String direction) {}
}
