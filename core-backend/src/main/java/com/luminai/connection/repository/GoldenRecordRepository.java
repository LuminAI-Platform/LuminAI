package com.luminai.connection.repository;

import com.luminai.connection.model.GoldenRecord;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

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
          "SELECT * FROM golden_records g WHERE (:query IS NULL OR :query = '' OR LOWER(g.canonical_name) LIKE LOWER(CONCAT('%', CAST(:query AS text), '%')) OR LOWER(CAST(g.properties AS text)) LIKE LOWER(CONCAT('%', CAST(:query AS text), '%'))) AND (:includeAll = true OR LOWER(COALESCE(NULLIF(g.entity_type, ''), 'Entity')) IN (:entityTypes))",
      countQuery =
          "SELECT count(*) FROM golden_records g WHERE (:query IS NULL OR :query = '' OR LOWER(g.canonical_name) LIKE LOWER(CONCAT('%', CAST(:query AS text), '%')) OR LOWER(CAST(g.properties AS text)) LIKE LOWER(CONCAT('%', CAST(:query AS text), '%'))) AND (:includeAll = true OR LOWER(COALESCE(NULLIF(g.entity_type, ''), 'Entity')) IN (:entityTypes))",
      nativeQuery = true)
  Page<GoldenRecord> searchByPropertiesAndTypes(
      @Param("query") String query,
      @Param("includeAll") boolean includeAll,
      @Param("entityTypes") List<String> entityTypes,
      Pageable pageable);

  default Page<GoldenRecord> searchByPropertiesAndType(
      String query, String entityType, Pageable pageable) {
    String safeQuery = query != null ? query.trim() : "";
    if (entityType == null || entityType.isBlank() || "ALL".equalsIgnoreCase(entityType.trim())) {
      return searchByPropertiesAndTypes(safeQuery, true, List.of(""), pageable);
    }
    List<String> types =
        java.util.Arrays.stream(entityType.split(","))
            .map(String::trim)
            .filter(s -> !s.isBlank() && !"ALL".equalsIgnoreCase(s))
            .map(String::toLowerCase)
            .toList();
    if (types.isEmpty()) {
      return searchByPropertiesAndTypes(safeQuery, true, List.of(""), pageable);
    }
    return searchByPropertiesAndTypes(safeQuery, false, types, pageable);
  }

  @Query(
      value =
          "SELECT COALESCE(NULLIF(g.entity_type, ''), 'Entity') as entityType, COUNT(*) as cnt FROM golden_records g GROUP BY COALESCE(NULLIF(g.entity_type, ''), 'Entity')",
      nativeQuery = true)
  List<Object[]> countByEntityType();

  @Query(
      value =
          "SELECT "
              + "COUNT(*) AS total_count, "
              + "COALESCE(SUM(CASE WHEN COALESCE(g.confidence_score, 1.0) < 0.5 THEN 1 ELSE 0 END), 0) AS q_low, "
              + "COALESCE(SUM(CASE WHEN COALESCE(g.confidence_score, 1.0) >= 0.5 AND COALESCE(g.confidence_score, 1.0) < 0.7 THEN 1 ELSE 0 END), 0) AS q_fair, "
              + "COALESCE(SUM(CASE WHEN COALESCE(g.confidence_score, 1.0) >= 0.7 AND COALESCE(g.confidence_score, 1.0) < 0.85 THEN 1 ELSE 0 END), 0) AS q_moderate, "
              + "COALESCE(SUM(CASE WHEN COALESCE(g.confidence_score, 1.0) >= 0.85 AND COALESCE(g.confidence_score, 1.0) < 0.95 THEN 1 ELSE 0 END), 0) AS q_good, "
              + "COALESCE(SUM(CASE WHEN COALESCE(g.confidence_score, 1.0) >= 0.95 THEN 1 ELSE 0 END), 0) AS q_excellent, "
              + "COALESCE(SUM(CASE WHEN COALESCE(g.source_count, 1) <= 1 THEN 1 ELSE 0 END), 0) AS src_one, "
              + "COALESCE(SUM(CASE WHEN COALESCE(g.source_count, 1) = 2 THEN 1 ELSE 0 END), 0) AS src_two, "
              + "COALESCE(SUM(CASE WHEN COALESCE(g.source_count, 1) >= 3 THEN 1 ELSE 0 END), 0) AS src_three_plus "
              + "FROM golden_records g",
      nativeQuery = true)
  List<Object[]> aggregateDistributionStats();

  long countByCreatedAtBefore(java.time.Instant before);

  @Query("select g.createdAt from GoldenRecord g where g.createdAt >= :start")
  List<java.time.Instant> findCreatedAtSince(@Param("start") java.time.Instant start);

  @Query(
      value =
          "SELECT * FROM golden_records WHERE tenant_id = :tenantId AND properties->>'_connection_id' = :connectionId",
      nativeQuery = true)
  List<GoldenRecord> findByTenantIdAndConnectionId(
      @Param("tenantId") UUID tenantId, @Param("connectionId") String connectionId);

  @Modifying
  @Transactional
  @Query(
      value =
          "DELETE FROM golden_records WHERE tenant_id = :tenantId AND properties->>'_connection_id' = :connectionId",
      nativeQuery = true)
  int deleteByTenantIdAndConnectionId(
      @Param("tenantId") UUID tenantId, @Param("connectionId") String connectionId);

  @Modifying
  @Transactional
  @Query(
      value =
          "UPDATE golden_records SET entity_type = :entityType WHERE tenant_id = :tenantId AND properties->>'_connection_id' = :connectionId",
      nativeQuery = true)
  int updateEntityTypeByConnectionId(
      @Param("tenantId") UUID tenantId,
      @Param("connectionId") String connectionId,
      @Param("entityType") String entityType);
}
