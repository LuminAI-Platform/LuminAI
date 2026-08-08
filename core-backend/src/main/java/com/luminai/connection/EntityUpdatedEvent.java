package com.luminai.connection;

import java.time.Instant;
import java.util.UUID;

/**
 * Payload published to {@link com.luminai.config.KafkaConfig#TOPIC_ENTITY_UPDATED} whenever a
 * merge review action changes a Golden Record (accept-merge or split).
 *
 * <p>No equivalent event class existed elsewhere in the project at the time this was written, so
 * this one is scoped to the {@code connection} module rather than placed in a shared/common
 * package that doesn't yet exist. If another producer starts publishing to {@code entity.updated}
 * later, prefer promoting this to a shared location (and reusing it here) over letting two
 * different payload shapes coexist on the same topic.
 *
 * <p>{@code tenantId} is a {@code String} to match {@link com.luminai.common.tenant.TenantContext}
 * — this project's multi-tenancy is schema-based, and tenant ids are schema-name strings, not
 * UUIDs.
 */
public record EntityUpdatedEvent(String tenantId, UUID entityId, String changeType, Instant occurredAt) {}