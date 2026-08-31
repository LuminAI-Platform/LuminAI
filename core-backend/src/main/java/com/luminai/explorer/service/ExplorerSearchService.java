package com.luminai.explorer.service;

import com.luminai.common.exception.ResourceNotFoundException;
import com.luminai.common.security.JwtClaimsExtractor;
import com.luminai.config.CacheConfig;
import com.luminai.connection.model.GoldenRecord;
import com.luminai.connection.model.ProvenanceEntry;
import com.luminai.connection.repository.GoldenRecordRepository;
import com.luminai.explorer.dto.EntityDetailDto;
import com.luminai.explorer.dto.ProvenanceItem;
import com.luminai.explorer.dto.SearchResponseDto;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service providing full-text search, facet aggregations, entity details, and provenance lineage.
 *
 * <p>Uses PostgreSQL Golden Records with multi-tenant isolation and Redis query caching.
 */
@Service
public class ExplorerSearchService {

  private static final Logger log = LoggerFactory.getLogger(ExplorerSearchService.class);
  private static final UUID DEFAULT_SYSTEM_TENANT =
      UUID.fromString("00000000-0000-0000-0000-000000000001");

  private final GoldenRecordRepository goldenRecordRepository;
  private final JwtClaimsExtractor claimsExtractor;

  public ExplorerSearchService(
      GoldenRecordRepository goldenRecordRepository, JwtClaimsExtractor claimsExtractor) {
    this.goldenRecordRepository = goldenRecordRepository;
    this.claimsExtractor = claimsExtractor;
  }

  /** Performs full-text search and facet aggregations across resolved golden records. */
  @Transactional(readOnly = true)
  @Cacheable(
      value = CacheConfig.CACHE_EXPLORER_SEARCH,
      key =
          "T(com.luminai.common.tenant.TenantContext).getTenantId() + ':' + #query + ':' + #entityType + ':' + #page + ':' + #size",
      unless = "#result == null")
  public SearchResponseDto.Response search(
      String query, String entityType, int page, int size, String sortBy, String sortDirection) {

    List<GoldenRecord> allRecords = goldenRecordRepository.findAll();

    // 1. Calculate dynamic facets across all records
    Map<String, Long> typeFacets = new LinkedHashMap<>();
    for (GoldenRecord gr : allRecords) {
      String type = extractEntityType(gr);
      typeFacets.put(type, typeFacets.getOrDefault(type, 0L) + 1);
    }

    // 2. Filter by query and entityType
    String qLower = (query != null) ? query.trim().toLowerCase() : "";
    String typeFilter =
        (entityType != null && !entityType.isBlank() && !"ALL".equalsIgnoreCase(entityType))
            ? entityType.trim()
            : null;

    List<SearchResponseDto.SearchItem> matchingItems = new ArrayList<>();

    for (GoldenRecord gr : allRecords) {
      String grType = extractEntityType(gr);
      if (typeFilter != null && !typeFilter.equalsIgnoreCase(grType)) {
        continue;
      }

      String canonicalName = extractCanonicalName(gr);
      Map<String, Object> props = gr.getProperties() != null ? gr.getProperties() : Map.of();

      boolean matches = true;
      Map<String, List<String>> highlights = new LinkedHashMap<>();

      if (!qLower.isEmpty()) {
        matches = false;
        if (canonicalName.toLowerCase().contains(qLower)) {
          matches = true;
          highlights.put("canonicalName", List.of(highlightMatch(canonicalName, qLower)));
        }

        for (Map.Entry<String, Object> entry : props.entrySet()) {
          if (entry.getValue() != null) {
            String valStr = entry.getValue().toString();
            if (valStr.toLowerCase().contains(qLower)) {
              matches = true;
              highlights.put(entry.getKey(), List.of(highlightMatch(valStr, qLower)));
            }
          }
        }
      }

      if (matches) {
        matchingItems.add(
            new SearchResponseDto.SearchItem(
                gr.getId(),
                canonicalName,
                grType,
                0.95, // confidence score
                gr.getSourceRecordIds() != null ? Math.max(1, gr.getSourceRecordIds().size()) : 1,
                props,
                gr.getCreatedAt(),
                gr.getUpdatedAt(),
                highlights.isEmpty() ? null : highlights));
      }
    }

    // 3. Sort
    if ("canonicalName".equalsIgnoreCase(sortBy)) {
      matchingItems.sort(
          "DESC".equalsIgnoreCase(sortDirection)
              ? Comparator.comparing(
                      SearchResponseDto.SearchItem::canonicalName, String.CASE_INSENSITIVE_ORDER)
                  .reversed()
              : Comparator.comparing(
                  SearchResponseDto.SearchItem::canonicalName, String.CASE_INSENSITIVE_ORDER));
    } else {
      matchingItems.sort(
          "ASC".equalsIgnoreCase(sortDirection)
              ? Comparator.comparing(
                  SearchResponseDto.SearchItem::createdAt,
                  Comparator.nullsLast(Comparator.naturalOrder()))
              : Comparator.comparing(
                      SearchResponseDto.SearchItem::createdAt,
                      Comparator.nullsLast(Comparator.naturalOrder()))
                  .reversed());
    }

    // 4. Paginate
    int total = matchingItems.size();
    int safePage = Math.max(0, page);
    int safeSize = (size > 0) ? Math.min(size, 100) : 20;
    int fromIndex = Math.min(safePage * safeSize, total);
    int toIndex = Math.min(fromIndex + safeSize, total);

    List<SearchResponseDto.SearchItem> pagedItems = matchingItems.subList(fromIndex, toIndex);

    Map<String, Map<String, Long>> facets = Map.of("entityTypes", typeFacets);

    return new SearchResponseDto.Response(pagedItems, total, safePage, safeSize, facets);
  }

