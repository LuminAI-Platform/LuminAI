package com.luminai.connection.service;

import com.luminai.common.exception.ConflictException;
import com.luminai.common.exception.ResourceNotFoundException;
import com.luminai.common.tenant.TenantContext;
import com.luminai.config.KafkaConfig;
import com.luminai.connection.EntityUpdatedEvent;
import com.luminai.connection.dto.MergeReviewDto;
import com.luminai.connection.model.ErCandidate;
import com.luminai.connection.model.ErCandidate.CandidateStatus;
import com.luminai.connection.model.GoldenRecord;
import com.luminai.connection.model.ProvenanceEntry;
import com.luminai.connection.repository.ErCandidateRepository;
import com.luminai.connection.repository.GoldenRecordRepository;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business logic for manual entity-resolution review: listing/inspecting candidates, and applying
 * analyst decisions (accept, reject, split) to the underlying Golden Records.
 *
 * <p>This project's multi-tenancy is schema-based: {@link TenantContext} holds the current tenant's
 * schema id, and Hibernate routes every connection to that schema before any query in this service
 * runs (see {@link TenantContext}'s own Javadoc — it's read by {@code TenantIdentifierResolver}).
 * Because isolation is physical, repository calls here are plain {@code findById}/{@code findAll}
 * lookups with no manual tenant filter — there's nothing to filter by that Hibernate hasn't already
 * resolved for the connection. {@link TenantContext} is only read here to stamp the tenant id onto
 * outgoing Kafka events, since consumers on a shared topic need to know which tenant an event
 * belongs to.
 *
 * <p>The controller only delegates here.
 */
@Service
public class MergeReviewService {

  private final ErCandidateRepository candidateRepository;
  private final GoldenRecordRepository goldenRecordRepository;
  private final KafkaTemplate<String, Object> kafkaTemplate;

  public MergeReviewService(
      ErCandidateRepository candidateRepository,
      GoldenRecordRepository goldenRecordRepository,
      KafkaTemplate<String, Object> kafkaTemplate) {
    this.candidateRepository = candidateRepository;
    this.goldenRecordRepository = goldenRecordRepository;
    this.kafkaTemplate = kafkaTemplate;
  }

  /** Lists candidates for the current tenant's schema, optionally filtered by status. */
  @Transactional(readOnly = true)
  public Page<MergeReviewDto.CandidateResponse> listCandidates(
      CandidateStatus status, Pageable pageable) {
    Page<ErCandidate> page =
        status != null
            ? candidateRepository.findByStatus(status, pageable)
            : candidateRepository.findAll(pageable);
    return page.map(this::toSummaryResponse);
  }

  /** Returns the full comparison detail for a single candidate. */
  @Transactional(readOnly = true)
  public MergeReviewDto.CandidateResponse getCandidate(UUID candidateId) {
    return toDetailResponse(loadCandidate(candidateId));
  }

  /**
   * Accepts a candidate match: merges Record B's non-conflicting properties into Record A's Golden
   * Record, updates provenance, marks the candidate ACCEPTED, and publishes an entity.updated
   * event.
   */
  @Transactional
  public MergeReviewDto.CandidateResponse acceptCandidate(UUID candidateId) {
    ErCandidate candidate = loadCandidate(candidateId);
    ensurePending(candidate);

    GoldenRecord goldenRecord = loadGoldenRecord(candidate.getGoldenRecordId());

    mergeNonConflictingProperties(goldenRecord, candidate);
    goldenRecord.getSourceRecordIds().add(candidate.getRecordBId());
    goldenRecord
        .getProvenance()
        .add(
            new ProvenanceEntry(
                candidate.getRecordBId(), null, candidate.getId(), Instant.now(), "MERGE_ACCEPT"));

    candidate.setStatus(CandidateStatus.ACCEPTED);
    candidate.setReviewedAt(Instant.now());

    goldenRecordRepository.save(goldenRecord);
    candidateRepository.save(candidate);

    publishEntityUpdated(goldenRecord.getId(), "GOLDEN_RECORD_MERGE");

    return toDetailResponse(candidate);
  }

  /**
   * Rejects a candidate match. The candidate row is preserved (never deleted) so the ER engine does
   * not re-propose the same pair on a future pipeline run.
   */
  @Transactional
  public MergeReviewDto.CandidateResponse rejectCandidate(UUID candidateId) {
    ErCandidate candidate = loadCandidate(candidateId);
    ensurePending(candidate);

    candidate.setStatus(CandidateStatus.REJECTED);
    candidate.setReviewedAt(Instant.now());
    candidateRepository.save(candidate);

    return toDetailResponse(candidate);
  }

