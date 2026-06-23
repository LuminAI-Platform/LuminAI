package com.luminai.common.exception;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Centralised exception handler — ensures all API errors return a consistent {@link ApiError} JSON
 * structure. Raw stack traces never leak to clients.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

  // 400 — Validation errors (bean validation via @Valid)
  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ApiError> handleValidation(
      MethodArgumentNotValidException ex, HttpServletRequest request) {

    List<ApiError.FieldError> fieldErrors =
        ex.getBindingResult().getFieldErrors().stream()
            .map(fe -> new ApiError.FieldError(fe.getField(), fe.getDefaultMessage()))
            .toList();

    ApiError error =
        new ApiError(
            Instant.now(),
            HttpStatus.BAD_REQUEST.value(),
            "Validation Failed",
            "One or more fields have invalid values",
            request.getRequestURI(),
            fieldErrors);
    return ResponseEntity.badRequest().body(error);
  }

  // 404 — Resource not found
  @ExceptionHandler(ResourceNotFoundException.class)
  public ResponseEntity<ApiError> handleNotFound(
      ResourceNotFoundException ex, HttpServletRequest request) {

    ApiError error =
        new ApiError(
            Instant.now(),
            HttpStatus.NOT_FOUND.value(),
            "Not Found",
            ex.getMessage(),
            request.getRequestURI(),
            List.of());
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
  }

  // 403 — Access denied (Spring Security)
  @ExceptionHandler(AccessDeniedException.class)
  public ResponseEntity<ApiError> handleAccessDenied(
      AccessDeniedException ex, HttpServletRequest request) {

    ApiError error =
        new ApiError(
            Instant.now(),
            HttpStatus.FORBIDDEN.value(),
            "Forbidden",
            "You do not have permission to access this resource",
            request.getRequestURI(),
            List.of());
    return ResponseEntity.status(HttpStatus.FORBIDDEN).body(error);
  }

  // 500 — Catch-all for unhandled exceptions
  @ExceptionHandler(Exception.class)
  public ResponseEntity<ApiError> handleGeneric(Exception ex, HttpServletRequest request) {

    ApiError error =
        new ApiError(
            Instant.now(),
            HttpStatus.INTERNAL_SERVER_ERROR.value(),
            "Internal Server Error",
            "An unexpected error occurred. Please try again later.",
            request.getRequestURI(),
            List.of());
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
  }
}
