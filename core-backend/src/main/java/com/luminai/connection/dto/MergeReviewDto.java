package com.luminai.connection.dto;

import com.luminai.connection.model.ErCandidate.CandidateStatus;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Request/response payloads for the manual merge review API.
 *
 * <p>Grouped as nested types on a single class, following the project's existing DTO convention
 * (see {@code SchemaMappingDto}). No JPA entity is exposed directly.
 */
public class MergeReviewDto {

  private MergeReviewDto() {}

  /**
   * Frontend-facing view of an ER candidate.
   *
   * <p>Used by both the list endpoint ({@code comparisonDetails} omitted to keep pages light) and
   * the detail endpoint (fully populated).
   */
  public record CandidateResponse(
      UUID candidateId,
      UUID goldenRecordId,
      RecordSnapshot recordA,
      RecordSnapshot recordB,
      double similarityScore,
      String matchRationale,
      Map<String, Object> comparisonDetails,
      CandidateStatus status,
      Instant reviewedAt,
      String reviewedBy) {}

  /** Snapshot of one side of a candidate comparison. */
  public record RecordSnapshot(UUID recordId, Map<String, Object> properties) {}

  /** Request body for {@code POST /api/v1/er/golden-records/{id}/split}. */
  public record SplitRequest(@NotNull UUID sourceRecordIdToExtract) {}

  /** Frontend-facing view of a Golden Record. */
  public record GoldenRecordResponse(
      UUID id, Set<UUID> sourceRecordIds, Map<String, Object> properties, long version) {}

  /** Result of a split: the original (now-reduced) cluster and the newly extracted record. */
  public record SplitResponse(GoldenRecordResponse original, GoldenRecordResponse extracted) {}
}
