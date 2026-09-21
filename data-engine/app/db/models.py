"""SQLAlchemy 2.0 Declarative ORM Models for the LuminAI Data Engine."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base declarative class for all Data Engine relational database tables."""
    pass


class StagingRecord(Base):
    """Staging table storing raw ingestion records post-cleaning before entity resolution."""

    __tablename__ = "staging_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    source_id: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    raw_id: Mapped[str] = mapped_column(String(255), nullable=True)
    data: Mapped[str] = mapped_column(Text, nullable=False)
    staged_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class GoldenRecord(Base):
    """Golden records resulting from entity clustering and merge rules."""

    __tablename__ = "golden_records"

    golden_id: Mapped[str] = mapped_column(String(255), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    cluster_size: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    source_record_ids: Mapped[str] = mapped_column(Text, nullable=False)
    attributes: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class GoldenRecordHistory(Base):
    """Historical audit trail and point-in-time snapshots of Golden Records across versions."""

    __tablename__ = "golden_record_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    golden_id: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    tenant_id: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    cluster_size: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    source_record_ids: Mapped[str] = mapped_column(Text, nullable=False)
    attributes: Mapped[str] = mapped_column(Text, nullable=False)
    action: Mapped[str] = mapped_column(String(50), default="CREATED", nullable=False)  # CREATED, UPDATED, ROLLBACK
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class ERCandidate(Base):
    """Entity resolution candidate pairs within the review threshold (0.70 <= score < 0.90)."""

    __tablename__ = "er_candidates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    record_id_a: Mapped[str] = mapped_column(String(255), nullable=False)
    record_id_b: Mapped[str] = mapped_column(String(255), nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False)
    payload: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="PENDING", index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class ProvenanceRecord(Base):
    """Field-level lineage tracking which raw records contributed to golden record attributes."""

    __tablename__ = "provenance"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    golden_id: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    tenant_id: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    attribute_name: Mapped[str] = mapped_column(String(255), nullable=False)
    attribute_value: Mapped[str] = mapped_column(Text, nullable=True)
    source_record_id: Mapped[str] = mapped_column(String(255), nullable=False)
    source_id: Mapped[str] = mapped_column(String(255), nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
