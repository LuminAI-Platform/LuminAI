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
      List<ProvenanceItem> provenance) {}
}
