package com.luminai.explorer.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class SearchResponseDto {

  public record SearchItem(
      UUID id,
      String canonicalName,
      String entityType,
      double confidenceScore,
      int sourceCount,
      Map<String, Object> properties,
      Instant createdAt,
      Instant updatedAt,
      Map<String, List<String>> highlights) {}

  public record Response(
      List<SearchItem> items,
      long total,
      int page,
      int size,
      Map<String, Map<String, Long>> facets) {}
}
