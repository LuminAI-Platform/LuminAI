package com.luminai.connection.service;

import com.luminai.connection.util.ConnectionFileParser;
import java.time.LocalDate;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

/**
 * Service for data sanitization, date normalization, name standardization, and categorical
 * normalization across ingestion feeds.
 */
@Service
public class DataNormalizationService {

  private static final Set<String> PLACEHOLDER_NAMES =
      Set.of(
          "unknown",
          "unknown doe",
          "john doe",
          "jane doe",
          "baby doe",
          "test user",
          "test patient",
          "anonymous",
          "n/a",
          "none",
          "null");

  public static class DateValidationResult {
    public boolean isValid;
    public String isoDate;
    public boolean isAmbiguous;
    public String error;
  }

  public static class NameValidationResult {
    public String normalizedName;
    public boolean isPlaceholder;
  }

  public static class CategoricalValResult {
    public String canonicalValue;
    public boolean isValid;
    public boolean needsReview;
    public String error;
  }

  public String sanitizeText(String s) {
    if (s == null) return "";
    String cleaned =
        s.replaceAll("[\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f\\x7f\\u200b-\\u200d\\ufeff]", "");
    cleaned =
        cleaned
            .replace("Ã¼", "ü")
            .replace("Ã¶", "ö")
            .replace("Ã¤", "ä")
            .replace("Ã©", "é")
            .replace("Ã§", "ç")
            .replace("â€™", "’");
    if (cleaned.contains("<") && cleaned.contains(">")) {
      cleaned = cleaned.replaceAll("<[^>]+>", "");
    }
    if (cleaned.startsWith("=") || cleaned.startsWith("@")) {
      cleaned = "'" + cleaned;
    }
    return cleaned.trim();
  }

  public DateValidationResult validateAndNormalizeDate(String s, String fieldName) {
    DateValidationResult res = new DateValidationResult();
    if (s == null || s.isBlank()) {
      res.isValid = true;
      res.isoDate = "";
      return res;
    }

    if (Pattern.compile("\\b(yrs|years?|yesterday|today|now)\\b", Pattern.CASE_INSENSITIVE)
        .matcher(s)
        .find()) {
      res.isValid = false;
      res.error = "Relative string '" + s + "' is not a valid date";
      return res;
    }

    Matcher approx =
        Pattern.compile("^(?:c\\.|circa)?\\s*(\\d{4})$", Pattern.CASE_INSENSITIVE).matcher(s);
    if (approx.find()) {
      res.isValid = true;
      res.isoDate = approx.group(1);
      return res;
    }

    Matcher iso = Pattern.compile("^(\\d{4})[-/.](\\d{1,2})[-/.](\\d{1,2})$").matcher(s);
    if (iso.find()) {
      int y = Integer.parseInt(iso.group(1));
      int m = Integer.parseInt(iso.group(2));
      int d = Integer.parseInt(iso.group(3));
      if (!isCalendarValid(y, m, d)) {
        res.isValid = false;
        res.error =
            "Invalid calendar date '" + s + "' (day " + d + " does not exist in month " + m + ")";
        return res;
      }
      res.isValid = true;
      res.isoDate = String.format("%04d-%02d-%02d", y, m, d);
      checkFutureDate(res, y, m, d, fieldName);
      return res;
    }

    Matcher slash = Pattern.compile("^(\\d{1,2})[-/.](\\d{1,2})[-/.](\\d{2,4})$").matcher(s);
    if (slash.find()) {
      int p1 = Integer.parseInt(slash.group(1));
      int p2 = Integer.parseInt(slash.group(2));
      int rawY = Integer.parseInt(slash.group(3));
      int y = rawY < 100 ? (rawY <= 50 ? 2000 + rawY : 1900 + rawY) : rawY;

      int d, m;
      if (p1 > 12 && p2 <= 12) {
        d = p1;
        m = p2;
      } else if (p2 > 12 && p1 <= 12) {
        m = p1;
        d = p2;
      } else if (p1 <= 12 && p2 <= 12) {
        d = p1;
        m = p2;
        res.isAmbiguous = (p1 != p2);
      } else {
        res.isValid = false;
        res.error = "Invalid date components in '" + s + "'";
        return res;
      }

      if (!isCalendarValid(y, m, d)) {
        res.isValid = false;
        res.error =
            "Invalid calendar date '" + s + "' (day " + d + " does not exist in month " + m + ")";
        return res;
      }

      res.isValid = true;
      res.isoDate = String.format("%04d-%02d-%02d", y, m, d);
      checkFutureDate(res, y, m, d, fieldName);
      return res;
    }

    res.isValid = false;
    res.error = "Unrecognized date format '" + s + "'";
    return res;
  }

