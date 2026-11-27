package com.luminai.connection.repository;

import com.luminai.connection.model.GoldenRecord;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/**
 * Access to {@link GoldenRecord}. Supports paginated searching, property filtering, and facet
 * aggregations.
 *
 * <p>Under this project's schema-per-tenant multi-tenancy, queries execute within the tenant's
 * schema context.
 */
@Repository
public interface GoldenRecordRepository extends JpaRepository<GoldenRecord, UUID> {

  @Query(
      value =
          "SELECT * FROM golden_records g WHERE (:query IS NULL OR :query = '' OR LOWER(g.canonical_name) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(CAST(g.properties AS text)) LIKE LOWER(CONCAT('%', :query, '%'))) AND (:includeAll = true OR LOWER(COALESCE(NULLIF(g.entity_type, ''), 'Entity')) IN (:entityTypes))",
      countQuery =
          "SELECT count(*) FROM golden_records g WHERE (:query IS NULL OR :query = '' OR LOWER(g.canonical_name) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(CAST(g.properties AS text)) LIKE LOWER(CONCAT('%', :query, '%'))) AND (:includeAll = true OR LOWER(COALESCE(NULLIF(g.entity_type, ''), 'Entity')) IN (:entityTypes))",
      nativeQuery = true)
  Page<GoldenRecord> searchByPropertiesAndTypes(
      @Param("query") String query,
      @Param("includeAll") boolean includeAll,
      @Param("entityTypes") List<String> entityTypes,
      Pageable pageable);

  default Page<GoldenRecord> searchByPropertiesAndType(
      String query, String entityType, Pageable pageable) {
    if (entityType == null || entityType.isBlank() || "ALL".equalsIgnoreCase(entityType.trim())) {
      return searchByPropertiesAndTypes(query, true, List.of(""), pageable);
    }
    List<String> types =
        java.util.Arrays.stream(entityType.split(","))
            .map(String::trim)
            .filter(s -> !s.isBlank() && !"ALL".equalsIgnoreCase(s))
            .map(String::toLowerCase)
            .toList();
    if (types.isEmpty()) {
      return searchByPropertiesAndTypes(query, true, List.of(""), pageable);
    }
    return searchByPropertiesAndTypes(query, false, types, pageable);
  }

  @Query(
      value = """
          SELECT * FROM golden_records g
          WHERE (:query IS NULL OR :query = '' OR LOWER(g.canonical_name) LIKE LOWER(CONCAT('%', :query, '%'))
                 OR LOWER(CAST(g.properties AS text)) LIKE LOWER(CONCAT('%', :query, '%')))
            AND (:includeAll = true OR LOWER(COALESCE(NULLIF(g.entity_type, ''), 'Entity')) IN (:entityTypes))
            AND (:duplicates IS NULL OR (:duplicates = true AND g.confidence_score < 0.85) OR (:duplicates = false AND g.confidence_score >= 0.85))
            AND (:missing IS NULL OR (EXISTS (SELECT 1 FROM jsonb_each_text(CAST(g.properties AS jsonb)) p WHERE p.value IN ('', 'null')) = :missing))
            AND (:review IS NULL OR :review = false OR g.confidence_score < 0.85)
            AND (:fieldKey IS NULL OR LOWER(CAST(g.properties AS jsonb)->>:fieldKey) LIKE LOWER(CONCAT('%', :fieldVal, '%')))
          """,
      countQuery = """
          SELECT count(*) FROM golden_records g
          WHERE (:query IS NULL OR :query = '' OR LOWER(g.canonical_name) LIKE LOWER(CONCAT('%', :query, '%'))
                 OR LOWER(CAST(g.properties AS text)) LIKE LOWER(CONCAT('%', :query, '%')))
            AND (:includeAll = true OR LOWER(COALESCE(NULLIF(g.entity_type, ''), 'Entity')) IN (:entityTypes))
            AND (:duplicates IS NULL OR (:duplicates = true AND g.confidence_score < 0.85) OR (:duplicates = false AND g.confidence_score >= 0.85))
            AND (:missing IS NULL OR (EXISTS (SELECT 1 FROM jsonb_each_text(CAST(g.properties AS jsonb)) p WHERE p.value IN ('', 'null')) = :missing))
            AND (:review IS NULL OR :review = false OR g.confidence_score < 0.85)
            AND (:fieldKey IS NULL OR LOWER(CAST(g.properties AS jsonb)->>:fieldKey) LIKE LOWER(CONCAT('%', :fieldVal, '%')))
          """,
      nativeQuery = true)
  Page<GoldenRecord> searchWithFilters(
      @Param("query") String query,
      @Param("includeAll") boolean includeAll,
      @Param("entityTypes") List<String> entityTypes,
      @Param("duplicates") Boolean duplicates,
      @Param("missing") Boolean missing,
      @Param("review") Boolean review,
      @Param("fieldKey") String fieldKey,
      @Param("fieldVal") String fieldVal,
      Pageable pageable);

  @Query(value = """
      SELECT
        count(*) FILTER (WHERE COALESCE(LOWER(CAST(g.properties AS jsonb) ->> 'possibleDuplicate'), 'false') = 'true'),
        count(*) FILTER (WHERE EXISTS (SELECT 1 FROM jsonb_each_text(CAST(g.properties AS jsonb)) p WHERE p.value IN ('', 'null'))),
        count(*) FILTER (WHERE COALESCE(g.confidence_score, 1) < 0.85)
      FROM golden_records g
      WHERE (:query IS NULL OR :query = '' OR LOWER(g.canonical_name) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(CAST(g.properties AS text)) LIKE LOWER(CONCAT('%', :query, '%')))
        AND (:includeAll = true OR LOWER(COALESCE(NULLIF(g.entity_type, ''), 'Entity')) IN (:entityTypes))
        AND (:duplicates IS NULL OR COALESCE(LOWER(CAST(g.properties AS jsonb) ->> 'possibleDuplicate'), 'false') = CAST(:duplicates AS text))
        AND (:missing IS NULL OR EXISTS (SELECT 1 FROM jsonb_each_text(CAST(g.properties AS jsonb)) p WHERE p.value IN ('', 'null')) = :missing)
        AND (:review IS NULL OR (COALESCE(g.confidence_score, 1) < 0.85) = :review)
        AND NOT EXISTS (SELECT 1 FROM jsonb_each_text(CAST(:fieldFilters AS jsonb)) f WHERE LOWER(COALESCE(CAST(g.properties AS jsonb) ->> f.key, '')) NOT LIKE CONCAT('%', LOWER(f.value), '%'))
      """, nativeQuery = true)
  List<Object[]> countInsights(
      @Param("query") String query,
      @Param("includeAll") boolean includeAll,
      @Param("entityTypes") List<String> entityTypes,
      @Param("duplicates") Boolean duplicates,
      @Param("missing") Boolean missing,
      @Param("review") Boolean review,
      @Param("fieldFilters") String fieldFilters);

  @Query(
      value =
          "SELECT COALESCE(NULLIF(g.entity_type, ''), 'Entity') as entityType, COUNT(*) as cnt FROM golden_records g GROUP BY COALESCE(NULLIF(g.entity_type, ''), 'Entity')",
      nativeQuery = true)
  List<Object[]> countByEntityType();
}
