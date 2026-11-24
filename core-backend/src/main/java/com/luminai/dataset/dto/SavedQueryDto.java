package com.luminai.dataset.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonRawValue;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luminai.dataset.model.SavedQuery;
import java.time.Instant;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record SavedQueryDto(
    UUID id,
    UUID tenantId,
    String name,
    String title,
    String description,
    String sqlText,
    String sqlQuery,
    UUID datasetId,
    @JsonRawValue String chartConfig,
    @JsonRawValue String visualConfig,
    UUID createdBy,
    Instant createdAt,
    Instant updatedAt) {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  public static SavedQueryDto fromEntity(SavedQuery entity) {
    if (entity == null) return null;
    String cfg =
        entity.getVisualConfig() != null && !entity.getVisualConfig().isBlank()
            ? entity.getVisualConfig()
            : "{}";
    String titleOrName = entity.getTitle();
    String query = entity.getSqlQuery();

    return new SavedQueryDto(
        entity.getId(),
        entity.getTenantId(),
        titleOrName, // name for frontend
        titleOrName, // title for legacy
        entity.getDescription(),
        query, // sqlText for frontend
        query, // sqlQuery for legacy
        entity.getDatasetId(),
        cfg, // chartConfig
        cfg, // visualConfig
        entity.getCreatedBy(),
        entity.getCreatedAt(),
        entity.getUpdatedAt());
  }

  public record UpsertRequest(
      String name,
      String title,
      String sqlText,
      String sqlQuery,
      String description,
      UUID datasetId,
      Object chartConfig,
      Object visualConfig) {

    public String resolveTitle() {
      if (name != null && !name.isBlank()) return name.trim();
      if (title != null && !title.isBlank()) return title.trim();
      return "Untitled Query";
    }

    public String resolveSql() {
      if (sqlText != null && !sqlText.isBlank()) return sqlText.trim();
      if (sqlQuery != null && !sqlQuery.isBlank()) return sqlQuery.trim();
      return "";
    }

    public String resolveConfig() {
      Object cfg = chartConfig != null ? chartConfig : visualConfig;
      if (cfg == null) return "{}";
      if (cfg instanceof String s) return s;
      try {
        return MAPPER.writeValueAsString(cfg);
      } catch (Exception e) {
        return "{}";
      }
    }
  }
}
