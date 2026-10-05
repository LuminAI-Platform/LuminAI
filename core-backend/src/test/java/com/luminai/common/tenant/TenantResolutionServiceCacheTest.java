package com.luminai.common.tenant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.luminai.auth.model.Tenant;
import com.luminai.auth.model.User;
import com.luminai.auth.repository.UserRepository;
import com.luminai.config.CacheConfig;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.junit.jupiter.SpringExtension;

@ExtendWith(SpringExtension.class)
@ContextConfiguration(classes = {TenantResolutionServiceCacheTest.TestCacheConfig.class})
class TenantResolutionServiceCacheTest {

  @Configuration
  @EnableCaching
  static class TestCacheConfig {
    @Bean
    public UserRepository userRepository() {
      return Mockito.mock(UserRepository.class);
    }

    @Bean
    public TenantResolutionService tenantResolutionService(UserRepository userRepository) {
      return new TenantResolutionService(userRepository);
    }

    @Bean
    public CacheManager cacheManager() {
      return new ConcurrentMapCacheManager(CacheConfig.CACHE_TENANT_RESOLUTION);
    }
  }

  @Autowired private TenantResolutionService svc;
  @Autowired private UserRepository userRepository;
  @Autowired private CacheManager cacheManager;

  @Test
  @DisplayName("evaluates cache SpEL condition without SpelEvaluationException when user is found")
  void cachesResolvedTenantWithoutSpelErrors() {
    UUID tenantId = UUID.randomUUID();
    Tenant tenant = new Tenant(tenantId, "Acme", "acme", "active");
    User user =
        new User(UUID.randomUUID(), "kc-test", "test@acme.com", "Test User", tenant, "ADMIN", true);
    when(userRepository.findByKeycloakId("kc-test")).thenReturn(Optional.of(user));

    Optional<TenantResolutionService.ResolvedTenant> first = svc.resolveForKeycloakUser("kc-test");
    assertThat(first).isPresent();
    assertThat(first.get().slug()).isEqualTo("acme");

    // Second call should hit the cache and not query repository again
    Optional<TenantResolutionService.ResolvedTenant> second = svc.resolveForKeycloakUser("kc-test");
    assertThat(second).isPresent();
    assertThat(second.get().slug()).isEqualTo("acme");

    verify(userRepository, times(1)).findByKeycloakId("kc-test");
  }

  @Test
  @DisplayName("does not cache empty result and does not throw SpelEvaluationException")
  void doesNotCacheEmptyResult() {
    when(userRepository.findByKeycloakId("kc-empty")).thenReturn(Optional.empty());

    Optional<TenantResolutionService.ResolvedTenant> first = svc.resolveForKeycloakUser("kc-empty");
    assertThat(first).isEmpty();

    Optional<TenantResolutionService.ResolvedTenant> second =
        svc.resolveForKeycloakUser("kc-empty");
    assertThat(second).isEmpty();

    // Because empty is not cached (unless = "#result == null"), it queries each time
    verify(userRepository, times(2)).findByKeycloakId("kc-empty");
  }
}
