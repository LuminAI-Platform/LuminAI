package com.luminai.config;

import com.luminai.common.tenant.TenantIdentifierResolver;
import org.hibernate.cfg.AvailableSettings;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MultiTenancyConfig {

  @Bean
  HibernatePropertiesCustomizer multiTenancyCustomizer(
          com.luminai.common.tenant.MultiTenantConnectionProvider provider,
          TenantIdentifierResolver resolver) {

    return props -> {
      props.put(
              AvailableSettings.MULTI_TENANT_CONNECTION_PROVIDER,
              provider);
    };
  }
}