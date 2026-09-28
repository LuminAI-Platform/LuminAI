package com.luminai.common.exception;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Standardized API Error response schema across all LuminAI backend REST endpoints (MVP-06).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiError(
    int status,
    String error,
    String message,
    @JsonFormat(shape = JsonFormat.Shape.STRING)
    Instant timestamp,
    String path,
    String correlationId,
    Object details,
    List<FieldError> fieldErrors) {

  public record FieldError(String field, String message) {}

  public static ApiError of(int status, String error, String message, String path, String correlationId) {
    return new ApiError(
        status,
        error,
        message,
        Instant.now(),
        path,
        correlationId != null ? correlationId : UUID.randomUUID().toString(),
        null,
        null);
  }

  public static ApiError of(int status, String error, String message, String path) {
    return of(status, error, message, path, UUID.randomUUID().toString());
  }

  public static ApiError of(int status, String error, String message) {
    return of(status, error, message, null, UUID.randomUUID().toString());
  }

  public static ApiError ofValidation(List<FieldError> fieldErrors, String path) {
    return new ApiError(
        400,
        "VALIDATION_FAILED",
        "Validation failed for one or more fields",
        Instant.now(),
        path,
        UUID.randomUUID().toString(),
        fieldErrors,
        fieldErrors);
  }

  public static ApiError ofValidation(List<FieldError> fieldErrors) {
    return ofValidation(fieldErrors, null);
  }
}
