package com.luminai.graph;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Map;

/**
 * Payload consumed from {@link com.luminai.config.KafkaConfig#TOPIC_ENTITY_RESOLVED}, published by
 * {@code data-engine}'s {@code EntityResolvedProducer} (see {@code
 * data-engine/app/kafka/producers.py}).
 *
 * <p><strong>Relationships:</strong> the producer does not emit any relationship/edge data today —
 * confirmed by inspecting {@code data-engine/app/processing/er/golden_record.py} and every existing
 * consumer of Golden Records in this codebase ({@code ErCandidate} is duplicate-record matching for
 * the merge-review UI, not a graph edge). {@link com.luminai.graph.service.Neo4jSyncService}
 * therefore treats an optional {@code data.relationships} array as a forward-compatible, additive
 * contract: if the producer starts emitting it, edges sync automatically; until then this is always
 * a node-only sync, which is the accurate state of the data today.
 */
public record EntityResolvedEvent(
    @JsonProperty("tenant_id") String tenantId,
    @JsonProperty("golden_id") String goldenId,
    @JsonProperty("entity_type") String entityType,
    @JsonProperty("data") Map<String, Object> data) {}
