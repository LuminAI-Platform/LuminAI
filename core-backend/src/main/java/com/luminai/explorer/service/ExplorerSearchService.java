package com.luminai.explorer.service;

import com.luminai.common.exception.ResourceNotFoundException;
import com.luminai.common.security.JwtClaimsExtractor;
import com.luminai.config.CacheConfig;
import com.luminai.connection.model.Connection;
import com.luminai.connection.model.GoldenRecord;
import com.luminai.connection.model.ProvenanceEntry;
import com.luminai.connection.repository.ConnectionRepository;
import com.luminai.connection.repository.GoldenRecordRepository;
import com.luminai.explorer.dto.EntityDetailDto;
import com.luminai.explorer.dto.ExplorerStatsDto;
import com.luminai.explorer.dto.MatchReasonDto;
import com.luminai.explorer.dto.ProvenanceItem;
import com.luminai.explorer.dto.SearchResponseDto;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;

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

  @Autowired(required = false)
  private ConnectionRepository connectionRepository;

  @Autowired
  public ExplorerSearchService(
      GoldenRecordRepository goldenRecordRepository, JwtClaimsExtractor claimsExtractor) {
    this.goldenRecordRepository = goldenRecordRepository;
    this.claimsExtractor = claimsExtractor;
  }

  public void setConnectionRepository(ConnectionRepository connectionRepository) {
    this.connectionRepository = connectionRepository;
  }

  /** Performs full-text search and facet aggregations without insight flags. */
  @Transactional(readOnly = true)
  @Cacheable(
      value = CacheConfig.CACHE_EXPLORER_SEARCH,
      key =
          "T(com.luminai.common.tenant.TenantContext).getTenantSlug() + ':' + #query + ':' + #entityType + ':null:null:null:' + #page + ':' + #size + ':' + #sortBy + ':' + #sortDirection",
      unless = "#result == null")
  public SearchResponseDto.Response search(
      String query, String entityType, int page, int size, String sortBy, String sortDirection) {
    return executeSearch(query, entityType, null, null, null, page, size, sortBy, sortDirection);
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
    return executeSearch(
        query, entityType, duplicates, missing, review, page, size, sortBy, sortDirection);
  }

  private SearchResponseDto.Response executeSearch(
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
    } catch (RuntimeException e) {
      if (TransactionSynchronizationManager.isActualTransactionActive()) {
        log.warn("Database facet grouping failed inside active transaction: {}", e.getMessage());
        throw e;
      }
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
    if (!hasAdvancedFilters) {
      try {
        Sort sort = resolveDbSort(sortBy, sortDirection);
        Pageable pageable = PageRequest.of(safePage, safeSize, sort);
        dbPage =
            goldenRecordRepository.searchByPropertiesAndType(
                cleanQuery,
                (entityType != null
                        && !entityType.isBlank()
                        && !"ALL".equalsIgnoreCase(entityType.trim()))
                    ? entityType.trim()
                    : null,
                pageable);
      } catch (RuntimeException e) {
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
          log.warn("Database pushdown search failed inside active transaction: {}", e.getMessage());
          throw e;
        }
        log.debug(
            "Database pushdown search unavailable, falling back to repository scanning: {}",
            e.getMessage());
      }
    }

    if (dbPage != null) {
      List<SearchResponseDto.SearchItem> items = new ArrayList<>();
      Map<String, Long> sourceFacets = new LinkedHashMap<>();
      String qLower = cleanQuery.toLowerCase();
      for (GoldenRecord gr : dbPage.getContent()) {
        RecordMetrics metrics = computeMetrics(gr);
        SearchResponseDto.SearchItem item = toSearchItem(gr, qLower, metrics, true);
        items.add(item);
        for (String src : item.sourceSystems()) {
          sourceFacets.put(src, sourceFacets.getOrDefault(src, 0L) + 1);
        }
      }
      Map<String, Map<String, Long>> facets = new LinkedHashMap<>();
      facets.put("entityTypes", typeFacets);
      if (!sourceFacets.isEmpty()) {
        facets.put("sourceSystems", sourceFacets);
      }
      return new SearchResponseDto.Response(
          items, (int) dbPage.getTotalElements(), safePage, safeSize, facets);
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
    Set<String> allowedTypes = parseAllowedTypes(entityType);
    List<SearchResponseDto.SearchItem> matchingItems = new ArrayList<>();

    for (GoldenRecord gr : allRecords) {
      String grType = extractEntityType(gr);
      if (allowedTypes != null && !allowedTypes.contains(grType.toLowerCase())) {
        continue;
      }

      RecordMetrics metrics = computeMetrics(gr);
      boolean hasMissing =
          metrics.completeness() < 80.0
              || metrics.props().values().stream()
                  .anyMatch(v -> v == null || v.toString().isBlank());
      boolean needsReview = metrics.quality() < 85.0 || metrics.confidence() < 0.85;

      if (Boolean.TRUE.equals(effectiveDuplicates) && !metrics.possibleDuplicate()) {
        continue;
      }
      if (Boolean.TRUE.equals(effectiveMissing) && !hasMissing) {
        continue;
      }
      if (Boolean.TRUE.equals(effectiveReview) && !needsReview) {
        continue;
      }

      if (!matchesFieldFilters(metrics.props(), fieldFilters)) {
        continue;
      }

      SearchResponseDto.SearchItem item = toSearchItem(gr, qLower, metrics, false);
      if (qLower.isEmpty() || item.highlights() != null) {
        matchingItems.add(item);
      }
    }

    sortItems(matchingItems, sortBy, sortDirection);

    int total = matchingItems.size();
    int fromIndex = Math.min(safePage * safeSize, total);
    int toIndex = Math.min(fromIndex + safeSize, total);

    List<SearchResponseDto.SearchItem> pagedItems =
        new ArrayList<>(matchingItems.subList(fromIndex, toIndex));

    Map<String, Long> sourceFacets = new LinkedHashMap<>();
    for (SearchResponseDto.SearchItem item : matchingItems) {
      if (item.sourceSystems() != null) {
        for (String src : item.sourceSystems()) {
          sourceFacets.put(src, sourceFacets.getOrDefault(src, 0L) + 1);
        }
      }
    }
    Map<String, Map<String, Long>> facets = new LinkedHashMap<>();
    facets.put("entityTypes", typeFacets);
    if (!sourceFacets.isEmpty()) {
      facets.put("sourceSystems", sourceFacets);
    }

    return new SearchResponseDto.Response(pagedItems, total, safePage, safeSize, facets);
  }

  private Sort resolveDbSort(String sortBy, String sortDirection) {
    if ("canonicalName".equalsIgnoreCase(sortBy)) {
      return Sort.by(
          "DESC".equalsIgnoreCase(sortDirection) ? Sort.Direction.DESC : Sort.Direction.ASC,
          "canonical_name");
    }
    if ("confidenceScore".equalsIgnoreCase(sortBy) || "confidence_score".equalsIgnoreCase(sortBy)) {
      return Sort.by(
          "ASC".equalsIgnoreCase(sortDirection) ? Sort.Direction.ASC : Sort.Direction.DESC,
          "confidence_score");
    }
    return Sort.by(
        "ASC".equalsIgnoreCase(sortDirection) ? Sort.Direction.ASC : Sort.Direction.DESC,
        "created_at");
  }

  private Set<String> parseAllowedTypes(String entityType) {
    if (entityType == null || entityType.isBlank() || "ALL".equalsIgnoreCase(entityType.trim())) {
      return null;
    }
    Set<String> allowedTypes = new HashSet<>();
    for (String t : entityType.split(",")) {
      String trimmed = t.trim();
      if (!trimmed.isEmpty() && !"ALL".equalsIgnoreCase(trimmed)) {
        allowedTypes.add(trimmed.toLowerCase());
      }
    }
    return allowedTypes.isEmpty() ? null : allowedTypes;
  }

  private boolean matchesFieldFilters(Map<String, Object> props, Map<String, String> fieldFilters) {
    if (fieldFilters.isEmpty()) {
      return true;
    }
    for (Map.Entry<String, String> ff : fieldFilters.entrySet()) {
      Object pVal = props.get(ff.getKey());
      if (pVal == null || !pVal.toString().toLowerCase().contains(ff.getValue())) {
        return false;
      }
    }
    return true;
  }

  private void sortItems(
      List<SearchResponseDto.SearchItem> items, String sortBy, String sortDirection) {
    if ("canonicalName".equalsIgnoreCase(sortBy)) {
      Comparator<SearchResponseDto.SearchItem> cmp =
          Comparator.comparing(
              SearchResponseDto.SearchItem::canonicalName,
              Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
      items.sort("DESC".equalsIgnoreCase(sortDirection) ? cmp.reversed() : cmp);
    } else if ("confidenceScore".equalsIgnoreCase(sortBy)
        || "confidence_score".equalsIgnoreCase(sortBy)) {
      Comparator<SearchResponseDto.SearchItem> cmp =
          Comparator.comparingDouble(SearchResponseDto.SearchItem::confidenceScore);
      items.sort("ASC".equalsIgnoreCase(sortDirection) ? cmp : cmp.reversed());
    } else {
      Comparator<SearchResponseDto.SearchItem> cmp =
          Comparator.comparing(
              SearchResponseDto.SearchItem::createdAt,
              Comparator.nullsLast(Comparator.naturalOrder()));
      items.sort("ASC".equalsIgnoreCase(sortDirection) ? cmp : cmp.reversed());
    }
  }

  private RecordMetrics computeMetrics(GoldenRecord gr) {
    Map<String, Object> rawProps = gr.getProperties() != null ? gr.getProperties() : Map.of();
    Map<String, Object> displayProps = new LinkedHashMap<>();
    for (Map.Entry<String, Object> entry : rawProps.entrySet()) {
      String key = entry.getKey();
      if (key != null && !key.startsWith("_")) {
        displayProps.put(key, entry.getValue());
      }
    }

    double conf = gr.getConfidenceScore() != null ? gr.getConfidenceScore().doubleValue() : 1.0;
    int sourceIdsSize = gr.getSourceRecordIds() != null ? gr.getSourceRecordIds().size() : 0;
    int metaSourceIdsSize = 0;
    if (rawProps.get("_source_record_ids") instanceof Collection<?> col) {
      metaSourceIdsSize = col.size();
    }
    int sources =
        Math.max(1, Math.max(gr.getSourceCount(), Math.max(sourceIdsSize, metaSourceIdsSize)));
    double comp = Math.min(100.0, 60.0 + (displayProps.size() * 8.0));
    double qual;
    if (rawProps.get("_quality_score") instanceof Number qn) {
      double qv = qn.doubleValue();
      qual = qv <= 1.0 ? qv * 100.0 : qv;
    } else {
      qual = conf <= 1.0 ? conf * 100.0 : conf;
    }
    boolean isDup = conf < 0.85 || sources > 1;
    List<String> sourceSystems = extractSourceSystems(gr, rawProps);
    return new RecordMetrics(displayProps, conf, sources, comp, qual, isDup, sourceSystems);
  }

  private List<String> extractSourceSystems(GoldenRecord gr, Map<String, Object> rawProps) {
    Set<String> sources = new LinkedHashSet<>();
    if (rawProps != null) {
      Object srcList = rawProps.get("_source_systems");
      if (srcList instanceof Collection<?> col) {
        for (Object item : col) {
          if (item != null && !String.valueOf(item).isBlank()) {
            sources.add(String.valueOf(item).trim());
          }
        }
      }
      for (String key :
          List.of("_source_name", "_connection_name", "source_name", "source_system", "_table")) {
        Object val = rawProps.get(key);
        if (val != null) {
          String s = String.valueOf(val).trim();
          if (!s.isEmpty() && !"null".equalsIgnoreCase(s)) {
            sources.add(s);
          }
        }
      }
      if (sources.isEmpty()
          && rawProps.get("_connection_id") != null
          && connectionRepository != null) {
        try {
          UUID connId = UUID.fromString(String.valueOf(rawProps.get("_connection_id")).trim());
          Optional<Connection> connOpt =
              gr.getTenantId() != null
                  ? connectionRepository.findByIdAndTenantId(connId, gr.getTenantId())
                  : connectionRepository.findById(connId);
          connOpt
              .map(Connection::getName)
              .filter(n -> n != null && !n.isBlank())
              .ifPresent(sources::add);
        } catch (Exception ignored) {
        }
      }
    }
    return new ArrayList<>(sources);
  }

  private SearchResponseDto.SearchItem toSearchItem(
      GoldenRecord gr, String qLower, RecordMetrics metrics, boolean alwaysInclude) {
    String grType = extractEntityType(gr);
    String canonicalName = extractCanonicalName(gr);
    Map<String, List<String>> highlights = new LinkedHashMap<>();

    if (!qLower.isEmpty()) {
      if (canonicalName.toLowerCase().contains(qLower)) {
        highlights.put("canonicalName", List.of(highlightMatch(canonicalName, qLower)));
      }
      for (Map.Entry<String, Object> entry : metrics.props().entrySet()) {
        if (entry.getValue() != null) {
          String valStr = entry.getValue().toString();
          if (valStr.toLowerCase().contains(qLower)) {
            highlights.put(entry.getKey(), List.of(highlightMatch(valStr, qLower)));
          }
        }
      }
    }

    if (!alwaysInclude && !qLower.isEmpty() && highlights.isEmpty()) {
      return new SearchResponseDto.SearchItem(
          gr.getId(),
          canonicalName,
          grType,
          metrics.confidence(),
          metrics.sources(),
          metrics.props(),
          gr.getCreatedAt(),
          gr.getUpdatedAt(),
          null,
          metrics.completeness(),
          metrics.quality(),
          metrics.possibleDuplicate(),
          List.of(),
          metrics.sourceSystems());
    }

    return new SearchResponseDto.SearchItem(
        gr.getId(),
        canonicalName,
        grType,
        metrics.confidence(),
        metrics.sources(),
        metrics.props(),
        gr.getCreatedAt(),
        gr.getUpdatedAt(),
        highlights.isEmpty() ? null : highlights,
        metrics.completeness(),
        metrics.quality(),
        metrics.possibleDuplicate(),
        buildMatchReasons(gr, metrics.confidence(), metrics.sources()),
        metrics.sourceSystems());
  }

  private record RecordMetrics(
      Map<String, Object> props,
      double confidence,
      int sources,
      double completeness,
      double quality,
      boolean possibleDuplicate,
      List<String> sourceSystems) {}

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
    RecordMetrics metrics = computeMetrics(gr);
    String resolvedSourceName =
        metrics.sourceSystems().isEmpty() ? null : metrics.sourceSystems().get(0);

    double entityConfidence =
        gr.getConfidenceScore() != null ? gr.getConfidenceScore().doubleValue() : 1.0;

    List<ProvenanceItem> provenanceItems = new ArrayList<>();
    if (gr.getProvenance() != null) {
      String provConfidence =
          (entityConfidence >= 0.85) ? "high" : (entityConfidence >= 0.65) ? "medium" : "low";
      for (ProvenanceEntry pe : gr.getProvenance()) {
        Object val = pe.getFieldName() != null ? metrics.props().get(pe.getFieldName()) : null;
        provenanceItems.add(
            new ProvenanceItem(
                pe.getFieldName(),
                pe.getSourceRecordId(),
                resolvedSourceName,
                val,
                pe.getAction(),
                pe.getOccurredAt(),
                provConfidence));
      }
    }

    Set<UUID> sourceRecordIds =
        gr.getSourceRecordIds() != null
            ? new LinkedHashSet<>(gr.getSourceRecordIds())
            : new LinkedHashSet<>();

    return new EntityDetailDto.Response(
        gr.getId() != null ? gr.getId() : id,
        canonicalName,
        entityType,
        entityConfidence,
        metrics.sources(),
        metrics.props(),
        gr.getCreatedAt(),
        gr.getUpdatedAt(),
        sourceRecordIds,
        provenanceItems,
        metrics.completeness(),
        metrics.quality(),
        metrics.possibleDuplicate(),
        buildMatchReasons(gr, entityConfidence, metrics.sources()));
  }

  private List<MatchReasonDto> buildMatchReasons(
      GoldenRecord gr, double confidence, int sourceCount) {
    List<MatchReasonDto> reasons = new ArrayList<>();
    if (gr.getProvenance() != null && !gr.getProvenance().isEmpty()) {
      Set<String> seenFields = new LinkedHashSet<>();
      for (ProvenanceEntry pe : gr.getProvenance()) {
        if (pe.getFieldName() != null && seenFields.add(pe.getFieldName())) {
          reasons.add(
              new MatchReasonDto(
                  pe.getFieldName(),
                  pe.getAction() != null ? pe.getAction() : "Entity Resolution",
                  confidence,
                  "Matched via " + pe.getFieldName()));
          if (reasons.size() >= 4) break;
        }
      }
    }
    if (reasons.isEmpty() && sourceCount > 1) {
      reasons.add(
          new MatchReasonDto(
              "canonicalName",
              "Entity Resolution",
              confidence,
              "Merged from " + sourceCount + " source records"));
    }
    return reasons;
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
    String propName =
        firstNonBlankProperty(
            gr.getProperties(), "canonical_name", "name", "company_name", "full_name", "title");
    if (propName != null) {
      return propName;
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
    String propType = firstNonBlankProperty(gr.getProperties(), "entity_type");
    if (propType != null) {
      return propType;
    }
    if (gr.getEntityType() != null && !gr.getEntityType().isBlank()) {
      return gr.getEntityType();
    }
    return "Entity";
  }

  private String firstNonBlankProperty(Map<String, Object> props, String... keys) {
    if (props == null) {
      return null;
    }
    for (String key : keys) {
      Object val = props.get(key);
      if (val != null) {
        String str = String.valueOf(val).trim();
        if (!str.isEmpty()) {
          return str;
        }
      }
    }
    return null;
  }

  private String highlightMatch(String text, String query) {
    int idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx < 0) return text;
    int end = Math.min(text.length(), idx + query.length());
    return text.substring(0, idx)
        + "<em>"
        + text.substring(idx, end)
        + "</em>"
        + text.substring(end);
  }

  /**
   * Computes tenant-scoped Explorer aggregate metrics for charts (entity types, quality histogram,
   * source counts).
   */
  @Transactional(readOnly = true)
  public ExplorerStatsDto getStats() {
    Map<String, Long> entityTypeCounts = new LinkedHashMap<>();
    List<Object[]> typeRows = goldenRecordRepository.countByEntityType();
    if (typeRows != null) {
      typeRows.stream()
          .filter(r -> r != null && r.length >= 2 && r[0] != null && r[1] != null)
          .sorted((a, b) -> Long.compare(((Number) b[1]).longValue(), ((Number) a[1]).longValue()))
          .forEach(r -> entityTypeCounts.put(String.valueOf(r[0]), ((Number) r[1]).longValue()));
    }

    long total = entityTypeCounts.values().stream().mapToLong(Long::longValue).sum();
    long qLow = 0;
    long qFair = 0;
    long qModerate = 0;
    long qGood = 0;
    long qExcellent = 0;
    long srcOne = 0;
    long srcTwo = 0;
    long srcThreePlus = 0;

    List<Object[]> aggRows = goldenRecordRepository.aggregateDistributionStats();
    if (aggRows != null
        && !aggRows.isEmpty()
        && aggRows.get(0) != null
        && aggRows.get(0).length >= 9) {
      Object[] row = aggRows.get(0);
      total = toLong(row[0]);
      qLow = toLong(row[1]);
      qFair = toLong(row[2]);
      qModerate = toLong(row[3]);
      qGood = toLong(row[4]);
      qExcellent = toLong(row[5]);
      srcOne = toLong(row[6]);
      srcTwo = toLong(row[7]);
      srcThreePlus = toLong(row[8]);
    }

    List<ExplorerStatsDto.HistogramBucket> qualityDistribution =
        List.of(
            new ExplorerStatsDto.HistogramBucket("< 50%", 0.0, 50.0, qLow),
            new ExplorerStatsDto.HistogramBucket("50-69%", 50.0, 70.0, qFair),
            new ExplorerStatsDto.HistogramBucket("70-84%", 70.0, 85.0, qModerate),
            new ExplorerStatsDto.HistogramBucket("85-94%", 85.0, 95.0, qGood),
            new ExplorerStatsDto.HistogramBucket("95-100%", 95.0, 100.0, qExcellent));

    Map<String, Long> sourceCountDistribution = new LinkedHashMap<>();
    sourceCountDistribution.put("1 source", srcOne);
    sourceCountDistribution.put("2 sources", srcTwo);
    sourceCountDistribution.put("3+ sources", srcThreePlus);

    return new ExplorerStatsDto(
        total, entityTypeCounts, qualityDistribution, sourceCountDistribution);
  }

  private long toLong(Object val) {
    return val instanceof Number n ? n.longValue() : 0L;
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
        for (String key : gr.getProperties().keySet()) {
          if (key != null && !key.startsWith("_")) {
            propertyKeys.add(key);
          }
        }
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
