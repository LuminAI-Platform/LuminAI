package com.luminai.explorer.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.luminai.common.security.JwtClaimsExtractor;
import com.luminai.common.tenant.TenantContext;
import com.luminai.config.CacheConfig;
import com.luminai.connection.model.GoldenRecord;
import com.luminai.connection.repository.GoldenRecordRepository;
import com.luminai.explorer.dto.SearchResponseDto;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.SimpleTransactionStatus;

@SpringJUnitConfig(classes = ExplorerSearchServiceProxyTest.ProxyTestConfig.class)
class ExplorerSearchServiceProxyTest {

  @Configuration
  @EnableTransactionManagement
  @EnableCaching
  static class ProxyTestConfig {
    @Bean
    GoldenRecordRepository goldenRecordRepository() {
      return mock(GoldenRecordRepository.class);
    }

    @Bean
    JwtClaimsExtractor claimsExtractor() {
      return mock(JwtClaimsExtractor.class);
    }

    @Bean
    PlatformTransactionManager transactionManager() {
      PlatformTransactionManager txManager = mock(PlatformTransactionManager.class);
      when(txManager.getTransaction(any())).thenAnswer(inv -> new SimpleTransactionStatus(false));
      return txManager;
    }

    @Bean
    CacheManager cacheManager() {
      return new ConcurrentMapCacheManager(
          CacheConfig.CACHE_EXPLORER_SEARCH, CacheConfig.CACHE_EXPLORER_ENTITIES);
    }

    @Bean
    ExplorerSearchService explorerSearchService(
        GoldenRecordRepository goldenRecordRepository, JwtClaimsExtractor claimsExtractor) {
      return new ExplorerSearchService(goldenRecordRepository, claimsExtractor);
    }
  }

  @Autowired private ExplorerSearchService searchService;
  @Autowired private GoldenRecordRepository goldenRecordRepository;
  @Autowired private PlatformTransactionManager transactionManager;
  @Autowired private CacheManager cacheManager;

  @AfterEach
  void tearDown() {
    TenantContext.clear();
    var cache = cacheManager.getCache(CacheConfig.CACHE_EXPLORER_SEARCH);
    if (cache != null) {
      cache.clear();
    }
  }

  @Test
  void sixArgSearchInvokesTransactionalAndCacheableThroughSpringProxy() {
    TenantContext.setTenantId("acme");

    GoldenRecord gr = GoldenRecord.newStandalone();
    gr.setCanonicalName("Acme Freight");
    gr.setEntityType("Organization");
    gr.setSourceCount(2);

    when(goldenRecordRepository.countByEntityType())
        .thenReturn(List.<Object[]>of(new Object[] {"Organization", 1L}));
    when(goldenRecordRepository.searchByPropertiesAndType(eq(""), isNull(), any(Pageable.class)))
        .thenReturn(new PageImpl<>(List.of(gr), PageRequest.of(0, 12), 1));

    SearchResponseDto.Response first = searchService.search("", null, 0, 12, "createdAt", "DESC");
    SearchResponseDto.Response second = searchService.search("", null, 0, 12, "createdAt", "DESC");

    assertThat(first.items()).hasSize(1);
    assertThat(first.items().get(0).sourceCount()).isEqualTo(2);
    assertThat(second.items()).hasSize(1);

    // Proves @Transactional(readOnly = true) was entered via the Spring proxy on both calls (no
    // self-invocation bypass)
    verify(transactionManager, times(2))
        .getTransaction(
            org.mockito.ArgumentMatchers.argThat(
                (TransactionDefinition def) -> def != null && def.isReadOnly()));
    // Proves @Cacheable cached the 6-arg result on the first call
    verify(goldenRecordRepository, times(1))
        .searchByPropertiesAndType(eq(""), isNull(), any(Pageable.class));
  }
}
