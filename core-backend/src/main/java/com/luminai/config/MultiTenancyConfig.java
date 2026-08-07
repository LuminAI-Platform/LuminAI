package com.luminai.config;

import com.luminai.common.tenant.MultiTenantConnectionProvider;
import com.luminai.common.tenant.TenantIdentifierResolver;
import org.hibernate.cfg.AvailableSettings;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MultiTenancyConfig {

  private static final Logger log = LoggerFactory.getLogger(MultiTenancyConfig.class);

  @Bean
  public HibernatePropertiesCustomizer multiTenancyCustomizer(
      MultiTenantConnectionProvider provider, TenantIdentifierResolver resolver) {

    return properties -> {
      properties.put(AvailableSettings.MULTI_TENANT_CONNECTION_PROVIDER, provider);

      properties.put(AvailableSettings.MULTI_TENANT_IDENTIFIER_RESOLVER, resolver);

      log.info("Registered Hibernate MultiTenantConnectionProvider");
      log.info("Registered Hibernate TenantIdentifierResolver");
    };
  }
}
