package com.luminai.config;

import static org.junit.jupiter.api.Assertions.*;

import com.luminai.dashboard.dto.ActivityItemDto;
import com.luminai.dashboard.dto.DashboardSummaryDto;
import com.luminai.explorer.dto.MatchReasonDto;
import com.luminai.explorer.dto.SearchResponseDto;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;

class CacheConfigTest {

  @Test
  @DisplayName(
      "CacheConfig Redis serializer round-trips final Java records without ClassCastException")
  void cacheSerializerRoundTripsFinalRecords() {
    CacheConfig config = new CacheConfig();
    GenericJackson2JsonRedisSerializer serializer = config.createRedisSerializer();

    DashboardSummaryDto dashboard =
        new DashboardSummaryDto(
            42L,
            3L,
            4L,
            Map.of("Person", 42L),
            List.of(
                new ActivityItemDto(
                    "a-1", "INGEST", "Sync", "Completed", Instant.now(), "SUCCESS")),
            91.5,
            new DashboardSummaryDto.PipelineHealthDto(1, 3, 0),
            Instant.now());

    byte[] dashBytes = serializer.serialize(dashboard);
    Object dashOut = serializer.deserialize(dashBytes);
    assertInstanceOf(DashboardSummaryDto.class, dashOut);
    assertEquals(42L, ((DashboardSummaryDto) dashOut).totalEntities());

    SearchResponseDto.SearchItem item =
        new SearchResponseDto.SearchItem(
            UUID.randomUUID(),
            "Acme Corp",
            "Company",
            0.95,
            2,
            Map.of("country", "US"),
            Instant.now(),
            Instant.now(),
            null,
            90.0,
            95.0,
            false,
            List.of(new MatchReasonDto("canonicalName", "ER", 0.95, "Matched canonicalName")),
            List.of());
    SearchResponseDto.Response searchResp =
        new SearchResponseDto.Response(
            List.of(item), 1L, 0, 20, Map.of("entityTypes", Map.of("Company", 1L)));

    byte[] searchBytes = serializer.serialize(searchResp);
    Object searchOut = serializer.deserialize(searchBytes);
    assertInstanceOf(SearchResponseDto.Response.class, searchOut);
    assertEquals(1, ((SearchResponseDto.Response) searchOut).items().size());
  }
}
