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
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service providing full-teoxt search, facet aggregations, entity details, and provenance lineage.
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
          "T(com.luminai.common.tenant.TenantContext).getTenantSlug() + ':' + #query + ':' + #entityType + ':' + #duplicates + ':' + #missing + ':' + #review + ':' + #page + ':' + #size + ':' + #sortBy + ':' + #sortDirection",
      unless = "#result == null")
  public SearchResponseDto.Response search(
      String query,
      String entityType,
      Boolean duplicates,
      Boolean missing,
      Boolean review,
      int page,
      int size,
      String sortBy,
      String sortDirection) {

    // 1. Calculate dynamic facets across all records using database-level GROUP BY where possible
    Map<String, Long> typeFacets = new LinkedHashMap<>();
    try {
      List<Object[]> facetCounts = goldenRecordRepository.countByEntityType();
      if (facetCounts != null && !facetCounts.isEmpty()) {
        for (Object[] row : facetCounts) {
          if (row != null && row.length >= 2 && row[0] != null && row[1] != null) {
            typeFacets.put(String.valueOf(row[0]), ((Number) row[1]).longValue());
          }
        }
      }
    } catch (Exception e) {
      log.debug(
          "Database facet grouping unavailable, falling back to memory derivation: {}",
          e.getMessage());
    }

    int safePage = Math.max(0, page);
    int safeSize = (size > 0) ? Math.min(size, 100) : 20;

    // Parse structured field:value queries & insight tokens (e.g. "email:john@acme.com",
    // "duplicates:true")
    Map<String, String> fieldFilters = new HashMap<>();
    String cleanQuery = query != null ? query.trim() : "";
    Boolean effectiveDuplicates = duplicates;
    Boolean effectiveMissing = missing;
    Boolean effectiveReview = review;

    if (cleanQuery.contains(":")) {
      java.util.regex.Matcher m =
          java.util.regex.Pattern.compile("(\\w+):(\"[^\"]+\"|\\S+)").matcher(cleanQuery);
      StringBuffer sb = new StringBuffer();
      while (m.find()) {
        String fName = m.group(1).toLowerCase();
        String fVal = m.group(2).replaceAll("^\"|\"$", "");
        if ("duplicates".equals(fName) && "true".equalsIgnoreCase(fVal)) {
          effectiveDuplicates = Boolean.TRUE;
        } else if ("missing".equals(fName) && "true".equalsIgnoreCase(fVal)) {
          effectiveMissing = Boolean.TRUE;
        } else if ("review".equals(fName) && "true".equalsIgnoreCase(fVal)) {
          effectiveReview = Boolean.TRUE;
        } else {
          fieldFilters.put(fName, fVal.toLowerCase());
        }
        m.appendReplacement(sb, "");
      }
      m.appendTail(sb);
      cleanQuery = sb.toString().trim();
    }

    boolean hasAdvancedFilters =
        effectiveDuplicates != null
            || effectiveMissing != null
            || effectiveReview != null
            || !fieldFilters.isEmpty();

    // Push down paginated search to PostgreSQL database if no custom in-memory filters required
    Page<GoldenRecord> dbPage = null;
    boolean includeAllTypes =
        entityType == null || entityType.isBlank() || "ALL".equalsIgnoreCase(entityType.trim());
    List<String> entityTypes =
        includeAllTypes
            ? List.of("")
            : Arrays.stream(entityType.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank() && !"ALL".equalsIgnoreCase(s))
                .map(String::toLowerCase)
                .toList();
    if (entityTypes.isEmpty()) {
      includeAllTypes = true;
      entityTypes = List.of("");
    }
    String fieldKey = fieldFilters.keySet().stream().findFirst().orElse(null);
    String fieldVal = fieldKey == null ? null : fieldFilters.get(fieldKey);
    try {
      org.springframework.data.domain.Sort sort;
      if ("canonicalName".equalsIgnoreCase(sortBy)) {
        sort =
            org.springframework.data.domain.Sort.by(
                "DESC".equalsIgnoreCase(sortDirection)
                    ? org.springframework.data.domain.Sort.Direction.DESC
                    : org.springframework.data.domain.Sort.Direction.ASC,
                "canonical_name");
      } else if ("confidenceScore".equalsIgnoreCase(sortBy)
          || "confidence_score".equalsIgnoreCase(sortBy)) {
        sort =
            org.springframework.data.domain.Sort.by(
                "ASC".equalsIgnoreCase(sortDirection)
                    ? org.springframework.data.domain.Sort.Direction.ASC
                    : org.springframework.data.domain.Sort.Direction.DESC,
                "confidence_score");
      } else {
        sort =
            org.springframework.data.domain.Sort.by(
                "ASC".equalsIgnoreCase(sortDirection)
                    ? org.springframework.data.domain.Sort.Direction.ASC
                    : org.springframework.data.domain.Sort.Direction.DESC,
                "created_at");
      }
      org.springframework.data.domain.Pageable pageable =
          org.springframework.data.domain.PageRequest.of(safePage, safeSize, sort);
      dbPage =
          goldenRecordRepository.searchWithFilters(
              (!cleanQuery.isBlank()) ? cleanQuery : null,
              includeAllTypes,
              entityTypes,
              effectiveDuplicates,
              effectiveMissing,
              effectiveReview,
              fieldKey,
              fieldVal,
              pageable);
    } catch (Exception e) {
      log.error("Database search failed; refusing to scan all golden records", e);
      throw new IllegalStateException("Could not execute filtered entity search", e);
    }

    if (dbPage != null) {
      List<SearchResponseDto.SearchItem> items = new ArrayList<>();
      String qLower = cleanQuery.toLowerCase();
      for (GoldenRecord gr : dbPage.getContent()) {
        String grType = extractEntityType(gr);
        String canonicalName = extractCanonicalName(gr);
        Map<String, Object> props = gr.getProperties() != null ? gr.getProperties() : Map.of();
        Map<String, List<String>> highlights = new LinkedHashMap<>();
        if (!qLower.isEmpty()) {
          if (canonicalName.toLowerCase().contains(qLower)) {
            highlights.put("canonicalName", List.of(highlightMatch(canonicalName, qLower)));
          }
          for (Map.Entry<String, Object> entry : props.entrySet()) {
            if (entry.getValue() != null) {
              String valStr = entry.getValue().toString();
              if (valStr.toLowerCase().contains(qLower)) {
                highlights.put(entry.getKey(), List.of(highlightMatch(valStr, qLower)));
              }
            }
          }
        }
        double conf = gr.getConfidenceScore() != null ? gr.getConfidenceScore().doubleValue() : 1.0;
        int sources =
            gr.getSourceRecordIds() != null ? Math.max(1, gr.getSourceRecordIds().size()) : 1;
        Double comp = null;
        Double qual = null;
        boolean isDup = conf < 0.85;

        items.add(
            new SearchResponseDto.SearchItem(
                gr.getId(),
                canonicalName,
                grType,
                conf,
                sources,
                props,
                gr.getCreatedAt(),
                gr.getUpdatedAt(),
                highlights.isEmpty() ? null : highlights,
                comp,
                qual,
                isDup,
                List.of()));
      }
      Map<String, Map<String, Long>> facets = Map.of("entityTypes", typeFacets);
      return new SearchResponseDto.Response(
          items, dbPage.getTotalElements(), safePage, safeSize, facets, null);
    }

    List<GoldenRecord> allRecords = goldenRecordRepository.findAll();

    // Fallback: derive facets in memory if database grouping returned empty
    if (typeFacets.isEmpty()) {
      for (GoldenRecord gr : allRecords) {
        String type = extractEntityType(gr);
        typeFacets.put(type, typeFacets.getOrDefault(type, 0L) + 1);
      }
    }

    String qLower = cleanQuery.toLowerCase();
    Set<String> allowedTypes = null;
    if (entityType != null && !entityType.isBlank() && !"ALL".equalsIgnoreCase(entityType.trim())) {
      allowedTypes = new HashSet<>();
      for (String t : entityType.split(",")) {
        String trimmed = t.trim();
        if (!trimmed.isEmpty() && !"ALL".equalsIgnoreCase(trimmed)) {
          allowedTypes.add(trimmed.toLowerCase());
        }
      }
      if (allowedTypes.isEmpty()) {
        allowedTypes = null;
      }
    }

    List<SearchResponseDto.SearchItem> matchingItems = new ArrayList<>();

    for (GoldenRecord gr : allRecords) {
      String grType = extractEntityType(gr);
      if (allowedTypes != null && !allowedTypes.contains(grType.toLowerCase())) {
        continue;
      }

      String canonicalName = extractCanonicalName(gr);
      Map<String, Object> props = gr.getProperties() != null ? gr.getProperties() : Map.of();

      double conf = gr.getConfidenceScore() != null ? gr.getConfidenceScore().doubleValue() : 1.0;
      int sources =
          gr.getSourceRecordIds() != null ? Math.max(1, gr.getSourceRecordIds().size()) : 1;
      Double comp = null;
      Double qual = null;
      boolean isDup = conf < 0.85;
      boolean hasMissing =
          props.values().stream().anyMatch(v -> v == null || v.toString().isBlank());
      boolean needsReview = conf < 0.85;

      // Apply insight filters
      if (Boolean.TRUE.equals(effectiveDuplicates) && !isDup) {
        continue;
      }
      if (Boolean.TRUE.equals(effectiveMissing) && !hasMissing) {
        continue;
      }
      if (Boolean.TRUE.equals(effectiveReview) && !needsReview) {
        continue;
      }

      // Apply structured field:value filters
      boolean fieldMatches = true;
      if (!fieldFilters.isEmpty()) {
        for (Map.Entry<String, String> ff : fieldFilters.entrySet()) {
          Object pVal = props.get(ff.getKey());
          if (pVal == null || !pVal.toString().toLowerCase().contains(ff.getValue())) {
            fieldMatches = false;
            break;
          }
        }
      }
      if (!fieldMatches) {
        continue;
      }

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
                conf,
                sources,
                props,
                gr.getCreatedAt(),
                gr.getUpdatedAt(),
                highlights.isEmpty() ? null : highlights,
                comp,
                qual,
                isDup,
                List.of()));
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
    } else if ("confidenceScore".equalsIgnoreCase(sortBy)
        || "confidence_score".equalsIgnoreCase(sortBy)) {
      matchingItems.sort(
          "ASC".equalsIgnoreCase(sortDirection)
              ? Comparator.comparingDouble(SearchResponseDto.SearchItem::confidenceScore)
              : Comparator.comparingDouble(SearchResponseDto.SearchItem::confidenceScore)
                  .reversed());
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
    int fromIndex = Math.min(safePage * safeSize, total);
    int toIndex = Math.min(fromIndex + safeSize, total);

    List<SearchResponseDto.SearchItem> pagedItems = matchingItems.subList(fromIndex, toIndex);

    Map<String, Map<String, Long>> facets = Map.of("entityTypes", typeFacets);

    SearchResponseDto.InsightsDto insights =
        new SearchResponseDto.InsightsDto(
            matchingItems.stream().filter(SearchResponseDto.SearchItem::possibleDuplicate).count(),
            matchingItems.stream()
                .filter(
                    i ->
                        i.properties().values().stream()
                            .anyMatch(v -> v == null || v.toString().isBlank()))
                .count(),
            matchingItems.stream().filter(i -> i.confidenceScore() < 0.85).count());
    return new SearchResponseDto.Response(pagedItems, total, safePage, safeSize, facets, insights);
  }

  /** Retrieves full details of a specific Golden Record by ID. */
  @Transactional(readOnly = true)
  @Cacheable(
      value = CacheConfig.CACHE_EXPLORER_ENTITIES,
      key = "T(com.luminai.common.tenant.TenantContext).getTenantSlug() + ':' + #id",
      unless = "#result == null")
  public EntityDetailDto.Response getEntityById(UUID id) {
    GoldenRecord gr =
        goldenRecordRepository
            .findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Entity", id));

    String canonicalName = extractCanonicalName(gr);
    String entityType = extractEntityType(gr);

    double entityConfidence =
        gr.getConfidenceScore() != null ? gr.getConfidenceScore().doubleValue() : 1.0;

    List<ProvenanceItem> provenanceItems = new ArrayList<>();
    if (gr.getProvenance() != null) {
      String provConfidence =
          (entityConfidence >= 0.85) ? "high" : (entityConfidence >= 0.65) ? "medium" : "low";
      for (ProvenanceEntry pe : gr.getProvenance()) {
        Object val = gr.getProperties() != null ? gr.getProperties().get(pe.getFieldName()) : null;
        provenanceItems.add(
            new ProvenanceItem(
                pe.getFieldName(),
                pe.getSourceRecordId(),
                null,
                val,
                pe.getAction(),
                pe.getOccurredAt(),
                provConfidence));
      }
    }

    int sources = gr.getSourceRecordIds() != null ? Math.max(1, gr.getSourceRecordIds().size()) : 1;
    Map<String, Object> props = gr.getProperties() != null ? gr.getProperties() : Map.of();
    Double comp = null;
    Double qual = null;
    boolean isDup = entityConfidence < 0.85;

    return new EntityDetailDto.Response(
        gr.getId() != null ? gr.getId() : id,
        canonicalName,
        entityType,
        entityConfidence,
        sources,
        props,
        gr.getCreatedAt(),
        gr.getUpdatedAt(),
        gr.getSourceRecordIds(),
        provenanceItems,
        comp,
        qual,
        isDup,
        List.of());
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
    if (gr.getCanonicalName() != null
        && !gr.getCanonicalName().isBlank()
        && !"Unnamed Entity".equals(gr.getCanonicalName())) {
      return gr.getCanonicalName();
    }
    if (gr.getProperties() != null) {
      Map<String, Object> props = gr.getProperties();
      if (props.containsKey("canonical_name")) return String.valueOf(props.get("canonical_name"));
      if (props.containsKey("name")) return String.valueOf(props.get("name"));
      if (props.containsKey("company_name")) return String.valueOf(props.get("company_name"));
      if (props.containsKey("full_name")) return String.valueOf(props.get("full_name"));
      if (props.containsKey("title")) return String.valueOf(props.get("title"));
    }
    if (gr.getCanonicalName() != null && !gr.getCanonicalName().isBlank()) {
      return gr.getCanonicalName();
    }
    return "Entity " + (gr.getId() != null ? gr.getId().toString().substring(0, 8) : "00000000");
  }

  private String extractEntityType(GoldenRecord gr) {
    if (gr.getEntityType() != null
        && !gr.getEntityType().isBlank()
        && !"Entity".equals(gr.getEntityType())) {
      return gr.getEntityType();
    }
    if (gr.getProperties() != null && gr.getProperties().containsKey("entity_type")) {
      return String.valueOf(gr.getProperties().get("entity_type"));
    }
    if (gr.getEntityType() != null && !gr.getEntityType().isBlank()) {
      return gr.getEntityType();
    }
    return "Entity";
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

  /** Streams canonical golden records matching filters as an RFC-4180 CSV file. */
  @Transactional(readOnly = true)
  public void exportCsv(String query, String entityType, java.io.Writer writer)
      throws java.io.IOException {
    org.springframework.data.domain.Page<GoldenRecord> page =
        goldenRecordRepository.searchByPropertiesAndType(
            (query != null && !query.isBlank()) ? query.trim() : null,
            (entityType != null
                    && !entityType.isBlank()
                    && !"ALL".equalsIgnoreCase(entityType.trim()))
                ? entityType.trim()
                : null,
            org.springframework.data.domain.PageRequest.of(
                0,
                5000,
                org.springframework.data.domain.Sort.by(
                    org.springframework.data.domain.Sort.Direction.DESC, "created_at")));

    List<GoldenRecord> records = page.getContent();
    Set<String> propertyKeys = new LinkedHashSet<>();
    for (GoldenRecord gr : records) {
      if (gr.getProperties() != null) {
        propertyKeys.addAll(gr.getProperties().keySet());
      }
    }

    List<String> headers = new ArrayList<>();
    headers.add("id");
    headers.add("canonical_name");
    headers.add("entity_type");
    headers.add("confidence_score");
    headers.add("source_count");
    headers.add("created_at");
    headers.addAll(propertyKeys);

    writer.write(String.join(",", headers) + "\r\n");

    for (GoldenRecord gr : records) {
      List<String> row = new ArrayList<>();
      row.add(escapeCsv(gr.getId() != null ? gr.getId().toString() : ""));
      row.add(escapeCsv(gr.getCanonicalName()));
      row.add(escapeCsv(gr.getEntityType()));
      row.add(
          escapeCsv(
              gr.getConfidenceScore() != null ? gr.getConfidenceScore().toString() : "1.0000"));
      row.add(String.valueOf(gr.getSourceCount()));
      row.add(escapeCsv(gr.getCreatedAt() != null ? gr.getCreatedAt().toString() : ""));

      Map<String, Object> props = gr.getProperties();
      for (String k : propertyKeys) {
        Object v = props != null ? props.get(k) : null;
        row.add(escapeCsv(v != null ? v.toString() : ""));
      }
      writer.write(String.join(",", row) + "\r\n");
    }
    writer.flush();
  }

  private String escapeCsv(String val) {
    if (val == null) return "";
    if (val.contains(",") || val.contains("\"") || val.contains("\n") || val.contains("\r")) {
      return "\"" + val.replace("\"", "\"\"") + "\"";
    }
    return val;
  }
}
