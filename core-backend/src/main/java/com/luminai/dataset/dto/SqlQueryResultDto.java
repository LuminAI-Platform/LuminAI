package com.luminai.dataset.dto;

import java.util.List;
import java.util.Map;

public record SqlQueryResultDto(
    List<String> columns,
    List<Map<String, Object>> rows,
    long totalRows,
    long rowCount,
    long totalCount,
    long executionTimeMs,
    String status) {

  public SqlQueryResultDto(
      List<String> columns,
      List<Map<String, Object>> rows,
      long totalRows,
      long executionTimeMs,
      String status) {
    this(columns, rows, totalRows, totalRows, totalRows, executionTimeMs, status);
  }
}
