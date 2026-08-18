package com.luminai.connection.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * JPA entity representing a pipeline execution run (cleaning, normalisation, entity resolution).
 * Stores throughput counters, status badges, and error diagnostics.
 */
@Entity
@Table(name = "pipeline_runs")
public class PipelineRun {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @NotNull
  @Column(name = "connection_id", nullable = false)
  private UUID connectionId;

  @NotNull
  @Column(name = "pipeline_type", nullable = false, length = 50)
  private String pipelineType;

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false, length = 20)
  private PipelineRunStatus status = PipelineRunStatus.PENDING;

  @Column(name = "started_at")
  private Instant startedAt;

  @Column(name = "completed_at")
  private Instant completedAt;

  @Column(name = "records_input", nullable = false)
  private long recordsInput = 0;

  @Column(name = "records_output", nullable = false)
  private long recordsOutput = 0;

  @Column(name = "records_failed", nullable = false)
  private long recordsFailed = 0;

  @Column(name = "error_message", columnDefinition = "TEXT")
  private String errorMessage;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "metadata", nullable = false, columnDefinition = "jsonb")
  private String metadata = "{}";

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  public PipelineRun() {}

  public PipelineRun(UUID connectionId, String pipelineType) {
    this.connectionId = connectionId;
    this.pipelineType = pipelineType;
    this.status = PipelineRunStatus.PENDING;
    this.startedAt = Instant.now();
  }

  public enum PipelineRunStatus {
    PENDING,
    RUNNING,
    COMPLETED,
    FAILED,
    CANCELLED
  }

  public UUID getId() {
    return id;
  }

  public void setId(UUID id) {
    this.id = id;
  }

  public UUID getConnectionId() {
    return connectionId;
  }

  public void setConnectionId(UUID connectionId) {
    this.connectionId = connectionId;
  }

  public String getPipelineType() {
    return pipelineType;
  }

  public void setPipelineType(String pipelineType) {
    this.pipelineType = pipelineType;
  }

  public PipelineRunStatus getStatus() {
    return status;
  }

  public void setStatus(PipelineRunStatus status) {
    this.status = status;
  }
  public Instant getStartedAt() {
    return startedAt;
  }

  public void setStartedAt(Instant startedAt) {
    this.startedAt = startedAt;
  }

  public Instant getCompletedAt() {
    return completedAt;
  }

  public void setCompletedAt(Instant completedAt) {
    this.completedAt = completedAt;
  }

  public long getRecordsInput() {
    return recordsInput;
  }

  public void setRecordsInput(long recordsInput) {
    this.recordsInput = recordsInput;
  }

  public long getRecordsOutput() {
    return recordsOutput;
  }

  public void setRecordsOutput(long recordsOutput) {
    this.recordsOutput = recordsOutput;
  }

  public long getRecordsFailed() {
    return recordsFailed;
  }

  public void setRecordsFailed(long recordsFailed) {
    this.recordsFailed = recordsFailed;
  }

  public String getErrorMessage() {
    return errorMessage;
  }

  public void setErrorMessage(String errorMessage) {
    this.errorMessage = errorMessage;
  }

  public String getMetadata() {
    return metadata;
  }

  public void setMetadata(String metadata) {
    this.metadata = metadata;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(Instant createdAt) {
    this.createdAt = createdAt;
  }

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (o == null || getClass() != o.getClass()) return false;
    PipelineRun that = (PipelineRun) o;
    return Objects.equals(id, that.id);
  }

  @Override
  public int hashCode() {
    return Objects.hash(id);
  }
}
