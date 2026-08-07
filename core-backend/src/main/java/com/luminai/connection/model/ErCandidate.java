package com.luminai.connection.model;

import com.luminai.connection.JsonMapConverter;
import jakarta.persistence.*;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * A proposed match between two source records ("Record A" and "Record B") flagged by the entity
 * resolution engine, awaiting (or having received) manual analyst review.
 *
 * <p>Record snapshots are denormalized onto the candidate at ER-engine creation time so the review
 * UI can render a side-by-side comparison without joining back to upstream source systems.
 */
@Entity
@Table(
        name = "er_candidate",
        indexes = {
                @Index(name = "idx_er_candidate_tenant_status", columnList = "tenant_id, status"),
                @Index(name = "idx_er_candidate_tenant_golden", columnList = "tenant_id, golden_record_id")
        })
public class ErCandidate {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @NotNull
    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @NotNull
    @Column(name = "record_a_id", nullable = false)
    private UUID recordAId;

    @NotNull
    @Column(name = "record_b_id", nullable = false)
    private UUID recordBId;

    @NotNull
    @Column(name = "golden_record_id", nullable = false)
    private UUID goldenRecordId;

    @Convert(converter = JsonMapConverter.class)
    @Column(name = "record_a_snapshot", columnDefinition = "text")
    private Map<String, Object> recordASnapshot = new LinkedHashMap<>();

    @Convert(converter = JsonMapConverter.class)
    @Column(name = "record_b_snapshot", columnDefinition = "text")
    private Map<String, Object> recordBSnapshot = new LinkedHashMap<>();

    @DecimalMin("0.0")
    @DecimalMax("1.0")
    @Column(name = "similarity_score", nullable = false)
    private double similarityScore;

    @NotBlank
    @Column(name = "match_rationale", nullable = false, length = 2000)
    private String matchRationale;

    @Convert(converter = JsonMapConverter.class)
    @Column(name = "comparison_details", columnDefinition = "text")
    private Map<String, Object> comparisonDetails = new LinkedHashMap<>();

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private CandidateStatus status = CandidateStatus.PENDING;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "reviewed_by", length = 255)
    private String reviewedBy;

    protected ErCandidate() {
        // required by JPA
    }

    public ErCandidate(
            UUID tenantId,
            UUID recordAId,
            UUID recordBId,
            UUID goldenRecordId,
            double similarityScore,
            String matchRationale) {
        this.tenantId = Objects.requireNonNull(tenantId, "tenantId");
        this.recordAId = Objects.requireNonNull(recordAId, "recordAId");
        this.recordBId = Objects.requireNonNull(recordBId, "recordBId");
        this.goldenRecordId = Objects.requireNonNull(goldenRecordId, "goldenRecordId");
        this.similarityScore = similarityScore;
        this.matchRationale = matchRationale;
    }

    public enum CandidateStatus {
        PENDING,
        ACCEPTED,
        REJECTED
    }

    public UUID getId() {
        return id;
    }

    public UUID getTenantId() {
        return tenantId;
    }

    public UUID getRecordAId() {
        return recordAId;
    }

    public UUID getRecordBId() {
        return recordBId;
    }

    public UUID getGoldenRecordId() {
        return goldenRecordId;
    }

    public Map<String, Object> getRecordASnapshot() {
        return recordASnapshot;
    }

    public void setRecordASnapshot(Map<String, Object> recordASnapshot) {
        this.recordASnapshot = recordASnapshot;
    }

    public Map<String, Object> getRecordBSnapshot() {
        return recordBSnapshot;
    }

    public void setRecordBSnapshot(Map<String, Object> recordBSnapshot) {
        this.recordBSnapshot = recordBSnapshot;
    }

    public double getSimilarityScore() {
        return similarityScore;
    }

    public String getMatchRationale() {
        return matchRationale;
    }

    public Map<String, Object> getComparisonDetails() {
        return comparisonDetails;
    }

    public void setComparisonDetails(Map<String, Object> comparisonDetails) {
        this.comparisonDetails = comparisonDetails;
    }

    public CandidateStatus getStatus() {
        return status;
    }

    public void setStatus(CandidateStatus status) {
        this.status = status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Instant getReviewedAt() {
        return reviewedAt;
    }

    public void setReviewedAt(Instant reviewedAt) {
        this.reviewedAt = reviewedAt;
    }

    public String getReviewedBy() {
        return reviewedBy;
    }

    public void setReviewedBy(String reviewedBy) {
        this.reviewedBy = reviewedBy;
    }
}