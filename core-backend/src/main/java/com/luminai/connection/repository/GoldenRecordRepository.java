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
          "SELECT * FROM golden_records g WHERE (:query IS NULL OR :query = '' OR LOWER(CAST(g.properties AS text)) LIKE LOWER(CONCAT('%', :query, '%'))) AND (:entityType IS NULL OR :entityType = '' OR :entityType = 'ALL' OR LOWER(COALESCE(NULLIF(g.properties ->> 'entity_type', ''), 'Person')) = LOWER(:entityType))",
      countQuery =
          "SELECT count(*) FROM golden_records g WHERE (:query IS NULL OR :query = '' OR LOWER(CAST(g.properties AS text)) LIKE LOWER(CONCAT('%', :query, '%'))) AND (:entityType IS NULL OR :entityType = '' OR :entityType = 'ALL' OR LOWER(COALESCE(NULLIF(g.properties ->> 'entity_type', ''), 'Person')) = LOWER(:entityType))",
      nativeQuery = true)
  Page<GoldenRecord> searchByPropertiesAndType(
      @Param("query") String query, @Param("entityType") String entityType, Pageable pageable);

  @Query(
      value =
          "SELECT COALESCE(NULLIF(g.properties ->> 'entity_type', ''), 'Person') as entityType, COUNT(*) as cnt FROM golden_records g GROUP BY COALESCE(NULLIF(g.properties ->> 'entity_type', ''), 'Person')",
      nativeQuery = true)
  List<Object[]> countByEntityType();
}
