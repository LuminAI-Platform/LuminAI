package com.luminai.config;

import java.time.Duration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
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
 * ConcurrentMapCacheManager} during standalone/offline tests.
 */
@Configuration
@EnableCaching
public class CacheConfig {

  public static final String CACHE_EXPLORER_SEARCH = "explorer_search";
  public static final String CACHE_EXPLORER_ENTITIES = "explorer_entities";
  public static final String CACHE_ONTOLOGY = "ontology_cache";

  @Bean
  @Primary
  @ConditionalOnClass(RedisConnectionFactory.class)
  public CacheManager redisCacheManager(RedisConnectionFactory connectionFactory) {
    try {
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

      return RedisCacheManager.builder(connectionFactory)
          .cacheDefaults(config)
          .withCacheConfiguration(CACHE_EXPLORER_SEARCH, config.entryTtl(Duration.ofSeconds(60)))
          .withCacheConfiguration(CACHE_EXPLORER_ENTITIES, config.entryTtl(Duration.ofSeconds(60)))
          .withCacheConfiguration(CACHE_ONTOLOGY, config.entryTtl(Duration.ofMinutes(5)))
          .build();
    } catch (Exception ignored) {
      return new ConcurrentMapCacheManager(
          CACHE_EXPLORER_SEARCH, CACHE_EXPLORER_ENTITIES, CACHE_ONTOLOGY);
    }
  }
}
