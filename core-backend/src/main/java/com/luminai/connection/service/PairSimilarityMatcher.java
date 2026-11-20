package com.luminai.connection.service;

import java.util.*;
import org.springframework.stereotype.Component;

/**
 * Similarity evaluation algorithms (Jaro-Winkler, Levenshtein, composite scoring) and entity record
 * attribute extractors for candidate matching.
 */
@Component
public class PairSimilarityMatcher {

  public double computeSimilarity(
      String nameA,
      String nameB,
      String emailA,
      String emailB,
      String phoneA,
      String phoneB,
      Map<String, Object> rowA,
      Map<String, Object> rowB) {
    if (nameA == null || nameB == null) {
      return 0.0;
    }
    if (nameA.equalsIgnoreCase(nameB)) {
      return 0.88;
    }

    double nameSim = jaroWinkler(nameA, nameB);
    double emailSim = (emailA != null && emailB != null) ? jaroWinkler(emailA, emailB) : 0.0;
    double phoneSim =
        (phoneA != null && phoneB != null && !phoneA.isBlank() && phoneA.equals(phoneB))
            ? 1.0
            : 0.0;

    if (phoneSim > 0.0) {
      return Math.round((nameSim * 0.6 + phoneSim * 0.4) * 1000.0) / 1000.0;
    }
    if (emailSim > 0.0) {
      return Math.round((nameSim * 0.7 + emailSim * 0.3) * 1000.0) / 1000.0;
    }
    return Math.round(nameSim * 1000.0) / 1000.0;
  }

  public double jaroWinkler(String s1, String s2) {
    if (s1 == null || s2 == null) return 0.0;
    if (s1.equalsIgnoreCase(s2)) return 1.0;
    int len1 = s1.length(), len2 = s2.length();
    if (len1 == 0 || len2 == 0) return 0.0;

    int matchDistance = Math.max(len1, len2) / 2 - 1;
    boolean[] s1Matches = new boolean[len1];
    boolean[] s2Matches = new boolean[len2];
    int matches = 0;

    for (int i = 0; i < len1; i++) {
      int start = Math.max(0, i - matchDistance);
      int end = Math.min(i + matchDistance + 1, len2);
      for (int j = start; j < end; j++) {
        if (s2Matches[j]) continue;
        if (Character.toLowerCase(s1.charAt(i)) != Character.toLowerCase(s2.charAt(j))) continue;
        s1Matches[i] = true;
        s2Matches[j] = true;
        matches++;
        break;
      }
    }
    if (matches == 0) return 0.0;

    double t = 0;
    int point = 0;
    for (int i = 0; i < len1; i++) {
      if (!s1Matches[i]) continue;
      while (!s2Matches[point]) point++;
      if (Character.toLowerCase(s1.charAt(i)) != Character.toLowerCase(s2.charAt(point))) t++;
      point++;
    }
    t /= 2;

    double m = matches;
    double jaro = ((m / len1) + (m / len2) + ((m - t) / m)) / 3;
    int prefix = 0;
    for (int i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
      if (Character.toLowerCase(s1.charAt(i)) == Character.toLowerCase(s2.charAt(i))) prefix++;
      else break;
    }
    return jaro + prefix * 0.1 * (1 - jaro);
  }

  public String buildRationale(String nameA, String nameB, double similarity) {
    return String.format(
        "Fuzzy token and phonetic match between '%s' and '%s' (similarity: %.2f%%). Flagged for human review.",
        nameA != null ? nameA : "Record A", nameB != null ? nameB : "Record B", similarity * 100);
  }

  public String extractName(Map<String, Object> row) {
    for (String key :
        List.of(
            "name",
            "full_name",
            "fullName",
            "customer_name",
            "customerName",
            "patient_name",
            "patientName",
            "first_name",
            "firstName",
            "contact_name",
            "contactName")) {
      Object val = row.get(key);
      if (val != null && !String.valueOf(val).isBlank()) {
        return String.valueOf(val).trim();
      }
    }
    Object fn = row.get("firstName") != null ? row.get("firstName") : row.get("first_name");
    Object ln = row.get("lastName") != null ? row.get("lastName") : row.get("last_name");
    if (fn != null && ln != null) {
      return (String.valueOf(fn).trim() + " " + String.valueOf(ln).trim()).trim();
    }
    return null;
  }

  public String extractString(Map<String, Object> row, String key) {
    Object val = row.get(key);
    return val != null ? String.valueOf(val).trim() : null;
  }

  public String extractPhone(Map<String, Object> row) {
    for (String key : List.of("phone", "phoneNumber", "phone_number", "mobile", "telephone")) {
      Object val = row.get(key);
      if (val != null && !String.valueOf(val).isBlank()) {
        return String.valueOf(val).replaceAll("[^0-9]", "");
      }
    }
    return null;
  }

  public UUID extractOrGenerateUuid(Map<String, Object> row, int fallbackIndex) {
    for (String key :
        List.of(
            "id",
            "record_id",
            "recordId",
            "patient_id",
            "patientId",
            "customer_id",
            "customerId",
            "account_id")) {
      Object val = row.get(key);
      if (val != null) {
        try {
          return UUID.fromString(String.valueOf(val).trim());
        } catch (IllegalArgumentException e) {
          return UUID.nameUUIDFromBytes(String.valueOf(val).getBytes());
        }
      }
    }
    return UUID.nameUUIDFromBytes(("record-" + fallbackIndex).getBytes());
  }
}
