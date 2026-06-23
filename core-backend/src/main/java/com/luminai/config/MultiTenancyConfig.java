package com.luminai.config;

import com.luminai.common.tenant.TenantIdentifierResolver;
import java.util.Map;
import org.hibernate.cfg.AvailableSettings;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Configures Hibernate multi-tenancy in SCHEMA mode. Wires the {@link TenantIdentifierResolver} so
 * Hibernate sets the correct PostgreSQL search_path for each request automatically.
 */
@Configuration
public class MultiTenancyConfig {

  @Autowired private TenantIdentifierResolver tenantIdentifierResolver;

  @Bean
  public HibernatePropertiesCustomizer hibernatePropertiesCustomizer() {
    return hibernateProperties ->
        hibernateProperties.putAll(
            Map.of(AvailableSettings.MULTI_TENANT_IDENTIFIER_RESOLVER, tenantIdentifierResolver));
  }
}
