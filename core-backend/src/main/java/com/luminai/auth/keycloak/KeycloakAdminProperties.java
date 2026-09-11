package com.luminai.auth.keycloak;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuration for the confidential Keycloak client LuminAI uses to provision users via Keycloak's
 * Admin REST API. This is a service-account client with the realm-management {@code manage-users}
 * role — distinct from the public client end users authenticate through.
 *
 * <pre>
 * luminai:
 *   keycloak:
 *     base-url: https://auth.example.com
 *     realm: luminai
 *     admin-client-id: luminai-admin-cli
 *     admin-client-secret: ${KEYCLOAK_ADMIN_CLIENT_SECRET}
 * </pre>
 */
@ConfigurationProperties(prefix = "luminai.keycloak")
public record KeycloakAdminProperties(
    String baseUrl, String realm, String adminClientId, String adminClientSecret) {}
