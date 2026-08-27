"""Unit tests for Cross-Store Data Reconciliation Engine (Sprint 3 · S3-14)."""

import hashlib
import json
import pytest

from app.processing.reconciliation import (
    CrossStoreReconciler,
    ReconciliationReport,
    compute_record_hash,
    compute_store_aggregate_checksum,
    run_cross_store_reconciliation,
)


class TestChecksumComputation:
    """Tests for deterministic SHA-256 record hashing and aggregate store checksums."""

    def test_deterministic_record_hash(self):
        """Identical record attributes yield the exact same SHA-256 hash regardless of key order."""
        rec1 = {"name": "Alice Smith", "email": "alice@example.com", "country": "UK"}
        rec2 = {"country": "UK", "name": "Alice Smith", "email": "alice@example.com"}

        hash1 = compute_record_hash(rec1)
        hash2 = compute_record_hash(rec2)

        assert hash1 == hash2
        assert len(hash1) == 64  # SHA-256 hex length

    def test_hash_excludes_volatile_metadata(self):
        """Created_at, updated_at, and internal timestamps are ignored during checksum hashing."""
        rec1 = {"name": "Alice Smith", "email": "alice@example.com", "created_at": "2024-01-01T00:00:00Z"}
        rec2 = {"name": "Alice Smith", "email": "alice@example.com", "created_at": "2026-08-27T12:00:00Z"}

        assert compute_record_hash(rec1) == compute_record_hash(rec2)

    def test_case_and_whitespace_normalization(self):
        """Whitespace and casing in standard string fields are normalized."""
        rec1 = {"name": "  Alice Smith  ", "country": "UK"}
        rec2 = {"name": "alice smith", "country": "uk"}

        assert compute_record_hash(rec1) == compute_record_hash(rec2)

    def test_different_attributes_yield_different_hashes(self):
        rec1 = {"name": "Alice Smith", "email": "alice@example.com"}
        rec2 = {"name": "Alice Smyth", "email": "alice@example.com"}

        assert compute_record_hash(rec1) != compute_record_hash(rec2)

    def test_empty_store_aggregate_checksum(self):
        """Empty entity lists produce a stable non-empty hash."""
        empty_hash = compute_store_aggregate_checksum([])
        assert empty_hash == hashlib.sha256(b"EMPTY_STORE").hexdigest()


class TestCrossStoreReconciliationScenarios:
    """Tests for drift detection across PostgreSQL, Neo4j, and OpenSearch."""

    def test_healthy_state_when_all_stores_synced(self):
        """When PG, Neo4j, and OpenSearch contain identical entities, status is HEALTHY."""
        records = [
            {"golden_id": "gr-001", "name": "Alice Smith", "email": "alice@example.com", "country": "UK"},
            {"golden_id": "gr-002", "name": "Bob Jones", "email": "bob@example.com", "country": "US"},
            {"golden_id": "gr-003", "name": "Carol White", "email": "carol@example.com", "country": "CA"},
        ]

        report = run_cross_store_reconciliation(
            tenant_id="acme",
            entity_type="Person",
            pg_records=records,
            neo4j_records=records,
            opensearch_records=records,
        )

        assert report.status == "HEALTHY"
        assert report.pg_count == 3
        assert report.neo4j_count == 3
        assert report.opensearch_count == 3
        assert len(report.missing_in_neo4j) == 0
        assert len(report.missing_in_opensearch) == 0
        assert len(report.missing_in_postgres) == 0
        assert report.checksum_match is True
        assert len(report.drift_details) == 0

    def test_drift_detected_when_neo4j_is_missing_entities(self):
        """Detects when Neo4j is missing golden records synced to PostgreSQL."""
        pg_records = [
            {"golden_id": "gr-001", "name": "Alice Smith", "email": "alice@example.com"},
            {"golden_id": "gr-002", "name": "Bob Jones", "email": "bob@example.com"},
            {"golden_id": "gr-003", "name": "Carol White", "email": "carol@example.com"},
        ]
        neo4j_records = [
            {"golden_id": "gr-001", "name": "Alice Smith", "email": "alice@example.com"},
            # gr-002 and gr-003 missing in Neo4j
        ]
        opensearch_records = list(pg_records)

        report = run_cross_store_reconciliation(
            tenant_id="acme",
            entity_type="Person",
            pg_records=pg_records,
            neo4j_records=neo4j_records,
            opensearch_records=opensearch_records,
        )

        assert report.status == "DRIFT_DETECTED"
        assert report.pg_count == 3
        assert report.neo4j_count == 1
        assert report.opensearch_count == 3
        assert "gr-002" in report.missing_in_neo4j
        assert "gr-003" in report.missing_in_neo4j
        assert report.checksum_match is False
        assert len(report.drift_details) == 2

    def test_drift_detected_when_opensearch_is_missing_entities(self):
        """Detects when OpenSearch search index is missing records."""
        pg_records = [
            {"golden_id": "gr-001", "name": "Alice Smith"},
            {"golden_id": "gr-002", "name": "Bob Jones"},
        ]
        neo4j_records = list(pg_records)
        opensearch_records = [
            {"golden_id": "gr-001", "name": "Alice Smith"},
            # gr-002 missing in OpenSearch
        ]

        report = run_cross_store_reconciliation(
            tenant_id="acme",
            entity_type="Person",
            pg_records=pg_records,
            neo4j_records=neo4j_records,
            opensearch_records=opensearch_records,
        )

        assert report.status == "DRIFT_DETECTED"
        assert report.opensearch_count == 1
        assert report.missing_in_opensearch == ["gr-002"]

    def test_attribute_content_drift_with_equal_counts(self):
        """Detects content/attribute mismatch even when record counts are identical."""
        pg_records = [
            {"golden_id": "gr-001", "name": "Alice Smith", "email": "alice@updated.com"},
        ]
        neo4j_records = [
            {"golden_id": "gr-001", "name": "Alice Smith", "email": "alice@old.com"},  # Stale data
        ]
        opensearch_records = [
            {"golden_id": "gr-001", "name": "Alice Smith", "email": "alice@updated.com"},
        ]

        report = run_cross_store_reconciliation(
            tenant_id="acme",
            entity_type="Person",
            pg_records=pg_records,
            neo4j_records=neo4j_records,
            opensearch_records=opensearch_records,
        )

        assert report.status == "DRIFT_DETECTED"
        assert report.pg_count == 1
        assert report.neo4j_count == 1
        assert report.opensearch_count == 1
        assert report.checksum_match is False
        assert len(report.drift_details) == 1
        assert report.drift_details[0]["drift_type"] == "ATTRIBUTE_CONTENT_MISMATCH"

    def test_all_stores_empty(self):
        """When all stores have zero records for a tenant, report status is HEALTHY."""
        report = run_cross_store_reconciliation(
            tenant_id="new-tenant",
            entity_type="Person",
            pg_records=[],
            neo4j_records=[],
            opensearch_records=[],
        )

        assert report.status == "HEALTHY"
        assert report.pg_count == 0
        assert report.neo4j_count == 0
        assert report.opensearch_count == 0
        assert report.checksum_match is True
