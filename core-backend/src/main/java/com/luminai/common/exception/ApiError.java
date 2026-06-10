package com.luminai.common.exception;

import java.time.Instant;
import java.util.List;

/**
 * Standard error response structure for all API errors.
 * Returned by GlobalExceptionHandler for consistent JSON error payloads.
 */
public record ApiError(
    Instant timestamp,
    int status,
    String error,
    String message,
    String path,
    List<FieldError> fieldErrors
) {
    public record FieldError(String field, String message) {}
}
