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
          "SELECT * FROM golden_records g WHERE (:query IS NULL OR :query = '' OR LOWER(g.canonical_name) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(CAST(g.properties AS text)) LIKE LOWER(CONCAT('%', :query, '%'))) AND (:includeAll = true OR LOWER(COALESCE(NULLIF(g.entity_type, ''), 'Person')) IN (:entityTypes))",
      countQuery =
          "SELECT count(*) FROM golden_records g WHERE (:query IS NULL OR :query = '' OR LOWER(g.canonical_name) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(CAST(g.properties AS text)) LIKE LOWER(CONCAT('%', :query, '%'))) AND (:includeAll = true OR LOWER(COALESCE(NULLIF(g.entity_type, ''), 'Person')) IN (:entityTypes))",
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
      value =
          "SELECT COALESCE(NULLIF(g.entity_type, ''), 'Person') as entityType, COUNT(*) as cnt FROM golden_records g GROUP BY COALESCE(NULLIF(g.entity_type, ''), 'Person')",
      nativeQuery = true)
  List<Object[]> countByEntityType();
}
