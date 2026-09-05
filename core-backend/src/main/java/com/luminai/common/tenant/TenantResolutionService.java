package com.luminai.common.tenant;

import com.luminai.auth.model.Tenant;
import com.luminai.auth.model.User;
import com.luminai.auth.repository.UserRepository;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * Resolves the current request's tenant the way the database (not the JWT) says it should be
 * resolved:
 *
 * <pre>
 * Keycloak JWT.sub  -->  public.users.keycloak_id  -->  public.users.tenant_id
 *                   -->  public.tenants.id          -->  public.tenants.slug
 * </pre>
 *
 * <p>Keycloak is only responsible for authenticating <em>who</em> the caller is. LuminAI alone
 * decides <em>which tenant</em> that caller belongs to, by looking up {@code public.users}. A
 * {@code tenant_id} claim on the JWT is never consulted.
 */
@Service
public class TenantResolutionService {

    private static final Logger log = LoggerFactory.getLogger(TenantResolutionService.class);

    private final UserRepository userRepository;

    public TenantResolutionService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * Resolves the tenant for the LuminAI user linked to the given Keycloak {@code sub}.
     *
     * @param keycloakId the {@code sub} claim of the authenticated JWT.
     * @return the resolved tenant, or {@link Optional#empty()} if there is no matching user, the
     *     user is deactivated, or the user's tenant is not active. Callers must treat all of these
     *     as "reject the request" — none of them fall back to a default tenant.
     */
    @Transactional(readOnly = true)
    public Optional<ResolvedTenant> resolveForKeycloakUser(String keycloakId) {
        if (!StringUtils.hasText(keycloakId)) {
            log.warn("Cannot resolve tenant: JWT has no 'sub' claim");
            return Optional.empty();
        }

        Optional<User> user = userRepository.findByKeycloakId(keycloakId);
        if (user.isEmpty()) {
            log.warn("No LuminAI user found for Keycloak subject '{}'", keycloakId);
            return Optional.empty();
        }

        User u = user.get();
        if (!u.isActive()) {
            log.warn("User '{}' (keycloak_id={}) is deactivated", u.getId(), keycloakId);
            return Optional.empty();
        }

        Tenant tenant = u.getTenant();
        if (tenant == null || !tenant.isActive()) {
            log.warn(
                    "User '{}' (keycloak_id={}) has no active tenant (tenant status={})",
                    u.getId(),
                    keycloakId,
                    tenant != null ? tenant.getStatus() : "none");
            return Optional.empty();
        }

        return Optional.of(new ResolvedTenant(tenant.getId(), tenant.getSlug()));
    }

    /** The result of a tenant resolution: the tenant's primary key and its schema slug. */
    public record ResolvedTenant(UUID tenantId, String slug) {}
}
