package com.luminai.common.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/** Exception thrown when a requested platform entity or record does not exist. */
@ResponseStatus(HttpStatus.NOT_FOUND)
public class EntityNotFoundException extends ResourceNotFoundException {

  public EntityNotFoundException(String entityId) {
    super("Entity", entityId);
  }

  public EntityNotFoundException(String entityType, String entityId) {
    super(entityType, entityId);
  }
}
