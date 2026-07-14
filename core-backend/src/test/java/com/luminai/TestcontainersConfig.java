package com.luminai;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.testcontainers.containers.KafkaContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Shared Testcontainers configuration for integration tests.
 *
 * <p>Spins up real PostgreSQL and Kafka containers via Docker. Spring Boot's {@code
 * ServiceConnection} annotation automatically wires the container connection details into the
 * application context — no manual {@code @DynamicPropertySource} needed.
 *
 * <p>Also provides a permissive {@link SecurityFilterChain} that replaces the production Keycloak
 * OAuth2 config, allowing tests to call endpoints without JWTs.
 */
@TestConfiguration(proxyBeanMethods = false)
@EnableWebSecurity
public class TestcontainersConfig {

  // ── PostgreSQL ──────────────────────────────────────────────────────
  @Bean
  @ServiceConnection
  PostgreSQLContainer<?> postgresContainer() {
    return new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"))
        .withDatabaseName("luminai_test")
        .withUsername("test")
        .withPassword("test");
  }

  // ── Kafka ───────────────────────────────────────────────────────────
  @Bean
  @ServiceConnection
  KafkaContainer kafkaContainer() {
    return new KafkaContainer(DockerImageName.parse("confluentinc/cp-kafka:7.6.1"));
  }

  // ── Security — permit all (replaces production Keycloak/OAuth2) ────
  @Bean
  SecurityFilterChain testSecurityFilterChain(HttpSecurity http) throws Exception {
    http.csrf(csrf -> csrf.disable()).authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
    return http.build();
  }
}
