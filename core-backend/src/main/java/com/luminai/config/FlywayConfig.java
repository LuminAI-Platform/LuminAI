package com.luminai.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Custom Flyway migration strategy ensuring that historical migration checksums are repaired before
 * migration runs, preventing deployment failures caused by checksum mismatches across environments
 * or historical script adjustments.
 */
@Configuration
public class FlywayConfig {

  private static final Logger log = LoggerFactory.getLogger(FlywayConfig.class);

  @Bean
  @ConditionalOnProperty(
      name = "spring.flyway.enabled",
      havingValue = "true",
      matchIfMissing = true)
  public FlywayMigrationStrategy flywayMigrationStrategy() {
    return flyway -> {
      log.info("Running Flyway repair to align historical migration checksums...");
      flyway.repair();
      log.info("Executing Flyway migration...");
      flyway.migrate();
    };
  }
}
