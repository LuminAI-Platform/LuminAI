package com.luminai.dataset.dto;

import java.util.List;
import java.util.Map;

/**
 * Result envelope returned by the SQL Studio query endpoint.
 *
 * <p>{@code columns} is a {@link List} of {@link SqlColumnInfo} objects (name + type) so the
 * frontend can render typed column headers. The previous {@code List<String>} caused blank column
 * headers because the UI reads {@code column.name} rather than the string itself.
 */
public record SqlQueryResultDto(
    List<SqlColumnInfo> columns,
    List<Map<String, Object>> rows,
    long totalRows,
    long rowCount,
    long totalCount,
    long executionTimeMs,
    String status) {

  public SqlQueryResultDto(
      List<SqlColumnInfo> columns,
      List<Map<String, Object>> rows,
      long totalRows,
      long executionTimeMs,
      String status) {
    this(columns, rows, totalRows, totalRows, totalRows, executionTimeMs, status);
  }
}
