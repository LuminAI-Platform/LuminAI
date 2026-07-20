package com.luminai.connection.service;

import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class SchemaDetector {

  private static final int MAX_ROWS = 100;

  private static final List<DateTimeFormatter> TIMESTAMP_FORMATTERS =
      List.of(
          DateTimeFormatter.ISO_LOCAL_DATE_TIME,
          DateTimeFormatter.ISO_OFFSET_DATE_TIME,
          DateTimeFormatter.ISO_ZONED_DATE_TIME,
          DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"),
          DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss.SSS"),
          DateTimeFormatter.ofPattern("MM/dd/yyyy HH:mm:ss"),
          DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm:ss"),
          DateTimeFormatter.ISO_LOCAL_DATE);

  public enum DataType {
    INTEGER,
    DOUBLE,
    BOOLEAN,
    TIMESTAMP,
    STRING
  }

  /**
   * Infers the data type for each column by sampling up to the first 100 rows.
   *
   * @param columns map of column name → list of raw string values
   * @return map of column name → inferred DataType
   */
  public Map<String, DataType> inferSchema(Map<String, List<String>> columns) {
    return columns.entrySet().stream()
        .collect(Collectors.toMap(Map.Entry::getKey, e -> inferColumnType(e.getValue())));
  }

  /**
   * Infers the type of a single column from its values.
   *
   * @param values raw string values (up to MAX_ROWS sampled)
   * @return inferred DataType
   */
  public DataType inferColumnType(List<String> values) {
    List<String> sample =
        values.stream().filter(v -> v != null && !v.isBlank()).limit(MAX_ROWS).toList();

    if (sample.isEmpty()) {
      return DataType.STRING;
    }

    // Priority: INTEGER → DOUBLE → BOOLEAN → TIMESTAMP → STRING
    if (sample.stream().allMatch(this::isInteger)) return DataType.INTEGER;
    if (sample.stream().allMatch(this::isDouble)) return DataType.DOUBLE;
    if (sample.stream().allMatch(this::isBoolean)) return DataType.BOOLEAN;
    if (sample.stream().allMatch(this::isTimestamp)) return DataType.TIMESTAMP;

    return DataType.STRING;
  }

  // --- Type checkers ---

  private boolean isInteger(String value) {
    try {
      Long.parseLong(value.trim());
      return true;
    } catch (NumberFormatException e) {
      return false;
    }
  }

  private boolean isDouble(String value) {
    try {
      Double.parseDouble(value.trim());
      return true;
    } catch (NumberFormatException e) {
      return false;
    }
  }

  private boolean isBoolean(String value) {
    String v = value.trim().toLowerCase();
    return v.equals("true") || v.equals("false") || v.equals("1") || v.equals("0");
  }

  private boolean isTimestamp(String value) {
    String trimmed = value.trim();
    for (DateTimeFormatter formatter : TIMESTAMP_FORMATTERS) {
      try {
        formatter.parse(trimmed);
        return true;
      } catch (DateTimeParseException ignored) {
        // try next formatter
      }
    }
    return false;
  }
}
