package com.luminai.config;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.jsontype.BasicPolymorphicTypeValidator;
import com.fasterxml.jackson.databind.jsontype.PolymorphicTypeValidator;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.cache.interceptor.CacheErrorHandler;
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
 * Cache configuration for Explorer query caching, Entity details, and Dashboard metrics.
 *
 * <p>Uses Redis with 60s default TTL when Redis is connected; falls back to an in-memory {@link
 * ConcurrentMapCacheManager} during standalone/offline tests or if Redis is unavailable.
 *
 * <p>Configures a custom {@link GenericJackson2JsonRedisSerializer} with {@link JavaTimeModule} to
 * support Java 8+ date/time types (e.g. Instant, LocalDateTime), and implements {@link
 * CacheErrorHandler} so Redis connectivity hiccups never fail HTTP requests.
 */
@Configuration
@EnableCaching
public class CacheConfig implements CachingConfigurer {

  private static final Logger log = LoggerFactory.getLogger(CacheConfig.class);

  public static final String CACHE_EXPLORER_SEARCH = "explorer_search";
  public static final String CACHE_EXPLORER_ENTITIES = "explorer_entities";
  public static final String CACHE_ONTOLOGY = "ontology_cache";
  public static final String CACHE_DASHBOARD = "dashboard_cache";

  private GenericJackson2JsonRedisSerializer createRedisSerializer() {
    ObjectMapper mapper = new ObjectMapper();
    mapper.registerModule(new JavaTimeModule());
    mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    PolymorphicTypeValidator ptv =
        BasicPolymorphicTypeValidator.builder().allowIfSubType(Object.class).build();
    mapper.activateDefaultTyping(
        ptv, ObjectMapper.DefaultTyping.EVERYTHING, JsonTypeInfo.As.PROPERTY);

    return new GenericJackson2JsonRedisSerializer(mapper);
  }

  @Bean
  @Primary
  public CacheManager cacheManager(
      ObjectProvider<RedisConnectionFactory> connectionFactoryProvider) {
    try {
      RedisConnectionFactory connectionFactory = connectionFactoryProvider.getIfAvailable();
      if (connectionFactory != null) {
        GenericJackson2JsonRedisSerializer jsonSerializer = createRedisSerializer();

        RedisCacheConfiguration config =
            RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofSeconds(60))
                .disableCachingNullValues()
                .serializeKeysWith(
                    RedisSerializationContext.SerializationPair.fromSerializer(
                        new StringRedisSerializer()))
                .serializeValuesWith(
                    RedisSerializationContext.SerializationPair.fromSerializer(jsonSerializer));

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

  @Override
  public CacheErrorHandler errorHandler() {
    return new CacheErrorHandler() {
      @Override
      public void handleCacheGetError(RuntimeException exception, Cache cache, Object key) {
        log.warn(
            "Redis cache GET error for '{}' [key: {}]: {}. Falling back to database source.",
            cache.getName(),
            key,
            exception.getMessage());
      }

      @Override
      public void handleCachePutError(
          RuntimeException exception, Cache cache, Object key, Object value) {
        log.warn(
            "Redis cache PUT error for '{}' [key: {}]: {}. Continuing without caching.",
            cache.getName(),
            key,
            exception.getMessage());
      }

      @Override
      public void handleCacheEvictError(RuntimeException exception, Cache cache, Object key) {
        log.warn(
            "Redis cache EVICT error for '{}' [key: {}]: {}",
            cache.getName(),
            key,
            exception.getMessage());
      }

      @Override
      public void handleCacheClearError(RuntimeException exception, Cache cache) {
        log.warn("Redis cache CLEAR error for '{}': {}", cache.getName(), exception.getMessage());
      }
    };
  }
}