  public boolean isCalendarValid(int y, int m, int d) {
    if (m < 1 || m > 12 || d < 1) return false;
    try {
      LocalDate.of(y, m, d);
      return true;
    } catch (Exception e) {
      return false;
    }
  }

  private void checkFutureDate(DateValidationResult res, int y, int m, int d, String fn) {
    if (fn.contains("dob") || fn.contains("birth")) {
      try {
        if (LocalDate.of(y, m, d).isAfter(LocalDate.now().plusDays(1))) {
          res.isValid = false;
          res.error = "Birth date '" + res.isoDate + "' cannot be in the future";
        }
      } catch (Exception ignored) {
      }
    }
  }

  public NameValidationResult normalizeName(String s) {
    NameValidationResult res = new NameValidationResult();
    if (s == null || s.isBlank()) {
      res.normalizedName = "";
      res.isPlaceholder = true;
      return res;
    }
    String collapsed = s.replaceAll("\\s+", " ").trim();
    if (PLACEHOLDER_NAMES.contains(collapsed.toLowerCase())) {
      res.normalizedName = collapsed;
      res.isPlaceholder = true;
      return res;
    }
    if (collapsed.contains(",") && collapsed.split(",").length == 2) {
      String[] parts = collapsed.split(",");
      collapsed = parts[1].trim() + " " + parts[0].trim();
    }
    res.normalizedName = ConnectionFileParser.toTitleCase(collapsed);
    res.isPlaceholder = false;
    return res;
  }

  public CategoricalValResult normalizeGender(String s) {
    CategoricalValResult res = new CategoricalValResult();
    String low = s.toLowerCase();
    if (low.equals("1") || low.equals("0")) {
      res.isValid = false;
      res.needsReview = true;
      res.error = "Unmapped numeric code '" + s + "' in gender column";
      return res;
    }
    if (low.equals("f") || low.equals("female")) {
      res.canonicalValue = "Female";
      res.isValid = true;
      return res;
    }
    if (low.equals("m") || low.equals("male")) {
      res.canonicalValue = "Male";
      res.isValid = true;
      return res;
    }
    res.canonicalValue = ConnectionFileParser.toTitleCase(s);
    res.isValid = true;
    return res;
  }

  public CategoricalValResult normalizeCountry(String s) {
    CategoricalValResult res = new CategoricalValResult();
    String low = s.toLowerCase();
    if (low.matches("^\\d+$")) {
      res.isValid = false;
      res.needsReview = true;
      res.error = "Invalid numeric code '" + s + "' in country column";
      return res;
    }
    if (low.equals("us")
        || low.equals("usa")
        || low.equals("u.s.a.")
        || low.equals("united states")) {
      res.canonicalValue = "United States";
      res.isValid = true;
      return res;
    }
    if (low.equals("de") || low.equals("germany") || low.equals("deutschland")) {
      res.canonicalValue = "Germany";
      res.isValid = true;
      return res;
    }
    if (low.equals("fr") || low.equals("france")) {
      res.canonicalValue = "France";
      res.isValid = true;
      return res;
    }
    if (low.equals("gh") || low.equals("ghana")) {
      res.canonicalValue = "Ghana";
      res.isValid = true;
      return res;
    }
    res.canonicalValue = ConnectionFileParser.toTitleCase(s);
    res.isValid = true;
    return res;
  }

  public CategoricalValResult normalizeCity(String s) {
    CategoricalValResult res = new CategoricalValResult();
    String low = s.toLowerCase();
    if (low.equals("madina")) {
      res.canonicalValue = "Madina";
      res.isValid = true;
      return res;
    }
    if (low.equals("madian")) {
      res.canonicalValue = "Madian";
      res.isValid = true;
      res.needsReview = true;
      res.error = "Potential misspelling of 'Madina' flagged for review";
      return res;
    }
    res.canonicalValue = ConnectionFileParser.toTitleCase(s);
    res.isValid = true;
    return res;
  }
}
