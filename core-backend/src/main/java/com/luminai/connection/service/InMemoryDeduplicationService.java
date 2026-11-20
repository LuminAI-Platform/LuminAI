package com.luminai.connection.service;

import java.util.*;
import org.springframework.stereotype.Service;

/**
 * Service for deterministic in-memory entity resolution, composite key extraction, identifier
 * contradiction guards, and golden record field survivorship.
 */
@Service
public class InMemoryDeduplicationService {

  public String extractExplicitId(Map<String, Object> row) {
    for (String k : row.keySet()) {
      String lk = k.toLowerCase().replace("_", "");
      if (lk.equals("mrn")
          || lk.equals("ssn")
          || lk.equals("nationalid")
          || lk.equals("idnumber")) {
        Object val = row.get(k);
        if (val != null && !String.valueOf(val).isBlank()) {
          return String.valueOf(val).trim().toUpperCase();
        }
      }
    }
    return "";
  }

  public String extractCompositeKey(Map<String, Object> cleaned, String name) {
    String explicitId = extractExplicitId(cleaned);
    if (!explicitId.isEmpty()) {
      return "id:" + explicitId;
    }
    for (String k : cleaned.keySet()) {
      if (k.toLowerCase().contains("email") && !String.valueOf(cleaned.get(k)).isBlank()) {
        return "email:" + String.valueOf(cleaned.get(k)).toLowerCase();
      }
    }
    return "name:" + name.toLowerCase();
  }

  public List<List<Map<String, Object>>> clusterRecords(List<Map<String, Object>> processedRows) {
    List<List<Map<String, Object>>> clusters = new ArrayList<>();
    Set<Integer> usedIndices = new HashSet<>();

    for (int i = 0; i < processedRows.size(); i++) {
      if (usedIndices.contains(i)) continue;
      List<Map<String, Object>> cluster = new ArrayList<>();
      cluster.add(processedRows.get(i));
      usedIndices.add(i);

      String pkA = String.valueOf(processedRows.get(i).get("_primaryKey"));
      String idA = extractExplicitId(processedRows.get(i));

      for (int j = i + 1; j < processedRows.size(); j++) {
        if (usedIndices.contains(j)) continue;
        String pkB = String.valueOf(processedRows.get(j).get("_primaryKey"));
        String idB = extractExplicitId(processedRows.get(j));

        // Identifier Contradiction Guard: If both have distinct explicit verified IDs, never merge!
        if (!idA.isEmpty() && !idB.isEmpty() && !idA.equalsIgnoreCase(idB)) {
          continue;
        }

        if (pkA.equals(pkB)) {
          cluster.add(processedRows.get(j));
          usedIndices.add(j);
        }
      }
      clusters.add(cluster);
    }
    return clusters;
  }

  public Map<String, Object> buildGoldenRecord(List<Map<String, Object>> cluster) {
    Map<String, Object> lead = cluster.get(0);
    Map<String, Object> consolidatedProps = new LinkedHashMap<>();

    // Field survivorship: non-null and longer/richer values beat sparse values
    for (Map<String, Object> member : cluster) {
      for (Map.Entry<String, Object> entry : member.entrySet()) {
        if (entry.getKey().startsWith("_")) continue;
        Object curVal = consolidatedProps.get(entry.getKey());
        Object newVal = entry.getValue();

        if (curVal == null || String.valueOf(curVal).isBlank()) {
          if (newVal != null && !String.valueOf(newVal).isBlank()) {
            consolidatedProps.put(entry.getKey(), newVal);
          }
        } else if (newVal != null && !String.valueOf(newVal).isBlank()) {
          if (String.valueOf(newVal).length() > String.valueOf(curVal).length()) {
            consolidatedProps.put(entry.getKey(), newVal);
          }
        }
      }
    }

    double confidenceScore = cluster.size() > 1 ? 0.96 : 1.0;
    String leadState = String.valueOf(lead.get("_qualityState"));
    double leadScore = (Double) lead.getOrDefault("_qualityScore", 90.0);

    Map<String, Object> row = new LinkedHashMap<>();
    row.put(
        "id",
        lead.containsKey("id") && !String.valueOf(lead.get("id")).isBlank()
            ? lead.get("id")
            : UUID.randomUUID().toString());
    row.put("canonicalName", lead.get("_canonicalName"));
    row.put("entityType", lead.get("_entityType"));
    row.put("qualityState", leadState);
    row.put("qualityScore", leadScore);
    row.put("confidenceScore", confidenceScore);
    row.put("sourceCount", cluster.size());
    row.put("_validationErrors", lead.get("_validationErrors"));
    row.put("_validationWarnings", lead.get("_validationWarnings"));
    row.putAll(consolidatedProps);

    return row;
  }
}
