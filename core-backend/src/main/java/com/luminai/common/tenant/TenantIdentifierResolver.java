package com.luminai.common.tenant;

import org.hibernate.context.spi.CurrentTenantIdentifierResolver;
import org.springframework.stereotype.Component;

/**
 * Hibernate SPI that tells Hibernate which schema to use for the current request.
 * Reads the tenant ID from {@link TenantContext}, which is set by {@link TenantFilter}.
 *
 * <p>Returns {@code "public"} as a fallback for system-level operations (e.g. Flyway
 * migrations, actuator health checks) that run without a tenant context.
 */
@Component
public class TenantIdentifierResolver implements CurrentTenantIdentifierResolver<String> {

    private static final String DEFAULT_TENANT = "public";

    @Override
    public String resolveCurrentTenantIdentifier() {
        String tenantId = TenantContext.getCurrentTenant();
        return (tenantId != null && !tenantId.isBlank()) ? tenantId : DEFAULT_TENANT;
    }

    @Override
    public boolean validateExistingCurrentSessions() {
        return true;
    }
}
