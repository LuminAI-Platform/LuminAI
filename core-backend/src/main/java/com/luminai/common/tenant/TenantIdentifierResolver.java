package com.luminai.common.tenant;

import java.util.Map;
import org.hibernate.cfg.AvailableSettings;
import org.hibernate.context.spi.CurrentTenantIdentifierResolver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.stereotype.Component;

@Component
public class TenantIdentifierResolver
    implements CurrentTenantIdentifierResolver<String>, HibernatePropertiesCustomizer {

  private static final Logger log = LoggerFactory.getLogger(TenantIdentifierResolver.class);

  // Returns the schema identifier for the current thread's tenant.
  @Override
  public String resolveCurrentTenantIdentifier() {
    String schema = TenantContext.getCurrentSchema();
    log.trace("Resolved tenant schema: {}", schema);
    return schema;
  }

  // Indicates whether Hibernate should validate that a session was opened with the same tenant
  // identifier that is currently active.
  @Override
  public boolean validateExistingCurrentSessions() {
    return true;
  }

  // Self-registers this resolver into Hibernate's property map via Spring Boot's {@link
  // HibernatePropertiesCustomizer} contract.
  @Override
  public void customize(Map<String, Object> hibernateProperties) {
    hibernateProperties.put(AvailableSettings.MULTI_TENANT_IDENTIFIER_RESOLVER, this);
    log.debug("TenantIdentifierResolver registered into Hibernate properties");
  }
}
