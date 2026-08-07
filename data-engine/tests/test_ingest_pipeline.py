"""Tests for the Dagster workspace and ingest pipeline

Verifies:
  - Dagster Definitions object loads correctly with all registered assets.
  - raw_data_placeholder asset produces a valid Polars DataFrame.
  - cleaned_data_placeholder asset cleans and deduplicates upstream data.
  - Asset dependency graph is correctly wired.
"""

import polars as pl
import pytest
from dagster import build_asset_context

from app.processing.pipelines.ingest_pipeline import (
    cleaned_data_placeholder,
    defs,
    raw_data_placeholder,
)


class TestDagsterDefinitions:
    """Tests for Dagster Definitions object and asset registration."""

    def test_definitions_object_exists(self):
        """Definitions object is correctly instantiated."""
        assert defs is not None

    def test_definitions_has_assets(self):
        """Definitions includes registered asset definitions."""
        asset_graph = defs.resolve_asset_graph()
        asset_keys = [key.to_user_string() for key in asset_graph.get_all_asset_keys()]
        assert len(asset_keys) > 0

    def test_placeholder_assets_registered(self):
        """Both placeholder assets are registered in Definitions."""
        asset_graph = defs.resolve_asset_graph()
        asset_keys = [key.to_user_string() for key in asset_graph.get_all_asset_keys()]
        assert "raw_data_placeholder" in asset_keys
        assert "cleaned_data_placeholder" in asset_keys

    def test_cleaning_pipeline_assets_registered(self):
        """Core cleaning pipeline assets are registered in Definitions."""
        asset_graph = defs.resolve_asset_graph()
        asset_keys = [key.to_user_string() for key in asset_graph.get_all_asset_keys()]
        assert "raw_ingestion_data" in asset_keys
        assert "cleaned_ingestion_data" in asset_keys
        assert "deduplicated_ingestion_data" in asset_keys
        assert "validated_ingestion_data" in asset_keys
        assert "staged_ingestion_data" in asset_keys


class TestRawDataPlaceholder:
    """Tests for the raw_data_placeholder Dagster asset."""

    def test_returns_polars_dataframe(self):
        """raw_data_placeholder produces a Polars DataFrame."""
        ctx = build_asset_context()
        result = raw_data_placeholder(ctx)
        assert isinstance(result, pl.DataFrame)

    def test_dataframe_is_not_empty(self):
        """raw_data_placeholder returns a non-empty DataFrame."""
        ctx = build_asset_context()
        result = raw_data_placeholder(ctx)
        assert result.height > 0, "DataFrame should have at least one row"

    def test_has_expected_columns(self):
        """raw_data_placeholder includes id, name, email, age, country columns."""
        ctx = build_asset_context()
        result = raw_data_placeholder(ctx)
        expected_cols = {"id", "name", "email", "age", "country"}
        actual_cols = set(result.columns)
        assert expected_cols.issubset(actual_cols), (
            f"Missing columns: {expected_cols - actual_cols}"
        )

    def test_id_column_has_string_type(self):
        """id column is a string type."""
        ctx = build_asset_context()
        result = raw_data_placeholder(ctx)
        assert result["id"].dtype in (pl.Utf8, pl.String)

    def test_age_column_has_numeric_type(self):
        """age column is a numeric type."""
        ctx = build_asset_context()
        result = raw_data_placeholder(ctx)
        assert result["age"].dtype in (pl.Int64, pl.Int32, pl.Float64)

    def test_has_five_records(self):
        """raw_data_placeholder generates exactly 5 synthetic records."""
        ctx = build_asset_context()
        result = raw_data_placeholder(ctx)
        assert result.height == 5


class TestCleanedDataPlaceholder:
    """Tests for the cleaned_data_placeholder Dagster asset."""

    @pytest.fixture()
    def raw_df(self):
        """Produce the raw DataFrame for use in cleaned tests."""
        ctx = build_asset_context()
        return raw_data_placeholder(ctx)

    def test_returns_polars_dataframe(self, raw_df):
        """cleaned_data_placeholder produces a Polars DataFrame."""
        ctx = build_asset_context()
        result = cleaned_data_placeholder(ctx, raw_df)
        assert isinstance(result, pl.DataFrame)

    def test_removes_duplicate_emails(self, raw_df):
        """cleaned_data_placeholder deduplicates by email."""
        ctx = build_asset_context()
        result = cleaned_data_placeholder(ctx, raw_df)
        assert result["email"].n_unique() == result.height, (
            "All emails should be unique after deduplication"
        )

    def test_reduces_row_count(self, raw_df):
        """Cleaning reduces or maintains row count (never increases)."""
        ctx = build_asset_context()
        result = cleaned_data_placeholder(ctx, raw_df)
        assert result.height <= raw_df.height

    def test_names_are_lowercased(self, raw_df):
        """Names are lowercased after cleaning."""
        ctx = build_asset_context()
        result = cleaned_data_placeholder(ctx, raw_df)
        for name in result["name"].to_list():
            assert name == name.lower(), f"Name '{name}' should be lowercase"

    def test_emails_are_lowercased(self, raw_df):
        """Emails are lowercased after cleaning."""
        ctx = build_asset_context()
        result = cleaned_data_placeholder(ctx, raw_df)
        for email in result["email"].to_list():
            assert email == email.lower(), f"Email '{email}' should be lowercase"

    def test_names_are_stripped(self, raw_df):
        """Names have no leading/trailing whitespace after cleaning."""
        ctx = build_asset_context()
        result = cleaned_data_placeholder(ctx, raw_df)
        for name in result["name"].to_list():
            assert name == name.strip(), f"Name '{name}' has whitespace"

    def test_output_is_sorted_by_id(self, raw_df):
        """Output DataFrame is sorted by the id column."""
        ctx = build_asset_context()
        result = cleaned_data_placeholder(ctx, raw_df)
        ids = result["id"].to_list()
        assert ids == sorted(ids), "Output should be sorted by id"

    def test_preserves_column_schema(self, raw_df):
        """Cleaned output retains the same column names as the raw input."""
        ctx = build_asset_context()
        result = cleaned_data_placeholder(ctx, raw_df)
        assert set(result.columns) == set(raw_df.columns)


class TestDagsterWorkspaceConfig:
    """Tests for dagster_workspace.yaml configuration."""

    def test_workspace_yaml_parseable(self):
        """dagster_workspace.yaml can be parsed as valid YAML."""
        import yaml

        with open("dagster_workspace.yaml") as f:
            config = yaml.safe_load(f)
        assert config is not None

    def test_workspace_has_load_from(self):
        """Workspace config contains a load_from directive."""
        import yaml

        with open("dagster_workspace.yaml") as f:
            config = yaml.safe_load(f)
        assert "load_from" in config

    def test_workspace_points_to_ingest_pipeline(self):
        """Workspace config references the ingest_pipeline module."""
        import yaml

        with open("dagster_workspace.yaml") as f:
            config = yaml.safe_load(f)
        modules = config["load_from"]
        module_names = [
            entry.get("python_module", {}).get("module_name", "")
            for entry in modules
        ]
        assert "app.processing.pipelines.ingest_pipeline" in module_names
