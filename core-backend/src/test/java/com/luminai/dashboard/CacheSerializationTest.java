package com.luminai.dashboard;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.jsontype.BasicPolymorphicTypeValidator;
import com.fasterxml.jackson.databind.jsontype.PolymorphicTypeValidator;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.luminai.dashboard.dto.ActivityItemDto;
import com.luminai.dashboard.dto.DashboardSummaryDto;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;

public class CacheSerializationTest {

  @Test
  void testSerializeDashboardSummaryDto() {
    ObjectMapper mapper = new ObjectMapper();
    mapper.registerModule(new JavaTimeModule());
    mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    PolymorphicTypeValidator ptv =
        BasicPolymorphicTypeValidator.builder().allowIfSubType(Object.class).build();
    mapper.activateDefaultTyping(
        ptv, ObjectMapper.DefaultTyping.EVERYTHING, JsonTypeInfo.As.PROPERTY);

    GenericJackson2JsonRedisSerializer serializer = new GenericJackson2JsonRedisSerializer(mapper);

    DashboardSummaryDto dto =
        new DashboardSummaryDto(
            100L,
            5L,
            10L,
            Map.of("Customer", 50L),
            List.of(
                new ActivityItemDto(
                    "act-1", "INGEST", "Data Sync", "Completed", Instant.now(), "SUCCESS")),
            95.5,
            new DashboardSummaryDto.PipelineHealthDto(1, 8, 1),
            Instant.now());

    byte[] bytes = serializer.serialize(dto);
    assertNotNull(bytes);
    assertTrue(bytes.length > 0);

    Object deserialized = serializer.deserialize(bytes);
    assertNotNull(deserialized);
    assertTrue(deserialized instanceof DashboardSummaryDto);
    DashboardSummaryDto result = (DashboardSummaryDto) deserialized;
    assertEquals(100L, result.totalEntities());
    assertEquals(1, result.recentActivity().size());
    assertNotNull(result.recentActivity().get(0).timestamp());
  }
}
