package com.luminai.connection.model;

import com.luminai.connection.JsonMapConverter;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * The canonical, merged view of an entity, composed from one or more source records.
 *
 * <p>{@link #sourceRecordIds} tracks cluster membership; {@link #properties} holds the current
 * merged field values; {@link #provenance} is an append-only audit trail of how each field/member
 * arrived (or left) via {@link com.luminai.connection.service.MergeReviewService} accept/split
 * operations.
 */
@Entity
@Table(
    name = "golden_record",
    indexes = {@Index(name = "idx_golden_record_tenant", columnList = "tenant_id")})
public class GoldenRecord {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @ElementCollection
  @CollectionTable(
      name = "golden_record_source_ids",
      joinColumns = @JoinColumn(name = "golden_record_id"))
  @Column(name = "source_record_id")
  private Set<UUID> sourceRecordIds = new LinkedHashSet<>();

  @Convert(converter = JsonMapConverter.class)
  @Column(name = "properties", columnDefinition = "text")
  private Map<String, Object> properties = new LinkedHashMap<>();

  @ElementCollection
  @CollectionTable(
      name = "golden_record_provenance",
      joinColumns = @JoinColumn(name = "golden_record_id"))
  private List<ProvenanceEntry> provenance = new ArrayList<>();

  @Version
  @Column(name = "version", nullable = false)
  private long version;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @UpdateTimestamp
  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  protected GoldenRecord() {
    // required by JPA
  }

  public static GoldenRecord newStandalone() {
    return new GoldenRecord();
  }

  public UUID getId() {
    return id;
  }

  public Set<UUID> getSourceRecordIds() {
    return sourceRecordIds;
  }

  public Map<String, Object> getProperties() {
    return properties;
  }

  public List<ProvenanceEntry> getProvenance() {
    return provenance;
  }

  public long getVersion() {
    return version;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }

  public void setUpdatedAt(Instant updatedAt) {
    this.updatedAt = updatedAt;
  }
}
