package com.luminai.config;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Configures Spring Security as a stateless OAuth2 Resource Server. JWTs are issued by Keycloak and
 * validated on every request. Supports sandbox/mock tokens for live development and preview
 * environments.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@Profile("!test")
public class SecurityConfig {

  @Value("${spring.security.oauth2.resourceserver.jwt.jwk-set-uri:#{null}}")
  private String jwkSetUri;

  @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri:#{null}}")
  private String issuerUri;

  @Bean
  public SecurityFilterChain securityFilterChain(
      HttpSecurity http,
      com.luminai.auth.security.ApiKeyAuthenticationFilter apiKeyAuthFilter,
      com.luminai.common.tenant.TenantFilter tenantFilter)
      throws Exception {
    http.cors(cors -> cors.configurationSource(corsConfigurationSource()))
        .csrf(csrf -> csrf.disable()) // Stateless JWT — no CSRF needed
        .sessionManagement(
            session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(
            auth ->
                auth.requestMatchers(
                        "/actuator/health",
                        "/actuator/info",
                        "/v3/api-docs/**",
                        "/swagger-ui/**",
                        "/swagger-ui.html",
                        "/error")
                    .permitAll()
                    .anyRequest()
                    .authenticated())
        .addFilterBefore(
            apiKeyAuthFilter,
            org.springframework.security.oauth2.server.resource.web.authentication
                .BearerTokenAuthenticationFilter.class)
        .addFilterAfter(
            tenantFilter,
            org.springframework.security.oauth2.server.resource.web.authentication
                .BearerTokenAuthenticationFilter.class)
        .oauth2ResourceServer(
            oauth2 -> {
              DefaultBearerTokenResolver defaultResolver = new DefaultBearerTokenResolver();
              defaultResolver.setAllowUriQueryParameter(true);
              oauth2.bearerTokenResolver(
                  request -> {
                    String token = defaultResolver.resolve(request);
                    if (token != null) {
                      return token;
                    }
                    // Support ?token= query parameter sent by browser EventSource (SSE)
                    String queryToken = request.getParameter("token");
                    if (queryToken != null && !queryToken.isBlank()) {
                      return queryToken;
                    }
                    return null;
                  });
              oauth2.jwt(
                  jwt ->
                      jwt.jwtAuthenticationConverter(jwtAuthenticationConverter())
                          .decoder(jwtDecoder()));
            })
        .headers(
            headers ->
                headers
                    .contentSecurityPolicy(
                        csp ->
                            csp.policyDirectives(
                                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
                                    + "img-src 'self' data: blob:; connect-src 'self' http://localhost:* ws://localhost:*; "
                                    + "frame-ancestors 'none';"))
                    .frameOptions(frame -> frame.deny()));

    return http.build();
  }

  @Bean
  public org.springframework.boot.web.servlet.FilterRegistrationBean<
          com.luminai.common.tenant.TenantFilter>
      tenantFilterRegistration(com.luminai.common.tenant.TenantFilter filter) {
    org.springframework.boot.web.servlet.FilterRegistrationBean<
            com.luminai.common.tenant.TenantFilter>
        registration = new org.springframework.boot.web.servlet.FilterRegistrationBean<>(filter);
    registration.setEnabled(false);
    return registration;
  }

  @Bean
  public org.springframework.boot.web.servlet.FilterRegistrationBean<
          com.luminai.auth.security.ApiKeyAuthenticationFilter>
      apiKeyAuthFilterRegistration(com.luminai.auth.security.ApiKeyAuthenticationFilter filter) {
    org.springframework.boot.web.servlet.FilterRegistrationBean<
            com.luminai.auth.security.ApiKeyAuthenticationFilter>
        registration = new org.springframework.boot.web.servlet.FilterRegistrationBean<>(filter);
    registration.setEnabled(false);
    return registration;
  }

  @Value("${luminai.security.allow-mock-tokens:false}")
  private boolean allowMockTokens;

  @Value("${spring.profiles.active:}")
  private String activeProfiles;

  @org.springframework.beans.factory.annotation.Autowired(required = false)
  private org.springframework.core.env.Environment environment;

  private final java.util.concurrent.atomic.AtomicReference<JwtDecoder> cachedDecoder =
      new java.util.concurrent.atomic.AtomicReference<>();

  private JwtDecoder resolveDecoder() {
    JwtDecoder existing = cachedDecoder.get();
    if (existing != null) {
      return existing;
    }
    synchronized (cachedDecoder) {
      existing = cachedDecoder.get();
      if (existing != null) {
        return existing;
      }
      JwtDecoder created = null;
      try {
        if (jwkSetUri != null && !jwkSetUri.isBlank()) {
          created = NimbusJwtDecoder.withJwkSetUri(jwkSetUri).build();
        } else if (issuerUri != null && !issuerUri.isBlank()) {
          created = NimbusJwtDecoder.withIssuerLocation(issuerUri).build();
        }
      } catch (Exception e) {
        org.slf4j.LoggerFactory.getLogger(SecurityConfig.class)
            .warn("Could not lazily initialize NimbusJwtDecoder: {}", e.getMessage());
      }
      if (created != null) {
        cachedDecoder.set(created);
      }
      return created;
    }
  }

  @Bean
  public JwtDecoder jwtDecoder() {
    return token -> {
      if (token == null || token.isBlank()) {
        throw new org.springframework.security.oauth2.jwt.BadJwtException(
            "Missing or blank JWT token");
      }

      boolean isMockCandidate =
          token.startsWith("mock-")
              || token.contains("sandbox")
              || "mock-access-token-123".equals(token);

      boolean isDevProfile =
          (activeProfiles != null
                  && (activeProfiles.contains("dev")
                      || activeProfiles.contains("local")
                      || activeProfiles.contains("test")))
              || (environment != null
                  && environment.acceptsProfiles(
                      org.springframework.core.env.Profiles.of("dev", "local", "test")));

      if (isMockCandidate && (allowMockTokens || isDevProfile)) {
        String sub = "sandbox-admin-id";
        String email = "admin@luminai.dev";
        String username = "admin";
        if (token.contains("acme")) {
          sub = "sandbox-acme-id";
          email = "alice@acme.com";
          username = "alice.acme";
        }
        return Jwt.withTokenValue(token)
            .header("alg", "none")
            .header("typ", "JWT")
            .claim("sub", sub)
            .claim("preferred_username", username)
            .claim("email", email)
            .claim(
                "realm_access",
                Map.of(
                    "roles", List.of("admin", "user", "TENANT_ADMIN", "PLATFORM_ADMIN", "ADMIN")))
            .issuedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(86400))
            .build();
      }

      JwtDecoder delegate = resolveDecoder();
      if (delegate == null) {
        throw new org.springframework.security.oauth2.jwt.BadJwtException(
            "OAuth2 JWT decoder not configured or Keycloak JWKS endpoint is unreachable");
      }

      return delegate.decode(token);
    };
  }

  @Bean
  public JwtAuthenticationConverter jwtAuthenticationConverter() {
    JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
    converter.setPrincipalClaimName("preferred_username");
    converter.setJwtGrantedAuthoritiesConverter(new KeycloakRoleConverter());
    return converter;
  }

  @Bean
  public CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration config = new CorsConfiguration();
    String envOrigins = System.getenv("CORS_ALLOWED_ORIGINS");
    if (envOrigins != null && !envOrigins.isBlank()) {
      config.setAllowedOriginPatterns(List.of(envOrigins.split(",")));
    } else {
      config.setAllowedOriginPatterns(
          List.of(
              "http://localhost:*",
              "http://127.0.0.1:*",
              "https://*.luminai.com",
              "https://*.luminai.dev"));
    }
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
    config.setAllowedHeaders(List.of("*"));
    config.setAllowCredentials(true);
    config.setMaxAge(3600L);
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", config);
    return source;
  }
}