  /** Retrieves full details of a specific Golden Record by ID. */
  @Transactional(readOnly = true)
  @Cacheable(
      value = CacheConfig.CACHE_EXPLORER_ENTITIES,
      key = "T(com.luminai.common.tenant.TenantContext).getTenantId() + ':' + #id",
      unless = "#result == null")
  public EntityDetailDto.Response getEntityById(UUID id) {
    GoldenRecord gr =
        goldenRecordRepository
            .findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Entity", id));

    String canonicalName = extractCanonicalName(gr);
    String entityType = extractEntityType(gr);

    List<ProvenanceItem> provenanceItems = new ArrayList<>();
    if (gr.getProvenance() != null) {
      for (ProvenanceEntry pe : gr.getProvenance()) {
        Object val = gr.getProperties() != null ? gr.getProperties().get(pe.getFieldName()) : null;
        provenanceItems.add(
            new ProvenanceItem(
                pe.getFieldName(),
                pe.getSourceRecordId(),
                "Raw Connector",
                val,
                pe.getAction(),
                pe.getOccurredAt()));
      }
    }

    return new EntityDetailDto.Response(
        gr.getId() != null ? gr.getId() : id,
        canonicalName,
        entityType,
        0.95,
        gr.getSourceRecordIds() != null ? Math.max(1, gr.getSourceRecordIds().size()) : 1,
        gr.getProperties() != null ? gr.getProperties() : Map.of(),
        gr.getCreatedAt(),
        gr.getUpdatedAt(),
        gr.getSourceRecordIds(),
        provenanceItems);
  }

  /** Retrieves field-level provenance lineage for an entity. */
  @Transactional(readOnly = true)
  public List<ProvenanceItem> getProvenance(UUID id, String propertyName) {
    EntityDetailDto.Response entity = getEntityById(id);
    if (entity.provenance() == null || entity.provenance().isEmpty()) {
      return Collections.emptyList();
    }

    if (propertyName != null && !propertyName.isBlank()) {
      return entity.provenance().stream()
          .filter(p -> propertyName.equalsIgnoreCase(p.fieldName()))
          .toList();
    }

    return entity.provenance();
  }

  private String extractCanonicalName(GoldenRecord gr) {
    if (gr.getProperties() != null) {
      Map<String, Object> props = gr.getProperties();
      if (props.containsKey("canonical_name")) return String.valueOf(props.get("canonical_name"));
      if (props.containsKey("name")) return String.valueOf(props.get("name"));
      if (props.containsKey("company_name")) return String.valueOf(props.get("company_name"));
      if (props.containsKey("full_name")) return String.valueOf(props.get("full_name"));
      if (props.containsKey("title")) return String.valueOf(props.get("title"));
    }
    return "Entity " + (gr.getId() != null ? gr.getId().toString().substring(0, 8) : "00000000");
  }

  private String extractEntityType(GoldenRecord gr) {
    if (gr.getProperties() != null && gr.getProperties().containsKey("entity_type")) {
      return String.valueOf(gr.getProperties().get("entity_type"));
    }
    return "Person";
  }

  private String highlightMatch(String text, String query) {
    int idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx < 0) return text;
    int end = idx + query.length();
    return text.substring(0, idx)
        + "<em>"
        + text.substring(idx, end)
        + "</em>"
        + text.substring(end);
  }
}
