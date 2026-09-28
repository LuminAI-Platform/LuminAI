package com.luminai.auth.dto;

import java.time.Instant;
import java.util.UUID;

public record ApiKeyDto(
    UUID id,
    String name,
    String keyPrefix,
    Instant createdAt,
    Instant lastUsedAt,
    boolean isActive) {}
