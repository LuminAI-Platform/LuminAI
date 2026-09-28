package com.luminai.auth.dto;

import java.time.Instant;
import java.util.UUID;

public record ApiKeyRotateResponse(
    UUID id, String apiKey, String keyPrefix, String name, Instant createdAt) {}
