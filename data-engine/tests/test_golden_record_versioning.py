"""Unit and integration tests for Golden Record versioning, audit history, and rollback.

Covers:
1. Initial creation of Golden Record (version 1, action='CREATED').
2. Incremental updates incrementing version (version 2, action='UPDATED').
3. Snapshot retrieval via get_golden_record_history.
4. Point-in-time rollback restoring prior attributes with new version (action='ROLLBACK').
5. REST API endpoints:
   - GET /process/golden-records/{id}
   - GET /process/golden-records/{id}/history
   - POST /process/golden-records/{id}/rollback
"""

import uuid
from fastapi.testclient import TestClient
import polars as pl
import pytest

from app.main import app
from app.processing.er.golden_record import (
    get_golden_record,
    get_golden_record_history,
    merge_cluster_to_golden_record,
    persist_golden_records,
    rollback_golden_record,
)


class TestGoldenRecordVersioning:
    """Test suite for Golden Record versioning and historical rollback."""

    def test_merge_cluster_has_version_metadata(self):
        cluster = [
            {"id": "r1", "full_name": "Bob Smith", "email": "bob@example.com"},
            {"id": "r2", "full_name": "Robert Smith", "phone": "+1-555-0100"},
        ]
        gr = merge_cluster_to_golden_record(cluster, tenant_id="acme", golden_id="gr-test-01")
        assert gr["golden_id"] == "gr-test-01"
        assert gr["version"] == 1
        assert "created_at" in gr
        assert "updated_at" in gr
        assert gr["full_name"] in ("Bob Smith", "Robert Smith")

    def test_persist_initial_and_update_increments_version(self):
        gid = f"gr-vers-{uuid.uuid4().hex[:8]}"

        # 1. Initial version
        df_v1 = pl.DataFrame([{
            "golden_id": gid,
            "tenant_id": "acme",
            "cluster_size": 2,
            "source_record_ids": ["src-1", "src-2"],
            "full_name": "Alice Cooper",
            "email": "alice@v1.com",
        }])
        count1 = persist_golden_records(df_v1)
        assert count1 == 1

        rec_v1 = get_golden_record(gid)
        assert rec_v1 is not None
        assert rec_v1["version"] == 1
        assert rec_v1["attributes"]["email"] == "alice@v1.com"

        # Check history has 1 entry
        history1 = get_golden_record_history(gid)
        assert len(history1) == 1
        assert history1[0]["version"] == 1
        assert history1[0]["action"] == "CREATED"
        assert history1[0]["attributes"]["email"] == "alice@v1.com"

        # 2. Update with modified email
        df_v2 = pl.DataFrame([{
            "golden_id": gid,
            "tenant_id": "acme",
            "cluster_size": 3,
            "source_record_ids": ["src-1", "src-2", "src-3"],
            "full_name": "Alice Cooper",
            "email": "alice@v2-updated.com",
        }])
        count2 = persist_golden_records(df_v2)
        assert count2 == 1

        rec_v2 = get_golden_record(gid)
        assert rec_v2 is not None
        assert rec_v2["version"] == 2
        assert rec_v2["attributes"]["email"] == "alice@v2-updated.com"
        assert rec_v2["cluster_size"] == 3

        # History should now have 2 entries
        history2 = get_golden_record_history(gid)
        assert len(history2) == 2
        assert history2[0]["version"] == 2
        assert history2[0]["action"] == "UPDATED"
        assert history2[1]["version"] == 1

        # 3. Rollback to version 1
        restored = rollback_golden_record(gid, target_version=1)
        assert restored["version"] == 3
        assert restored["attributes"]["email"] == "alice@v1.com"
        assert restored["cluster_size"] == 2

        # History should now have 3 entries (v3 with action ROLLBACK)
        history3 = get_golden_record_history(gid)
        assert len(history3) == 3
        assert history3[0]["version"] == 3
        assert history3[0]["action"] == "ROLLBACK"
        assert history3[0]["attributes"]["email"] == "alice@v1.com"

    def test_rollback_invalid_version_raises_error(self):
        gid = f"gr-invalid-{uuid.uuid4().hex[:8]}"
        df = pl.DataFrame([{
            "golden_id": gid,
            "tenant_id": "acme",
            "cluster_size": 1,
            "source_record_ids": ["src-1"],
            "full_name": "Charlie",
        }])
        persist_golden_records(df)

        with pytest.raises(ValueError, match="not found in history"):
            rollback_golden_record(gid, target_version=999)


class TestGoldenRecordApiEndpoints:
    """API endpoint tests for golden record versioning and rollback."""

    def test_api_golden_record_lifecycle(self):
        client = TestClient(app)
        gid = f"gr-api-{uuid.uuid4().hex[:8]}"

        # Persist v1
        df_v1 = pl.DataFrame([{
            "golden_id": gid,
            "tenant_id": "acme",
            "cluster_size": 2,
            "source_record_ids": ["rec-a", "rec-b"],
            "full_name": "Daniel Craig",
            "company": "MI6",
        }])
        persist_golden_records(df_v1)

        # GET /process/golden-records/{id}
        res = client.get(f"/process/golden-records/{gid}")
        assert res.status_code == 200
        data = res.json()
        assert data["golden_id"] == gid
        assert data["version"] == 1
        assert data["attributes"]["company"] == "MI6"

        # Persist v2
        df_v2 = pl.DataFrame([{
            "golden_id": gid,
            "tenant_id": "acme",
            "cluster_size": 2,
            "source_record_ids": ["rec-a", "rec-b"],
            "full_name": "Daniel Craig",
            "company": "Universal Pictures",
        }])
        persist_golden_records(df_v2)

        # GET /process/golden-records/{id}/history
        res_hist = client.get(f"/process/golden-records/{gid}/history")
        assert res_hist.status_code == 200
        hist_data = res_hist.json()
        assert hist_data["total_versions"] == 2
        assert hist_data["history"][0]["version"] == 2

        # POST /process/golden-records/{id}/rollback to v1
        res_rollback = client.post(
            f"/process/golden-records/{gid}/rollback",
            json={"target_version": 1},
        )
        assert res_rollback.status_code == 200
        rb_data = res_rollback.json()
        assert "successfully rolled back" in rb_data["message"]
        assert rb_data["golden_record"]["version"] == 3
        assert rb_data["golden_record"]["attributes"]["company"] == "MI6"

    def test_api_golden_record_not_found(self):
        client = TestClient(app)
        res = client.get("/process/golden-records/gr-non-existent-999")
        assert res.status_code == 404
