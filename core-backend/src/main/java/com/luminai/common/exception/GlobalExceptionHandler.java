package com.luminai.common.exception;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.ValidationException;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/** Global REST exception handler producing standardized JSON error structures (MVP-06). */
@RestControllerAdvice
public class GlobalExceptionHandler {

  private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ApiError> handleMethodArgumentNotValid(
      MethodArgumentNotValidException ex, HttpServletRequest request) {
    List<ApiError.FieldError> fieldErrors =
        ex.getBindingResult().getFieldErrors().stream()
            .map(fe -> new ApiError.FieldError(fe.getField(), fe.getDefaultMessage()))
            .toList();

    return ResponseEntity.badRequest().body(ApiError.ofValidation(fieldErrors, getPath(request)));
  }

  @ExceptionHandler(ConstraintViolationException.class)
  public ResponseEntity<ApiError> handleConstraintViolation(
      ConstraintViolationException ex, HttpServletRequest request) {
    List<ApiError.FieldError> fieldErrors =
        ex.getConstraintViolations().stream()
            .map(
                cv -> {
                  String field = cv.getPropertyPath().toString();
                  return new ApiError.FieldError(field, cv.getMessage());
                })
            .toList();

    return ResponseEntity.badRequest().body(ApiError.ofValidation(fieldErrors, getPath(request)));
  }

  @ExceptionHandler(ValidationException.class)
  public ResponseEntity<ApiError> handleValidationException(
      ValidationException ex, HttpServletRequest request) {
    return ResponseEntity.badRequest()
        .body(ApiError.of(400, "VALIDATION_FAILED", ex.getMessage(), getPath(request)));
  }

  @ExceptionHandler(MissingServletRequestParameterException.class)
  public ResponseEntity<ApiError> handleMissingRequestParameter(
      MissingServletRequestParameterException ex, HttpServletRequest request) {
    return ResponseEntity.badRequest()
        .body(
            ApiError.of(
                400,
                "BAD_REQUEST",
                String.format("Required query parameter '%s' is missing", ex.getParameterName()),
                getPath(request)));
  }

  @ExceptionHandler(MethodArgumentTypeMismatchException.class)
  public ResponseEntity<ApiError> handleArgumentTypeMismatch(
      MethodArgumentTypeMismatchException ex, HttpServletRequest request) {
    return ResponseEntity.badRequest()
        .body(
            ApiError.of(
                400,
                "BAD_REQUEST",
                String.format("Invalid parameter value for '%s'", ex.getName()),
                getPath(request)));
  }

  @ExceptionHandler(IllegalArgumentException.class)
  public ResponseEntity<ApiError> handleIllegalArgument(
      IllegalArgumentException ex, HttpServletRequest request) {
    return ResponseEntity.badRequest()
        .body(ApiError.of(400, "BAD_REQUEST", ex.getMessage(), getPath(request)));
  }

  @ExceptionHandler(IllegalStateException.class)
  public ResponseEntity<ApiError> handleIllegalState(
      IllegalStateException ex, HttpServletRequest request) {
    log.warn("Illegal state: {}", ex.getMessage());
    return ResponseEntity.badRequest()
        .body(ApiError.of(400, "BAD_REQUEST", ex.getMessage(), getPath(request)));
  }

  @ExceptionHandler(HttpMessageNotReadableException.class)
  public ResponseEntity<ApiError> handleHttpMessageNotReadable(
      HttpMessageNotReadableException ex, HttpServletRequest request) {
    return ResponseEntity.badRequest()
        .body(
            ApiError.of(
                400,
                "BAD_REQUEST",
                "Required request body is missing or malformed JSON",
                getPath(request)));
  }

  @ExceptionHandler(AuthenticationException.class)
  public ResponseEntity<ApiError> handleAuthenticationException(
      AuthenticationException ex, HttpServletRequest request) {
    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
        .body(
            ApiError.of(
                401,
                "UNAUTHORIZED",
                "Authentication credentials are required or invalid",
                getPath(request)));
  }

  @ExceptionHandler(AccessDeniedException.class)
  public ResponseEntity<ApiError> handleAccessDenied(
      AccessDeniedException ex, HttpServletRequest request) {
    return ResponseEntity.status(HttpStatus.FORBIDDEN)
        .body(
            ApiError.of(
                403,
                "FORBIDDEN",
                "You do not have permission to access this resource",
                getPath(request)));
  }

  @ExceptionHandler({ResourceNotFoundException.class, EntityNotFoundException.class})
  public ResponseEntity<ApiError> handleResourceNotFound(
      ResourceNotFoundException ex, HttpServletRequest request) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .body(ApiError.of(404, "NOT_FOUND", ex.getMessage(), getPath(request)));
  }

  @ExceptionHandler(ConflictException.class)
  public ResponseEntity<ApiError> handleConflict(ConflictException ex, HttpServletRequest request) {
    return ResponseEntity.status(HttpStatus.CONFLICT)
        .body(ApiError.of(409, "CONFLICT", ex.getMessage(), getPath(request)));
  }

  @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
  public ResponseEntity<ApiError> handleDataIntegrityViolation(
      org.springframework.dao.DataIntegrityViolationException ex, HttpServletRequest request) {
    log.warn("Data integrity violation on path '{}': {}", getPath(request), ex.getMessage());
    return ResponseEntity.status(HttpStatus.CONFLICT)
        .body(
            ApiError.of(
                409,
                "CONFLICT",
                "Data integrity violation: constraint was violated or referenced resource does not exist",
                getPath(request)));
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ApiError> handleGeneral(Exception ex, HttpServletRequest request) {
    log.error("Unhandled exception on path '{}': {}", getPath(request), ex.getMessage(), ex);
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(
            ApiError.of(
                500,
                "INTERNAL_SERVER_ERROR",
                "An unexpected internal server error occurred",
                getPath(request)));
  }

  private String getPath(HttpServletRequest request) {
    return request != null ? request.getRequestURI() : null;
  }
}
