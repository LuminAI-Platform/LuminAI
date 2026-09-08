package com.luminai.auth.keycloak;

import com.luminai.common.exception.ConflictException;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

/**
 * Talks to Keycloak's Admin REST API to provision the Keycloak side of a LuminAI account.
 *
 * <p>This is deliberately a thin, direct-HTTP client (via Spring's {@link RestClient}) rather than
 * the {@code keycloak-admin-client} library, to avoid pulling in its RESTEasy/Jakarta REST client
 * dependency chain alongside Spring MVC. Keycloak's Admin API is small enough that wrapping the two
 * calls we need directly keeps the dependency footprint minimal.
 *
 * <p>Authenticates as a confidential "service account" client with the realm-management {@code
 * manage-users} role — see {@link KeycloakAdminProperties}. This is separate from, and has nothing
 * to do with, the public client end users authenticate through.
 */
@Component
@EnableConfigurationProperties(KeycloakAdminProperties.class)
public class KeycloakAdminClient {

  private static final Logger log = LoggerFactory.getLogger(KeycloakAdminClient.class);

  private final KeycloakAdminProperties properties;
  private final RestClient restClient;

  public KeycloakAdminClient(KeycloakAdminProperties properties, RestClient.Builder builder) {
    this.properties = properties;
    this.restClient = builder.baseUrl(properties.baseUrl()).build();
  }

  /**
   * Creates a Keycloak account for a new LuminAI user, with no password set. The account is left
   * with {@code UPDATE_PASSWORD} and {@code VERIFY_EMAIL} required actions so the person sets their
   * own credentials via the email Keycloak sends — LuminAI never generates or transmits a password
   * itself.
   *
   * @return the new user's Keycloak ID. This is the same value Keycloak will later put in the
   *     {@code sub} claim of that user's JWTs, and is what gets stored as {@code
   *     public.users.keycloak_id}.
   * @throws ConflictException if a Keycloak user with this email/username already exists.
   * @throws KeycloakAdminException on any other failure to reach or use the Admin API.
   */
  public String createUser(String email, String fullName) {
    String adminToken = fetchAdminAccessToken();

    Map<String, Object> body =
        Map.of(
            "username",
            email,
            "email",
            email,
            "firstName",
            firstNameOf(fullName),
            "lastName",
            lastNameOf(fullName),
            "enabled",
            true,
            "emailVerified",
            false,
            "requiredActions",
            List.of("UPDATE_PASSWORD", "VERIFY_EMAIL"));

    try {
      var response =
          restClient
              .post()
              .uri("/admin/realms/{realm}/users", properties.realm())
              .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
              .contentType(MediaType.APPLICATION_JSON)
              .body(body)
              .retrieve()
              .toBodilessEntity();

      String location = response.getHeaders().getFirst(HttpHeaders.LOCATION);
      if (location == null || location.isBlank()) {
        throw new KeycloakAdminException(
            "Keycloak did not return a Location header for the newly created user");
      }
      // Location looks like: {baseUrl}/admin/realms/{realm}/users/{id}
      return location.substring(location.lastIndexOf('/') + 1);

    } catch (RestClientResponseException e) {
      if (e.getStatusCode().value() == 409) {
        throw new ConflictException("A Keycloak user with email '" + email + "' already exists");
      }
      throw new KeycloakAdminException(
          "Keycloak rejected user creation for '"
              + email
              + "': HTTP "
              + e.getStatusCode().value()
              + " - "
              + e.getResponseBodyAsString(),
          e);
    }
  }

  /**
   * Triggers Keycloak to email the user a link to set their password (and verify their email).
   * Requires the realm's SMTP settings to be configured. This is best-effort: the LuminAI account
   * has already been created successfully by the time this runs, so a failure here is logged but
   * does not roll back user creation — ops can resend the action email from the Keycloak admin
   * console if needed.
   */
  public void sendSetPasswordEmail(String keycloakUserId) {
    String adminToken = fetchAdminAccessToken();
    try {
      restClient
          .put()
          .uri(
              uriBuilder ->
                  uriBuilder
                      .path("/admin/realms/{realm}/users/{id}/execute-actions-email")
                      .queryParamIfPresent(
                          "client_id", java.util.Optional.ofNullable(properties.adminClientId()))
                      .build(properties.realm(), keycloakUserId))
          .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
          .contentType(MediaType.APPLICATION_JSON)
          .body(List.of("UPDATE_PASSWORD"))
          .retrieve()
          .toBodilessEntity();
    } catch (Exception e) {
      log.warn(
          "Failed to send the set-password email for Keycloak user '{}'. The account was still "
              + "created — resend the action email from the Keycloak admin console. Cause: {}",
          keycloakUserId,
          e.getMessage());
    }
  }

  /** Fetches a short-lived admin access token via the client_credentials grant. */
  private String fetchAdminAccessToken() {
    MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
    form.add("grant_type", "client_credentials");
    form.add("client_id", properties.adminClientId());
    form.add("client_secret", properties.adminClientSecret());

    try {
      @SuppressWarnings("unchecked")
      Map<String, Object> tokenResponse =
          restClient
              .post()
              .uri("/realms/{realm}/protocol/openid-connect/token", properties.realm())
              .contentType(MediaType.APPLICATION_FORM_URLENCODED)
              .body(form)
              .retrieve()
              .body(Map.class);

      Object accessToken = tokenResponse != null ? tokenResponse.get("access_token") : null;
      if (accessToken == null) {
        throw new KeycloakAdminException("Keycloak token response did not contain an access_token");
      }
      return accessToken.toString();

    } catch (RestClientResponseException e) {
      throw new KeycloakAdminException(
          "Failed to authenticate LuminAI's admin service account against Keycloak: HTTP "
              + e.getStatusCode().value(),
          e);
    }
  }

  private String firstNameOf(String fullName) {
    if (fullName == null || fullName.isBlank()) {
      return "";
    }
    String trimmed = fullName.trim();
    int spaceIdx = trimmed.indexOf(' ');
    return spaceIdx > 0 ? trimmed.substring(0, spaceIdx) : trimmed;
  }

  private String lastNameOf(String fullName) {
    if (fullName == null || fullName.isBlank()) {
      return "";
    }
    String trimmed = fullName.trim();
    int spaceIdx = trimmed.indexOf(' ');
    return spaceIdx > 0 ? trimmed.substring(spaceIdx + 1).trim() : "";
  }
}
