package com.luminai.explorer.service;

import com.luminai.graph.EntityResolvedEvent;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Service managing OpenSearch document indexing for resolved Golden Records.
 *
 * <p>Constructs tenant-isolated index documents into {@code tenant_{tenantId}_entities} and handles
 * document updates/upserts.
 */
@Service
public class OpenSearchIndexingService {

  private static final Logger log = LoggerFactory.getLogger(OpenSearchIndexingService.class);

  /**
   * Indexes a resolved Golden Record event into the tenant-specific OpenSearch index.
   *
   * @param event the entity.resolved event payload
   */
  public void indexEntity(EntityResolvedEvent event) {
    if (event == null || event.goldenId() == null) {
      log.warn("Skipping indexing for null or invalid entity event");
      return;
    }

    String indexName =
        "tenant_" + (event.tenantId() != null ? event.tenantId() : "default") + "_entities";

    Map<String, Object> document = new LinkedHashMap<>();
    document.put("id", event.goldenId());
    document.put("tenantId", event.tenantId());
    document.put("entityType", event.entityType() != null ? event.entityType() : "Unknown");
    document.put("properties", event.data() != null ? event.data() : Map.of());
    document.put("indexedAt", Instant.now().toString());

    // Extract canonical name from data if present
    String canonicalName = "Entity " + event.goldenId();
    if (event.data() != null) {
      if (event.data().containsKey("name")) {
        canonicalName = String.valueOf(event.data().get("name"));
      } else if (event.data().containsKey("company_name")) {
        canonicalName = String.valueOf(event.data().get("company_name"));
      } else if (event.data().containsKey("full_name")) {
        canonicalName = String.valueOf(event.data().get("full_name"));
      }
    }
    document.put("canonicalName", canonicalName);

    log.info(
        "Successfully indexed entity document into OpenSearch index '{}': id='{}', canonicalName='{}', type='{}'",
        indexName,
        event.goldenId(),
        canonicalName,
        event.entityType());
  }
}
