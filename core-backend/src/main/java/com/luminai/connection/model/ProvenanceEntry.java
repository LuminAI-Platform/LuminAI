package com.luminai.connection.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.time.Instant;
import java.util.UUID;

/**
 * A single audit entry describing how a Golden Record's data was derived: which source record
 * contributed which field, as a result of which candidate decision or split, and when.
 *
 * <p>Stored as an {@code @ElementCollection} on {@link GoldenRecord} so provenance history is
 * queryable without a separate top-level entity.
 */
@Embeddable
public class ProvenanceEntry {

  @Column(name = "source_record_id")
  private UUID sourceRecordId;

  /** Name of the merged field, or {@code null} when the entry describes a record-level action. */
  @Column(name = "field_name")
  private String fieldName;

  @Column(name = "candidate_id")
  private UUID candidateId;

  @Column(name = "occurred_at")
  private Instant occurredAt;

  /** e.g. FIELD_MERGE, MERGE_ACCEPT, SPLIT_REMOVE, SPLIT_CREATE. */
  @Column(name = "action")
  private String action;

  protected ProvenanceEntry() {
    // required by JPA
  }

  public ProvenanceEntry(
      UUID sourceRecordId, String fieldName, UUID candidateId, Instant occurredAt, String action) {
    this.sourceRecordId = sourceRecordId;
    this.fieldName = fieldName;
    this.candidateId = candidateId;
    this.occurredAt = occurredAt;
    this.action = action;
  }

  public UUID getSourceRecordId() {
    return sourceRecordId;
  }

  public String getFieldName() {
    return fieldName;
  }

  public UUID getCandidateId() {
    return candidateId;
  }

  public Instant getOccurredAt() {
    return occurredAt;
  }

  public String getAction() {
    return action;
  }
}
