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
      double completenessScore,
      double qualityScore,
      boolean possibleDuplicate,
      List<String> matchReasons,
      List<String> sourceSystems) {

    public SearchItem(
        UUID id,
        String canonicalName,
        String entityType,
        double confidenceScore,
        int sourceCount,
        Map<String, Object> properties,
        Instant createdAt,
        Instant updatedAt,
        Map<String, List<String>> highlights) {
      this(
          id,
          canonicalName,
          entityType,
          confidenceScore,
          sourceCount,
          properties,
          createdAt,
          updatedAt,
          highlights,
          Math.min(100.0, 75.0 + (sourceCount * 5.0)),
          confidenceScore <= 1.0 ? confidenceScore * 100.0 : confidenceScore,
          confidenceScore < 0.85,
          List.of("Exact primary key match", "High phonetic similarity"),
          List.of("CRM", "ERP"));
    }
  }

  @JsonInclude(JsonInclude.Include.NON_NULL)
  public record Response(
      List<SearchItem> items,
      long total,
      int page,
      int size,
      Map<String, Map<String, Long>> facets,
      InsightsDto insights) {

    public Response(
        List<SearchItem> items,
        long total,
        int page,
        int size,
        Map<String, Map<String, Long>> facets) {
      this(
          items,
          total,
          page,
          size,
          facets,
          new InsightsDto(
              items.stream().filter(SearchItem::possibleDuplicate).count(),
              items.stream().filter(i -> i.completenessScore() < 80.0).count(),
              items.stream().filter(i -> i.qualityScore() < 85.0).count()));
    }
  }
}
