package com.luminai.config;

import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

/**
 * Cache configuration for Explorer query caching and Entity details.
 *
 * <p>Uses Redis with 60s TTL when Redis is connected; falls back to an in-memory {@link
 * ConcurrentMapCacheManager} during standalone/offline tests or if Redis is unavailable.
 */
@Configuration
@EnableCaching
public class CacheConfig {

  private static final Logger log = LoggerFactory.getLogger(CacheConfig.class);

  public static final String CACHE_EXPLORER_SEARCH = "explorer_search";
  public static final String CACHE_EXPLORER_ENTITIES = "explorer_entities";
  public static final String CACHE_ONTOLOGY = "ontology_cache";
  public static final String CACHE_DASHBOARD = "dashboard_cache";

  @Bean
  @Primary
  public CacheManager cacheManager(
      ObjectProvider<RedisConnectionFactory> connectionFactoryProvider) {
    try {
      RedisConnectionFactory connectionFactory = connectionFactoryProvider.getIfAvailable();
      if (connectionFactory != null) {
        RedisCacheConfiguration config =
            RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofSeconds(60))
                .disableCachingNullValues()
                .serializeKeysWith(
                    RedisSerializationContext.SerializationPair.fromSerializer(
                        new StringRedisSerializer()))
                .serializeValuesWith(
                    RedisSerializationContext.SerializationPair.fromSerializer(
                        new GenericJackson2JsonRedisSerializer()));

        log.info("RedisCacheManager successfully initialized with Redis connection factory");
        return RedisCacheManager.builder(connectionFactory)
            .cacheDefaults(config)
            .withCacheConfiguration(CACHE_EXPLORER_SEARCH, config.entryTtl(Duration.ofSeconds(60)))
            .withCacheConfiguration(
                CACHE_EXPLORER_ENTITIES, config.entryTtl(Duration.ofSeconds(60)))
            .withCacheConfiguration(CACHE_ONTOLOGY, config.entryTtl(Duration.ofMinutes(5)))
            .withCacheConfiguration(CACHE_DASHBOARD, config.entryTtl(Duration.ofSeconds(30)))
            .build();
      }
    } catch (Exception exc) {
      log.warn(
          "Redis connection factory failed to initialize ({}). Falling back to in-memory cache.",
          exc.getMessage());
    }

    log.info("Using in-memory ConcurrentMapCacheManager for cache operations");
    return new ConcurrentMapCacheManager(
        CACHE_EXPLORER_SEARCH, CACHE_EXPLORER_ENTITIES, CACHE_ONTOLOGY, CACHE_DASHBOARD);
  }
}
