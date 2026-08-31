package com.luminai.explorer.dto;

import java.time.Instant;
import java.util.UUID;

public record ProvenanceItem(
    String fieldName,
    UUID sourceRecordId,
    String sourceName,
    Object contributedValue,
    String action,
    Instant occurredAt) {}
