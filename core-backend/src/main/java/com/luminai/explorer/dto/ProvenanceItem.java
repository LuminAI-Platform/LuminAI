package com.luminai.explorer.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ProvenanceItem(
    String fieldName,
    UUID sourceRecordId,
    String sourceName,
    Object contributedValue,
    String action,
    Instant occurredAt,
    String confidence) {

  public ProvenanceItem(
      String fieldName,
      UUID sourceRecordId,
      String sourceName,
      Object contributedValue,
      String action,
      Instant occurredAt) {
    this(fieldName, sourceRecordId, sourceName, contributedValue, action, occurredAt, "high");
  }
}
