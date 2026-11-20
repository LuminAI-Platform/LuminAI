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
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business logic for manual entity-resolution review: listing/inspecting candidates, and applying
 * analyst decisions (accept, reject, split) to the underlying Golden Records.
 */
@Service
public class MergeReviewService {

  private static final Logger log = LoggerFactory.getLogger(MergeReviewService.class);

  private final ErCandidateRepository candidateRepository;
  private final GoldenRecordRepository goldenRecordRepository;
  private final KafkaTemplate<String, Object> kafkaTemplate;
  private final CandidateScannerService candidateScannerService;

  public MergeReviewService(
      ErCandidateRepository candidateRepository,
      GoldenRecordRepository goldenRecordRepository,
      KafkaTemplate<String, Object> kafkaTemplate,
      @Autowired(required = false) CandidateScannerService candidateScannerService) {
    this.candidateRepository = candidateRepository;
    this.goldenRecordRepository = goldenRecordRepository;
    this.kafkaTemplate = kafkaTemplate;
    this.candidateScannerService =
        candidateScannerService != null
            ? candidateScannerService
            : new CandidateScannerService(candidateRepository, new PairSimilarityMatcher());
  }

  @Transactional(readOnly = true)
  public Page<MergeReviewDto.CandidateResponse> listCandidates(
      CandidateStatus status, Pageable pageable) {
    Page<ErCandidate> page =
        status != null
            ? candidateRepository.findByStatus(status, pageable)
            : candidateRepository.findAll(pageable);
    return page.map(this::toSummaryResponse);
  }

  @Transactional(readOnly = true)
  public MergeReviewDto.CandidateResponse getCandidate(UUID candidateId) {
    return toDetailResponse(loadCandidate(candidateId));
  }

  @Transactional
  public Map<String, Object> scanCandidates() {
    return candidateScannerService.scanCandidates();
  }

  @Transactional
  public MergeReviewDto.CandidateResponse acceptCandidate(UUID candidateId) {
    ErCandidate candidate = loadCandidate(candidateId);
    ensurePending(candidate);

    GoldenRecord goldenRecord = null;
    if (candidate.getGoldenRecordId() != null) {
      goldenRecord = goldenRecordRepository.findById(candidate.getGoldenRecordId()).orElse(null);
    }

    if (goldenRecord == null) {
      goldenRecord = GoldenRecord.newStandalone();
      UUID tenantUuid =
          candidate.getTenantId() != null ? candidate.getTenantId() : TenantContext.getTenantUuid();
      if (tenantUuid == null) {
        throw new AccessDeniedException("Unauthorized: missing tenant context");
      }
      goldenRecord.setTenantId(tenantUuid);
      goldenRecord.setEntityType("Entity");

      String canonicalName = "Merged Entity";
      if (candidate.getRecordASnapshot() != null) {
        for (String k :
            List.of(
                "canonicalName",
                "name",
                "fullName",
                "customer_name",
                "patient_name",
                "company",
                "id")) {
          if (candidate.getRecordASnapshot().containsKey(k)
              && candidate.getRecordASnapshot().get(k) != null) {
            canonicalName = String.valueOf(candidate.getRecordASnapshot().get(k));
            break;
          }
        }
      }
      goldenRecord.setCanonicalName(canonicalName);
      goldenRecord.getSourceRecordIds().add(candidate.getRecordAId());
      if (candidate.getRecordASnapshot() != null) {
        goldenRecord.getProperties().putAll(candidate.getRecordASnapshot());
      }
    }

    mergeNonConflictingProperties(goldenRecord, candidate);
    goldenRecord.getSourceRecordIds().add(candidate.getRecordBId());
    goldenRecord.setSourceCount(Math.max(1, goldenRecord.getSourceRecordIds().size()));
    goldenRecord
        .getProvenance()
        .add(
            new ProvenanceEntry(
                candidate.getRecordBId(), null, candidate.getId(), Instant.now(), "MERGE_ACCEPT"));

    GoldenRecord savedRecord = goldenRecordRepository.save(goldenRecord);

    candidate.setGoldenRecordId(savedRecord.getId());
    candidate.setStatus(CandidateStatus.ACCEPTED);
    candidate.setReviewedAt(Instant.now());
    candidateRepository.save(candidate);

    publishEntityUpdated(savedRecord.getId(), "GOLDEN_RECORD_MERGE");

    return toDetailResponse(candidate);
  }

  @Transactional
  public MergeReviewDto.CandidateResponse rejectCandidate(UUID candidateId) {
    ErCandidate candidate = loadCandidate(candidateId);
    ensurePending(candidate);

    candidate.setStatus(CandidateStatus.REJECTED);
    candidate.setReviewedAt(Instant.now());
    candidateRepository.save(candidate);

    return toDetailResponse(candidate);
  }

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

    UUID tenantId =
        original.getTenantId() != null ? original.getTenantId() : TenantContext.getTenantUuid();
    if (tenantId == null) {
      throw new AccessDeniedException("Unauthorized: missing tenant context");
    }

    GoldenRecord extracted = GoldenRecord.newStandalone();
    extracted.setTenantId(tenantId);
    extracted.setEntityType(original.getEntityType());
    extracted.setCanonicalName(
        original.getCanonicalName() != null
            ? original.getCanonicalName() + " (Split)"
            : "Split Entity");
    extracted.setConfidenceScore(
        original.getConfidenceScore() != null
            ? original.getConfidenceScore()
            : java.math.BigDecimal.valueOf(1.0));
    extracted.getSourceRecordIds().add(sourceRecordIdToExtract);
    extracted.setSourceCount(1);
    original.setSourceCount(Math.max(1, original.getSourceRecordIds().size()));

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

  private void mergeNonConflictingProperties(GoldenRecord goldenRecord, ErCandidate candidate) {
    Map<String, Object> incoming = candidate.getRecordBSnapshot();
    if (incoming == null || incoming.isEmpty()) return;
    Map<String, Object> target = goldenRecord.getProperties();
    for (Map.Entry<String, Object> entry : incoming.entrySet()) {
      String field = entry.getKey();
      Object incomingValue = entry.getValue();
      if (isBlank(incomingValue)) continue;
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
    }
  }

  private boolean isBlank(Object value) {
    return value == null || (value instanceof String s && s.isBlank());
  }

  private void publishEntityUpdated(UUID entityId, String changeType) {
    String tenantId = TenantContext.getTenantSlug();
    if (kafkaTemplate != null && tenantId != null) {
      try {
        kafkaTemplate.send(
            KafkaConfig.TOPIC_ENTITY_UPDATED,
            entityId.toString(),
            new EntityUpdatedEvent(tenantId, entityId, changeType, Instant.now()));
      } catch (Exception e) {
        log.debug("EntityUpdated event skipped: {}", e.getMessage());
      }
    }
  }

  private MergeReviewDto.CandidateResponse toSummaryResponse(ErCandidate candidate) {
    return new MergeReviewDto.CandidateResponse(
        candidate.getId(),
        candidate.getGoldenRecordId(),
        new MergeReviewDto.RecordSnapshot(candidate.getRecordAId(), candidate.getRecordASnapshot()),
        new MergeReviewDto.RecordSnapshot(candidate.getRecordBId(), candidate.getRecordBSnapshot()),
        candidate.getSimilarityScore(),
        candidate.getMatchRationale(),
        null,
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
