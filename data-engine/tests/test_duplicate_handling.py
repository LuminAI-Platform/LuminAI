"""Regression tests for duplicate detection, collapsing, ER blocking, and idempotent persistence."""

from __future__ import annotations

from unittest.mock import MagicMock, patch
import uuid

from fastapi.testclient import TestClient
import polars as pl
from sqlalchemy import create_engine, text

from app.db import ensure_tables_exist
from app.main import app
from app.processing.engine.dataset_cleaner import DatasetCleaner
from app.processing.er.blocking import generate_candidate_pairs
from app.processing.er.classification import persist_review_candidates
from app.processing.er.comparison import compare_candidate_pairs
from app.processing.er.golden_record.merging import merge_cluster_to_golden_record
from app.processing.pipelines.cleaning_pipeline.staging_ops import _replace_and_insert_staging_rows
from app.processing.pipelines.er_pipeline.staging_ops import _load_records_from_conn
from app.processing.trigger import DagsterTrigger


def test_clean_dataset_sync_collapses_duplicates_and_preserves_survivorship():
    """POST /process/dataset/clean removes duplicates from rows and enriches surviving record."""
    client = TestClient(app)
    rows = [
        {"id": "r1", "canonical_name": "Ama Mensah", "primary_email": "ama@gh.org", "phone_e164": ""},
        {"id": "r2", "canonical_name": "AMA MENSAH", "primary_email": "AMA@GH.ORG", "phone_e164": "+233201234567"},
        {"id": "r3", "canonical_name": "Kofi Boateng", "primary_email": "kofi@gh.org", "phone_e164": "+233241112222"},
    ]

    resp = client.post(
        "/process/dataset/clean",
        json={
            "tenant_id": "acme",
            "source_id": "conn-alias",
            "rows": rows,
            "options": {"include_golden_records": False},
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["totalRawRecords"] == 3
    assert body["duplicatesMerged"] == 1
    assert body["totalCleanRecords"] == 2
    assert len(body["rows"]) == 2
    ama_row = next(r for r in body["rows"] if r["primary_email"] == "ama@gh.org")
    assert ama_row["phone_e164"] == "+233201234567"


def test_dataset_cleaner_deduplicates_generic_exact_rows_without_false_merges():
    """Generic tables without person columns deduplicate identical rows, not distinct IDs."""
    df_no_id = pl.DataFrame(
        [
            {"sku": "SKU-1", "category": "Hardware", "price": 19.99},
            {"sku": "SKU-1", "category": "Hardware", "price": 19.99},
            {"sku": "SKU-2", "category": "Software", "price": 49.00},
        ]
    )
    res_no_id = DatasetCleaner(tenant_id="acme").process_dataframe(df_no_id, build_golden_records=False)
    assert res_no_id.duplicates_merged == 1
    assert res_no_id.total_clean_records == 2
    assert len(res_no_id.records) == 2

    df_distinct_tx = pl.DataFrame(
        [
            {"id": "TX-1", "sku": "SKU-1", "price": 19.99},
            {"id": "TX-2", "sku": "SKU-1", "price": 19.99},
        ]
    )
    res_tx = DatasetCleaner(tenant_id="acme").process_dataframe(df_distinct_tx, build_golden_records=False)
    assert res_tx.duplicates_merged == 0
    assert res_tx.total_clean_records == 2


def test_dataset_cleaner_transitive_union_and_contradiction_guard():
    """Transitive matches merge A-B-C unless verified identifiers conflict."""
    df_transitive = pl.DataFrame(
        [
            {"id": "1", "name": "Alice Smith", "email": "alice@corp.com", "phone": "", "mrn": "MRN-1"},
            {"id": "2", "name": "Alice Smith", "email": "alice@corp.com", "phone": "555-0101", "mrn": ""},
            {"id": "3", "name": "Alice Smith", "email": "", "phone": "555-0101", "mrn": "MRN-1"},
        ]
    )
    res = DatasetCleaner(tenant_id="acme").process_dataframe(df_transitive, build_golden_records=False)
    assert res.duplicates_merged == 2
    assert res.total_clean_records == 1

    df_conflict = pl.DataFrame(
        [
            {"id": "1", "name": "Alice Smith", "email": "alice@corp.com", "phone": "", "mrn": "MRN-1"},
            {"id": "2", "name": "Alice Smith", "email": "alice@corp.com", "phone": "555-0101", "mrn": ""},
            {"id": "3", "name": "Alice Smith", "email": "", "phone": "555-0101", "mrn": "MRN-999"},
        ]
    )
    res_conflict = DatasetCleaner(tenant_id="acme").process_dataframe(df_conflict, build_golden_records=False)
    assert res_conflict.duplicates_merged == 1
    assert res_conflict.total_clean_records == 2


def test_er_blocking_and_comparison_support_aliases_and_id_or_email_matches():
    """ER blocking and scoring detect duplicates with full_name/canonical_name and exact ID/email."""
    df = pl.DataFrame(
        [
            {"id": "1", "full_name": "Alice Smith", "contact_email": "alice@corp.com", "national_id": "NAT-1", "country": "US"},
            {"id": "2", "full_name": "A. Smith", "contact_email": "alice@corp.com", "national_id": "NAT-1", "country": "UK"},
            {"id": "3", "full_name": "Bob Jones", "contact_email": "bob@corp.com", "national_id": "NAT-2", "country": "US"},
        ]
    )
    pairs = generate_candidate_pairs(df)
    assert pairs.height == 1
    scored = compare_candidate_pairs(pairs)
    assert scored["confidence_score"][0] >= 0.95


def test_persist_review_candidates_is_idempotent(tmp_path, monkeypatch):
    """Repeated ER runs update existing PENDING candidates without creating duplicates."""
    sqlite_path = tmp_path / "er_test.db"
    sqlite_engine = create_engine(f"sqlite:///{sqlite_path}")
    ensure_tables_exist(sqlite_engine)

    monkeypatch.setattr("app.db.get_engine", lambda: (_ for _ in ()).throw(RuntimeError("offline")))
    monkeypatch.setattr("app.db.get_sqlite_engine", lambda *_args, **_kwargs: sqlite_engine)
    monkeypatch.setattr("app.db.ensure_tables_exist", ensure_tables_exist)

    review_df = pl.DataFrame(
        {
            "id_a": ["rec-a"],
            "id_b": ["rec-b"],
            "confidence_score": [0.78],
            "name_a": ["Alice Smith"],
            "name_b": ["Alice Smyth"],
        }
    )
    assert persist_review_candidates(review_df, tenant_id="acme") == 1
    assert persist_review_candidates(review_df, tenant_id="acme") == 1

    with sqlite_engine.connect() as conn:
        cnt = conn.execute(text("SELECT COUNT(*) FROM er_candidates")).scalar()
        assert cnt == 1

        # Rejecting the candidate prevents re-creating a PENDING duplicate on subsequent scans
        conn.execute(text("UPDATE er_candidates SET status = 'REJECTED'"))
        conn.commit()

    assert persist_review_candidates(review_df, tenant_id="acme") == 0
    with sqlite_engine.connect() as conn:
        cnt_after = conn.execute(text("SELECT COUNT(*) FROM er_candidates")).scalar()
        assert cnt_after == 1


def test_staging_replacement_and_deterministic_golden_id(tmp_path):
    """Re-staging replaces prior rows for source_id and merged Golden Records keep deterministic IDs."""
    db_path = tmp_path / "staging.db"
    engine = create_engine(f"sqlite:///{db_path}")
    ensure_tables_exist(engine)

    insert_sql = """
    INSERT INTO staging_records (id, tenant_id, source_id, raw_id, data, staged_at)
    VALUES (:id, :tenant_id, :source_id, :raw_id, :data, :staged_at);
    """
    df = pl.DataFrame([{"id": "1", "name": "Alice"}, {"id": "2", "name": "Bob"}])

    _replace_and_insert_staging_rows(engine, insert_sql, df, tenant_id="acme", source_id="conn-1")
    _replace_and_insert_staging_rows(engine, insert_sql, df, tenant_id="acme", source_id="conn-1")

    with engine.connect() as conn:
        loaded = _load_records_from_conn(conn, tenant_id="acme", safe_limit=None)
    assert len(loaded) == 2

    gr1 = merge_cluster_to_golden_record([{"raw_id": "1", "name": "Alice"}], tenant_id="acme")
    gr2 = merge_cluster_to_golden_record([{"raw_id": "1", "name": "Alice"}], tenant_id="acme")
    assert gr1["golden_id"] == gr2["golden_id"]


def test_kafka_batch_complete_auto_triggers_er():
    """Cleaning pipeline triggered with batch_complete=True chains ER automatically."""
    mock_result = MagicMock()
    mock_result.success = True
    mock_result.run_id = "dagster-run-kafka-1"
    mock_result.all_events = []

    trigger = DagsterTrigger()
    with (
        patch("app.processing.trigger.materialize", return_value=mock_result),
        patch.object(trigger, "trigger_er_pipeline") as mock_er,
    ):
        trigger.trigger_cleaning_pipeline(
            tenant_id=str(uuid.uuid4()),
            source_id="conn-1",
            batch_metadata={"batch_complete": True},
        )
    mock_er.assert_called_once()


def test_numbered_distinct_entities_do_not_over_merge():
    """Distinct entities differing only by numeric suffix in name/email must stay distinct."""
    rows = [{"id": f"r-{i}", "name": "John Unique", "email": f"user{i}@example.com"} for i in range(60)]
    rows.append({"id": "r-dup-5", "name": "John Unique", "email": "user5@example.com"})
    res = DatasetCleaner(tenant_id="acme").process_dataframe(pl.DataFrame(rows), build_golden_records=False)
    assert res.duplicates_merged == 1
    assert res.total_clean_records == 60

