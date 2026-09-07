package com.luminai.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.util.UUID;

public class UserDto {

    private UserDto() {}

    // ----------------------------------------------------------------
    // Request DTOs
    // ----------------------------------------------------------------

    /** Request body for internally provisioning a new LuminAI user (and their Keycloak account). */
    public record CreateUserRequest(
            @NotBlank(message = "tenantSlug is required")
            @Pattern(
                    regexp = "^[a-z0-9-]+$",
                    message = "tenantSlug must be lowercase letters, numbers, and hyphens only")
            String tenantSlug,
            @NotBlank(message = "email is required") @Email(message = "email must be a valid address")
            String email,
            String fullName,
            String role) {}

    // ----------------------------------------------------------------
    // Response DTOs
    // ----------------------------------------------------------------

    /** Response returned after successfully provisioning a new LuminAI user. */
    public record CreateUserResponse(
            UUID userId,
            UUID tenantId,
            String tenantSlug,
            String keycloakId,
            String email,
            String role,
            String message) {}
}
