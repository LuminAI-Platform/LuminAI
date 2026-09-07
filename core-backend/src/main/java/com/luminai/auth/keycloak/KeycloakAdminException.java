package com.luminai.auth.keycloak;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Thrown when Keycloak's Admin REST API can't be reached or returns an unexpected error. Mapped
 * to 502 — the failure is in an upstream system, not in the caller's request (a 409 for a
 * duplicate user is handled separately, see {@link KeycloakAdminClient}).
 */
@ResponseStatus(HttpStatus.BAD_GATEWAY)
public class KeycloakAdminException extends RuntimeException {

    public KeycloakAdminException(String message) {
        super(message);
    }

    public KeycloakAdminException(String message, Throwable cause) {
        super(message, cause);
    }
}
