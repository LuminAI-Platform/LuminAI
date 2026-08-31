"""Unit and integration tests for the Dagster Entity Resolution (ER) Pipeline."""

import polars as pl
from dagster import build_asset_context, materialize_to_memory

from app.processing.pipelines import er_pipeline


class TestERPipelineExecution:
    """Tests for individual ER pipeline assets and end-to-end Dagster execution."""

    def test_staged_records_for_er_asset(self):
        context = build_asset_context()
        df = er_pipeline.staged_records_for_er(context)
        assert isinstance(df, pl.DataFrame)
        assert df.height >= 5
        assert "id" in df.columns
        assert "name" in df.columns

    def test_er_blocked_pairs_asset(self):
        context = build_asset_context()
        records_df = pl.DataFrame(
            [
                {"id": "1", "name": "Alice Smith", "country": "UK", "entity_type": "Person"},
                {"id": "2", "name": "Alice Smyth", "country": "UK", "entity_type": "Person"},
                {"id": "3", "name": "Carol White", "country": "US", "entity_type": "Person"},
            ]
        )
        pairs_df = er_pipeline.er_blocked_pairs(context, records_df)
        assert isinstance(pairs_df, pl.DataFrame)
        assert pairs_df.height == 1  # 1 and 2 match blocking key
        row = pairs_df.to_dicts()[0]
        assert row["id_a"] == "1"
        assert row["id_b"] == "2"

    def test_er_scored_and_classified_assets(self):
        context = build_asset_context()
        pairs_df = pl.DataFrame(
            [
                {
                    "id_a": "1",
                    "id_b": "2",
                    "name_a": "Alice Smith",
                    "name_b": "Alice Smyth",
                    "email_a": "alice@example.com",
                    "email_b": "alice@example.com",
                    "dob_a": "1990-01-01",
                    "dob_b": "1990-01-01",
                },
                {
                    "id_a": "3",
                    "id_b": "4",
                    "name_a": "Bob Jones",
                    "name_b": "Carol White",
                    "email_a": "bob@example.com",
                    "email_b": "carol@example.com",
                    "dob_a": "1980-01-01",
                    "dob_b": "1990-01-01",
                },
            ]
        )

        scored = er_pipeline.er_scored_pairs(context, pairs_df)
        assert "confidence_score" in scored.columns
        assert scored.height == 2

        classified_matches = er_pipeline.er_classified_pairs(context, scored)
        assert classified_matches.height == 1  # High confidence pair is a match

    def test_er_golden_records_asset(self):
        context = build_asset_context()
        matches_df = pl.DataFrame([{"id_a": "rec-1", "id_b": "rec-2"}])
        staged_df = pl.DataFrame(
            [
                {"id": "rec-1", "name": "Alice", "country": "UK", "email": "alice@example.com"},
                {"id": "rec-2", "name": "Alice Smith", "country": "UK", "email": "alice@example.com"},
                {"id": "rec-3", "name": "Carol White", "country": "US", "email": "carol@example.com"},
            ]
        )

        golden_records = er_pipeline.er_golden_records(context, matches_df, staged_df)
        assert isinstance(golden_records, pl.DataFrame)
        assert golden_records.height == 2  # 1 merged cluster + 1 single record
        assert "golden_id" in golden_records.columns

    def test_full_er_pipeline_materialization(self):
        """Verify full Dagster pipeline executes in-memory from end-to-end without errors."""
        result = materialize_to_memory(
            [
                er_pipeline.staged_records_for_er,
                er_pipeline.er_blocked_pairs,
                er_pipeline.er_scored_pairs,
                er_pipeline.er_classified_pairs,
                er_pipeline.er_golden_records,
            ]
        )
        assert result.success is True
