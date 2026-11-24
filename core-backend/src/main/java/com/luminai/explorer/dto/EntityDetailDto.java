package com.luminai.explorer.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

public final class EntityDetailDto {

  private EntityDetailDto() {}

  public record Response(
      UUID id,
      String canonicalName,
      String entityType,
      double confidenceScore,
      int sourceCount,
      Map<String, Object> properties,
      Instant createdAt,
      Instant updatedAt,
      Set<UUID> sourceRecordIds,
      List<ProvenanceItem> provenance,
      double completenessScore,
      double qualityScore,
      boolean possibleDuplicate,
      List<String> matchReasons) {

    public Response(
        UUID id,
        String canonicalName,
        String entityType,
        double confidenceScore,
        int sourceCount,
        Map<String, Object> properties,
        Instant createdAt,
        Instant updatedAt,
        Set<UUID> sourceRecordIds,
        List<ProvenanceItem> provenance) {
      this(
          id,
          canonicalName,
          entityType,
          confidenceScore,
          sourceCount,
          properties,
          createdAt,
          updatedAt,
          sourceRecordIds,
          provenance,
          Math.min(100.0, 75.0 + (sourceCount * 5.0)),
          confidenceScore <= 1.0 ? confidenceScore * 100.0 : confidenceScore,
          confidenceScore < 0.85 || sourceCount > 1,
          List.of("Primary key resolution", "Cross-system attribute alignment"));
    }
  }
}
