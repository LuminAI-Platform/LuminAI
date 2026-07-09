package com.luminai.common.exception;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.LocalDateTime;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiError(
    int status,
    String error,
    String message,
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss")
        LocalDateTime timestamp,
    List<FieldError> fieldErrors) {
  public record FieldError(String field, String message) {}

  public static ApiError of(int status, String error, String message) {
    return new ApiError(status, error, message, LocalDateTime.now(), null);
  }

  public static ApiError ofValidation(List<FieldError> fieldErrors) {
    return new ApiError(400, "Bad Request", "Validation failed", LocalDateTime.now(), fieldErrors);
  }
}