  /**
   * Splits a Golden Record: extracts one clustered source record into a brand-new, standalone
   * Golden Record, and records provenance on both sides.
   */
  @Transactional
  public MergeReviewDto.SplitResponse splitGoldenRecord(
      UUID goldenRecordId, UUID sourceRecordIdToExtract) {
    GoldenRecord original = loadGoldenRecord(goldenRecordId);

    if (!original.getSourceRecordIds().contains(sourceRecordIdToExtract)) {
      throw new ConflictException(
          "Source record "
              + sourceRecordIdToExtract
              + " is not part of Golden Record "
              + goldenRecordId);
    }
    if (original.getSourceRecordIds().size() <= 1) {
      throw new ConflictException(
          "Cannot split Golden Record " + goldenRecordId + ": it has only one source record");
    }

    original.getSourceRecordIds().remove(sourceRecordIdToExtract);
    original
        .getProvenance()
        .add(
            new ProvenanceEntry(
                sourceRecordIdToExtract, null, null, Instant.now(), "SPLIT_REMOVE"));

    GoldenRecord extracted = GoldenRecord.newStandalone();
    extracted.getSourceRecordIds().add(sourceRecordIdToExtract);
    // The cluster's current merged properties are the best available starting point for the
    // extracted record, since per-source-record field snapshots aren't retained once merged.
    // If the project stores a durable per-source-record snapshot elsewhere, prefer seeding from
    // that instead of copying the cluster's current values.
    extracted.getProperties().putAll(original.getProperties());
    extracted
        .getProvenance()
        .add(
            new ProvenanceEntry(
                sourceRecordIdToExtract, null, null, Instant.now(), "SPLIT_CREATE"));

    goldenRecordRepository.save(original);
    GoldenRecord savedExtracted = goldenRecordRepository.save(extracted);

    publishEntityUpdated(original.getId(), "GOLDEN_RECORD_SPLIT");
    publishEntityUpdated(savedExtracted.getId(), "GOLDEN_RECORD_CREATED_FROM_SPLIT");

    return new MergeReviewDto.SplitResponse(
        toGoldenRecordResponse(original), toGoldenRecordResponse(savedExtracted));
  }

  // -----------------------------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------------------------

  private ErCandidate loadCandidate(UUID candidateId) {
    return candidateRepository
        .findById(candidateId)
        .orElseThrow(() -> new ResourceNotFoundException("ErCandidate", candidateId));
  }

  private GoldenRecord loadGoldenRecord(UUID goldenRecordId) {
    return goldenRecordRepository
        .findById(goldenRecordId)
        .orElseThrow(() -> new ResourceNotFoundException("GoldenRecord", goldenRecordId));
  }

  private void ensurePending(ErCandidate candidate) {
    if (candidate.getStatus() != CandidateStatus.PENDING) {
      throw new ConflictException(
          "Candidate " + candidate.getId() + " is already " + candidate.getStatus());
    }
  }

  /**
   * Merges Record B's fields into the Golden Record only where there is no conflict: the target
   * field is currently empty, or the incoming value matches what's already there. Fields that
   * disagree are left untouched — resolving true conflicts is left to existing business rules (e.g.
   * a separate manual field-level override flow), consistent with the project's existing merge
   * semantics if one is already defined.
   */
  private void mergeNonConflictingProperties(GoldenRecord goldenRecord, ErCandidate candidate) {
    Map<String, Object> incoming = candidate.getRecordBSnapshot();
    if (incoming == null || incoming.isEmpty()) {
      return;
    }
    Map<String, Object> target = goldenRecord.getProperties();
    for (Map.Entry<String, Object> entry : incoming.entrySet()) {
      String field = entry.getKey();
      Object incomingValue = entry.getValue();
      if (isBlank(incomingValue)) {
        continue;
      }
      Object currentValue = target.get(field);
      boolean noConflict = isBlank(currentValue) || currentValue.equals(incomingValue);
      if (noConflict) {
        target.put(field, incomingValue);
        goldenRecord
            .getProvenance()
            .add(
                new ProvenanceEntry(
                    candidate.getRecordBId(),
                    field,
                    candidate.getId(),
                    Instant.now(),
                    "FIELD_MERGE"));
      }
      // Conflicting fields are intentionally left as-is; no destructive overwrite on disagreement.
    }
  }

  private boolean isBlank(Object value) {
    return value == null || (value instanceof String s && s.isBlank());
  }

  /**
   * Publishes an entity.updated event for the current tenant. {@link TenantContext#getTenantId()}
   * is read here (not for query filtering — see class Javadoc) purely so consumers on the shared
   * topic know which tenant's data changed.
   */
  private void publishEntityUpdated(UUID entityId, String changeType) {
    String tenantId = TenantContext.getTenantId();
    kafkaTemplate.send(
        KafkaConfig.TOPIC_ENTITY_UPDATED,
        entityId.toString(),
        new EntityUpdatedEvent(tenantId, entityId, changeType, Instant.now()));
  }

  private MergeReviewDto.CandidateResponse toSummaryResponse(ErCandidate candidate) {
    return new MergeReviewDto.CandidateResponse(
        candidate.getId(),
        candidate.getGoldenRecordId(),
        new MergeReviewDto.RecordSnapshot(candidate.getRecordAId(), candidate.getRecordASnapshot()),
        new MergeReviewDto.RecordSnapshot(candidate.getRecordBId(), candidate.getRecordBSnapshot()),
        candidate.getSimilarityScore(),
        candidate.getMatchRationale(),
        null, // comparisonDetails omitted in list view to keep pages light
        candidate.getStatus(),
        candidate.getReviewedAt(),
        candidate.getReviewedBy());
  }

  private MergeReviewDto.CandidateResponse toDetailResponse(ErCandidate candidate) {
    return new MergeReviewDto.CandidateResponse(
        candidate.getId(),
        candidate.getGoldenRecordId(),
        new MergeReviewDto.RecordSnapshot(candidate.getRecordAId(), candidate.getRecordASnapshot()),
        new MergeReviewDto.RecordSnapshot(candidate.getRecordBId(), candidate.getRecordBSnapshot()),
        candidate.getSimilarityScore(),
        candidate.getMatchRationale(),
        candidate.getComparisonDetails(),
        candidate.getStatus(),
        candidate.getReviewedAt(),
        candidate.getReviewedBy());
  }

  private MergeReviewDto.GoldenRecordResponse toGoldenRecordResponse(GoldenRecord goldenRecord) {
    return new MergeReviewDto.GoldenRecordResponse(
        goldenRecord.getId(),
        goldenRecord.getSourceRecordIds(),
        goldenRecord.getProperties(),
        goldenRecord.getVersion());
  }
}
