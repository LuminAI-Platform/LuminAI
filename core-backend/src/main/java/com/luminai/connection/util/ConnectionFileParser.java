package com.luminai.connection.util;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.luminai.connection.model.GoldenRecord;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.multipart.MultipartFile;

/** Utility helpers for parsing CSV, TSV, and JSON data streams and serializing golden records. */
public final class ConnectionFileParser {

  private static final Logger log = LoggerFactory.getLogger(ConnectionFileParser.class);

  private ConnectionFileParser() {}

  public record StreamingParseResult(
      List<String> columns, List<Map<String, Object>> sampleRows, int totalRecords) {}

  public static List<String> parseCsvLine(String line) {
    List<String> tokens = new ArrayList<>();
    StringBuilder sb = new StringBuilder();
    boolean inQuotes = false;
    for (int i = 0; i < line.length(); i++) {
      char c = line.charAt(i);
      if (c == '"') {
        if (inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '"') {
          sb.append('"');
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c == ',' && !inQuotes) {
        tokens.add(sb.toString().trim());
        sb.setLength(0);
      } else {
        sb.append(c);
      }
    }
    tokens.add(sb.toString().trim());
    return tokens;
  }

  public static List<Map<String, Object>> parseBytesRows(String filename, byte[] data) {
    List<Map<String, Object>> rows = new ArrayList<>();
    String lower = filename != null ? filename.toLowerCase() : "";

    try (InputStream is = new java.io.ByteArrayInputStream(data)) {
      if (lower.endsWith(".json")) {
        ObjectMapper mapper = new ObjectMapper();
        Object parsed = mapper.readValue(is, Object.class);
        if (parsed instanceof List<?> list) {
          for (Object item : list) {
            if (item instanceof Map<?, ?> m) {
              @SuppressWarnings("unchecked")
              Map<String, Object> typedMap = (Map<String, Object>) m;
              rows.add(typedMap);
            }
          }
        }
      } else {
        try (BufferedReader reader =
            new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
          String headerLine = reader.readLine();
          if (headerLine != null && !headerLine.isBlank()) {
            List<String> headers = parseCsvLine(headerLine);
            String line;
            while ((line = reader.readLine()) != null) {
              if (line.isBlank()) continue;
              List<String> vals = parseCsvLine(line);
              Map<String, Object> row = new LinkedHashMap<>();
              for (int h = 0; h < headers.size(); h++) {
                String key = headers.get(h);
                String val = h < vals.size() ? vals.get(h) : "";
                row.put(key, val);
              }
              rows.add(row);
            }
          }
        }
      }
    } catch (Exception e) {
      log.warn("Failed to parse file bytes '{}': {}", filename, e.getMessage());
    }
    return rows;
  }

  public static StreamingParseResult parseFileStream(MultipartFile file, int maxSampleRows) {
    String filename = file.getOriginalFilename();
    String lower = filename != null ? filename.toLowerCase() : "";
    List<String> columns = new ArrayList<>();
    List<Map<String, Object>> sampleRows = new ArrayList<>();
    int totalCount = 0;

    try (InputStream is = file.getInputStream()) {
      if (lower.endsWith(".json")) {
        ObjectMapper mapper = new ObjectMapper();
        try (com.fasterxml.jackson.core.JsonParser parser = mapper.getFactory().createParser(is)) {
          if (parser.nextToken() == com.fasterxml.jackson.core.JsonToken.START_ARRAY) {
            while (parser.nextToken() != com.fasterxml.jackson.core.JsonToken.END_ARRAY
                && parser.currentToken() != null) {
              totalCount++;
              if (sampleRows.size() < maxSampleRows) {
                @SuppressWarnings("unchecked")
                Map<String, Object> item = mapper.readValue(parser, Map.class);
                sampleRows.add(item);
                if (columns.isEmpty()) {
                  columns.addAll(item.keySet());
                }
              } else {
                parser.skipChildren();
              }
            }
          } else {
            Object parsed = mapper.readValue(is, Object.class);
            if (parsed instanceof Map<?, ?> m) {
              @SuppressWarnings("unchecked")
              Map<String, Object> typedMap = (Map<String, Object>) m;
              sampleRows.add(typedMap);
              columns.addAll(typedMap.keySet());
              totalCount = 1;
            }
          }
        }
      } else {
        try (BufferedReader reader =
            new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
          String headerLine = reader.readLine();
          if (headerLine != null && !headerLine.isBlank()) {
            columns = parseCsvLine(headerLine);
            String line;
            while ((line = reader.readLine()) != null) {
              if (line.isBlank()) continue;
              totalCount++;
              if (sampleRows.size() < maxSampleRows) {
                List<String> vals = parseCsvLine(line);
                Map<String, Object> row = new LinkedHashMap<>();
                for (int h = 0; h < columns.size(); h++) {
                  String key = columns.get(h);
                  String val = h < vals.size() ? vals.get(h) : "";
                  row.put(key, val);
                }
                sampleRows.add(row);
              }
            }
          }
        }
      }
    } catch (Exception e) {
      log.warn("Failed to stream parse file '{}': {}", filename, e.getMessage());
    }

    return new StreamingParseResult(columns, sampleRows, totalCount);
  }

  public static void writeRecordsToCsv(List<GoldenRecord> records, PrintWriter writer) {
    Set<String> propertyKeys = new LinkedHashSet<>();
    for (GoldenRecord gr : records) {
      if (gr.getProperties() != null) {
        propertyKeys.addAll(gr.getProperties().keySet());
      }
    }

    List<String> headers = new ArrayList<>();
    headers.add("id");
    headers.add("canonical_name");
    headers.add("entity_type");
    headers.add("confidence_score");
    headers.add("source_count");
    headers.add("created_at");
    headers.addAll(propertyKeys);

    writer.write(String.join(",", headers) + "\r\n");

    for (GoldenRecord gr : records) {
      List<String> row = new ArrayList<>();
      row.add(escapeCsv(gr.getId() != null ? gr.getId().toString() : ""));
      row.add(escapeCsv(gr.getCanonicalName()));
      row.add(escapeCsv(gr.getEntityType()));
      row.add(
          escapeCsv(
              gr.getConfidenceScore() != null ? gr.getConfidenceScore().toString() : "1.0000"));
      row.add(String.valueOf(gr.getSourceCount()));
      row.add(escapeCsv(gr.getCreatedAt() != null ? gr.getCreatedAt().toString() : ""));

      Map<String, Object> props = gr.getProperties();
      for (String key : propertyKeys) {
        Object val = props != null ? props.get(key) : null;
        row.add(escapeCsv(val != null ? val.toString() : ""));
      }
      writer.write(String.join(",", row) + "\r\n");
    }
    writer.flush();
  }

  public static void writeMapsToCsv(List<Map<String, Object>> rows, PrintWriter writer) {
    if (rows.isEmpty()) return;
    Set<String> headers = new LinkedHashSet<>();
    for (Map<String, Object> r : rows) {
      headers.addAll(r.keySet());
    }
    List<String> headerList = new ArrayList<>(headers);
    writer.write(String.join(",", headerList) + "\r\n");

    for (Map<String, Object> r : rows) {
      List<String> row = new ArrayList<>();
      for (String h : headerList) {
        Object v = r.get(h);
        row.add(escapeCsv(v != null ? v.toString() : ""));
      }
      writer.write(String.join(",", row) + "\r\n");
    }
    writer.flush();
  }

  public static String escapeCsv(String val) {
    if (val == null) return "";
    if (val.contains(",") || val.contains("\"") || val.contains("\n") || val.contains("\r")) {
      return "\"" + val.replace("\"", "\"\"") + "\"";
    }
    return val;
  }

  public static String extractRowName(Map<String, Object> raw, String entityTypeHint) {
    if (raw == null || raw.isEmpty()) {
      return "Entity " + UUID.randomUUID().toString().substring(0, 8);
    }

    String[] candidateKeys = {
      "canonicalName",
      "canonical_name",
      "name",
      "full_name",
      "student_name",
      "customer_name",
      "user_name",
      "username",
      "person_name",
      "employee_name",
      "patient_name",
      "title",
      "company",
      "organization"
    };
    for (String key : candidateKeys) {
      if (raw.containsKey(key) && raw.get(key) != null && !String.valueOf(raw.get(key)).isBlank()) {
        return String.valueOf(raw.get(key)).trim();
      }
    }

    String item = null;
    for (Map.Entry<String, Object> entry : raw.entrySet()) {
      String lk = entry.getKey().toLowerCase().replace("_", " ").trim();
      if ((lk.contains("item")
              || lk.contains("product")
              || lk.contains("sku")
              || lk.contains("category"))
          && entry.getValue() != null
          && !String.valueOf(entry.getValue()).isBlank()) {
        item = String.valueOf(entry.getValue()).trim();
        break;
      }
    }

    String idVal = null;
    String idKey = null;
    for (Map.Entry<String, Object> entry : raw.entrySet()) {
      String lk = entry.getKey().toLowerCase().replace("_", " ").trim();
      if ((lk.equals("id")
              || lk.endsWith(" id")
              || lk.startsWith("id ")
              || lk.contains("identifier")
              || lk.contains("uuid")
              || lk.endsWith(" code")
              || lk.endsWith(" number")
              || lk.equals("sku"))
          && entry.getValue() != null
          && !String.valueOf(entry.getValue()).isBlank()) {
        idVal = String.valueOf(entry.getValue()).trim();
        idKey = entry.getKey().trim();
        break;
      }
    }

    if (idVal != null) {
      if (item != null) {
        return item + " (#" + idVal + ")";
      }
      String lk = idKey != null ? idKey.toLowerCase() : "";
      if (lk.contains("order")) {
        return "Order #" + idVal;
      } else if (lk.contains("student")) {
        return "Student #" + idVal;
      } else if (lk.contains("customer")) {
        return "Customer #" + idVal;
      } else if (lk.contains("patient")) {
        return "Patient #" + idVal;
      } else if (lk.contains("user")) {
        return "User #" + idVal;
      } else if (lk.contains("employee")) {
        return "Employee #" + idVal;
      } else if (entityTypeHint != null
          && !entityTypeHint.isBlank()
          && !"Organization".equalsIgnoreCase(entityTypeHint)
          && !"Entity".equalsIgnoreCase(entityTypeHint)) {
        return entityTypeHint + " #" + idVal;
      }
      return "#" + idVal;
    }

    for (Object val : raw.values()) {
      if (val != null && !String.valueOf(val).isBlank()) {
        return String.valueOf(val).trim();
      }
    }
    return "Entity " + UUID.randomUUID().toString().substring(0, 8);
  }

  public static String inferEntityType(Map<String, Object> raw, String entityTypeHint) {
    if (entityTypeHint != null && !entityTypeHint.isBlank()) {
      return entityTypeHint.trim();
    }
    if (raw == null || raw.isEmpty()) {
      return "Entity";
    }
    if (raw.containsKey("entityType") && raw.get("entityType") != null) {
      return String.valueOf(raw.get("entityType")).trim();
    }
    if (raw.containsKey("entity_type") && raw.get("entity_type") != null) {
      return String.valueOf(raw.get("entity_type")).trim();
    }
    String keys = String.join(" ", raw.keySet()).toLowerCase();
    if (keys.contains("student")
        || keys.contains("academic")
        || keys.contains("school")
        || keys.contains("grade")
        || keys.contains("course")) {
      return "Student";
    }
    if (keys.contains("order")
        || keys.contains("transaction")
        || keys.contains("revenue")
        || keys.contains("sales")
        || keys.contains("sale")
        || keys.contains("amount")
        || keys.contains("payment")
        || keys.contains("invoice")) {
      return "Transaction";
    }
    if (keys.contains("email")
        || keys.contains("first_name")
        || keys.contains("last_name")
        || keys.contains("user")
        || keys.contains("person")
        || keys.contains("age")
        || keys.contains("gender")
        || keys.contains("patient")) {
      return "Person";
    }
    if (keys.contains("company")
        || keys.contains("org")
        || keys.contains("industry")
        || keys.contains("domain")) {
      return "Organization";
    }
    if (keys.contains("price")
        || keys.contains("sku")
        || keys.contains("product")
        || keys.contains("inventory")) {
      return "Product";
    }
    return "Entity";
  }

  public static String toTitleCase(String input) {
    if (input == null || input.isBlank()) return "";
    String[] words = input.trim().split("\\s+");
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < words.length; i++) {
      if (words[i].length() > 0) {
        sb.append(Character.toUpperCase(words[i].charAt(0)));
        if (words[i].length() > 1) {
          sb.append(words[i].substring(1).toLowerCase());
        }
      }
      if (i < words.length - 1) sb.append(" ");
    }
    return sb.toString();
  }
}
