package com.luminai.explorer.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class SearchResponseDto {

  private SearchResponseDto() {}

  public record InsightsDto(long possibleDuplicates, long missingValues, long needsReview) {}

  @JsonInclude(JsonInclude.Include.NON_NULL)
  public record SearchItem(
      UUID id,
      String canonicalName,
      String entityType,
      double confidenceScore,
      int sourceCount,
      Map<String, Object> properties,
      Instant createdAt,
      Instant updatedAt,
      Map<String, List<String>> highlights,
      Double completenessScore,
      Double qualityScore,
      boolean possibleDuplicate,
      List<String> matchReasons) {}

  @JsonInclude(JsonInclude.Include.NON_NULL)
  public record Response(
      List<SearchItem> items,
      long total,
      int page,
      int size,
      Map<String, Map<String, Long>> facets,
      InsightsDto insights) {}
}
