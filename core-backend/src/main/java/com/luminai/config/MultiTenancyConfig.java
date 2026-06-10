package com.luminai.config;

import com.luminai.common.tenant.TenantIdentifierResolver;
import org.hibernate.cfg.AvailableSettings;
import org.hibernate.context.spi.CurrentTenantIdentifierResolver;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Map;

/**
 * Configures Hibernate multi-tenancy in SCHEMA mode.
 * Wires the {@link TenantIdentifierResolver} so Hibernate sets the correct
 * PostgreSQL search_path for each request automatically.
 */
@Configuration
public class MultiTenancyConfig {

    @Autowired
    private TenantIdentifierResolver tenantIdentifierResolver;

    @Bean
    public HibernatePropertiesCustomizer hibernatePropertiesCustomizer() {
        return hibernateProperties -> hibernateProperties.putAll(Map.of(
            AvailableSettings.MULTI_TENANT_IDENTIFIER_RESOLVER,
                tenantIdentifierResolver
        ));
    }
}
