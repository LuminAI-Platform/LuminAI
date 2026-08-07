"""Unit tests for TASK S2-11: ER Provenance Tracking Engine."""

from app.processing.er.provenance import (
    persist_provenance_records,
    track_field_provenance,
)


class TestProvenanceTracking:
    """Tests for field-level provenance extraction and persistence."""

    def test_track_field_provenance_maps_attributes(self):
        golden_record = {
            "golden_id": "gr-100",
            "name": "Alice Smith",
            "email": "alice@example.com",
            "country": "UK",
        }

        cluster_records = [
            {"id": "rec-1", "source_id": "src-a", "name": "Alice", "country": "UK"},
            {"id": "rec-2", "source_id": "src-b", "name": "Alice Smith", "email": "alice@example.com"},
        ]

        entries = track_field_provenance(golden_record, cluster_records, tenant_id="acme")
        assert len(entries) == 3

        attr_map = {e["attribute_name"]: e for e in entries}

        assert attr_map["name"]["source_record_id"] == "rec-2"
        assert attr_map["name"]["source_id"] == "src-b"

        assert attr_map["country"]["source_record_id"] == "rec-1"
        assert attr_map["country"]["source_id"] == "src-a"

    def test_persist_provenance_records(self):
        entries = [
            {
                "golden_id": "gr-100",
                "tenant_id": "acme",
                "attribute_name": "name",
                "attribute_value": "Alice Smith",
                "source_record_id": "rec-2",
                "source_id": "src-b",
                "confidence_score": 0.95,
            }
        ]

        count = persist_provenance_records(entries, tenant_id="acme")
        assert count == 1
