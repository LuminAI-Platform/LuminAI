"""Tests for Dagster Asset Checks and Data Quality Gates."""

from datetime import datetime, timedelta, timezone

import polars as pl
import pytest
from dagster import (
    AssetCheckResult,
    AssetCheckSeverity,
    materialize,
)

from app.processing.checks.quality_checks import (
    cleaning_max_null_percentage_check,
    cleaning_min_row_count_check,
    cleaning_value_range_check,
    er_referential_integrity_check,
    evaluate_min_row_count,
    evaluate_null_percentages,
    evaluate_referential_integrity,
    evaluate_value_range_constraints,
)
from app.processing.pipelines.cleaning_pipeline import (
    cleaned_ingestion_data,
    raw_ingestion_data,
)
from app.processing.pipelines.er_pipeline import (
    er_blocked_pairs,
    er_classified_pairs,
    er_golden_records,
    er_scored_pairs,
    staged_records_for_er,
)
from app.processing.pipelines.ingest_pipeline import defs


def get_meta(res: AssetCheckResult, key: str, default=None):
    """Safely extract metadata value unwrapping Dagster MetadataValue wrappers."""
    if not res.metadata or key not in res.metadata:
        return default
    val = res.metadata[key]
    if hasattr(val, "value"):
        return val.value
    if hasattr(val, "data"):
        return val.data
    return val


@pytest.fixture
def clean_sample_df() -> pl.DataFrame:
    """Fixture providing a clean, compliant Polars DataFrame."""
    return pl.DataFrame(
        {
            "id": ["rec-001", "rec-002", "rec-003"],
            "name": ["Alice Smith", "Bob Jones", "Carol White"],
            "email": ["alice@example.com", "bob@example.com", "carol@example.com"],
            "age": [34, 28, 45],
            "country": ["UK", "US", "CA"],
            "joined_at": ["2024-01-15T00:00:00Z", "2024-03-20T00:00:00Z", "2024-05-01T00:00:00Z"],
            "salary_amount": [1200.50, 1500.0, 9000.0],
            "score": [0.85, 0.72, 0.91],
        }
    )


class TestMinRowCountCheck:
    """Tests for the minimum row count data quality gate."""

    def test_min_row_count_passes_on_valid_data(self, clean_sample_df):
        res = evaluate_min_row_count(clean_sample_df, min_threshold=1)
        assert isinstance(res, AssetCheckResult)
        assert res.passed is True
        assert get_meta(res, "row_count") == 3

    def test_min_row_count_fails_on_empty_dataframe(self):
        empty_df = pl.DataFrame(schema={"id": pl.Utf8, "name": pl.Utf8})
        res = evaluate_min_row_count(empty_df, min_threshold=1)
        assert res.passed is False
        assert res.severity == AssetCheckSeverity.ERROR
        assert get_meta(res, "row_count") == 0
        assert "below minimum required" in res.description

    def test_direct_asset_check_invocation(self, clean_sample_df):
        res = cleaning_min_row_count_check(clean_sample_df)
        assert res.passed is True


class TestMaxNullPercentageCheck:
    """Tests for column completeness and max null percentage thresholds."""

    def test_max_null_percentage_passes_on_clean_data(self, clean_sample_df):
        res = evaluate_null_percentages(clean_sample_df)
        assert res.passed is True
        violations = get_meta(res, "violations", [])
        assert len(violations) == 0

    def test_max_null_percentage_fails_on_100_percent_null_column(self):
        df_with_empty_col = pl.DataFrame(
            {
                "id": ["rec-001", "rec-002"],
                "name": ["Alice", "Bob"],
                "completely_null": [None, None],
            }
        )
        res = evaluate_null_percentages(df_with_empty_col)
        assert res.passed is False
        assert res.severity == AssetCheckSeverity.ERROR
        assert any("100% null" in v for v in get_meta(res, "violations", []))

    def test_max_null_percentage_fails_on_100_percent_empty_string_column(self):
        df_with_blank_col = pl.DataFrame(
            {
                "id": ["rec-001", "rec-002"],
                "name": ["Alice", "Bob"],
                "blank_col": ["   ", ""],
            }
        )
        res = evaluate_null_percentages(df_with_blank_col)
        assert res.passed is False
        assert any("100% null" in v for v in get_meta(res, "violations", []))

    def test_max_null_percentage_fails_on_missing_mandatory_id(self):
        df_with_missing_id = pl.DataFrame(
            {
                "id": ["rec-001", None],
                "name": ["Alice", "Bob"],
            }
        )
        res = evaluate_null_percentages(df_with_missing_id)
        assert res.passed is False
        assert any("Mandatory identifier 'id'" in v for v in get_meta(res, "violations", []))

    def test_max_null_percentage_fails_on_empty_string_id(self):
        df_with_empty_id = pl.DataFrame(
            {
                "id": ["rec-001", ""],
                "name": ["Alice", "Bob"],
            }
        )
        res = evaluate_null_percentages(df_with_empty_id)
        assert res.passed is False
        assert any("Mandatory identifier 'id'" in v for v in get_meta(res, "violations", []))

    def test_max_null_percentage_fails_when_exceeding_threshold(self):
        df_high_nulls = pl.DataFrame(
            {
                "id": ["rec-001", "rec-002", "rec-003", "rec-004"],
                "optional_field": ["present", None, None, None],  # 75% null > 50%
            }
        )
        res = evaluate_null_percentages(df_high_nulls, max_null_pct=50.0)
        assert res.passed is False
        assert any("exceeds max threshold" in v for v in get_meta(res, "violations", []))

    def test_direct_null_asset_check_invocation(self, clean_sample_df):
        res = cleaning_max_null_percentage_check(clean_sample_df)
        assert res.passed is True


class TestValueRangeConstraintsCheck:
    """Tests for value range constraints (age, dates, salary, score)."""

    def test_value_range_passes_on_valid_data(self, clean_sample_df):
        res = evaluate_value_range_constraints(clean_sample_df)
        assert res.passed is True
        assert get_meta(res, "violations_count") == 0

    def test_value_range_fails_on_negative_age(self):
        df_negative_age = pl.DataFrame(
            {
                "id": ["rec-001"],
                "age": [-5],
            }
        )
        res = evaluate_value_range_constraints(df_negative_age)
        assert res.passed is False
        assert res.severity == AssetCheckSeverity.ERROR
        assert any("Age constraint violation" in v for v in get_meta(res, "violations", []))

    def test_value_range_fails_on_absurd_age(self):
        df_absurd_age = pl.DataFrame(
            {
                "id": ["rec-001"],
                "age": [200],
            }
        )
        res = evaluate_value_range_constraints(df_absurd_age)
        assert res.passed is False
        assert any("Age constraint violation" in v for v in get_meta(res, "violations", []))

    def test_value_range_fails_on_future_joined_at_date(self):
        future_year = (datetime.now(timezone.utc) + timedelta(days=400)).strftime("%Y-%m-%d")
        df_future_date = pl.DataFrame(
            {
                "id": ["rec-001"],
                "joined_at": [f"{future_year}T00:00:00Z"],
            }
        )
        res = evaluate_value_range_constraints(df_future_date)
        assert res.passed is False
        assert any("Future date constraint violation" in v for v in get_meta(res, "violations", []))

    def test_value_range_fails_on_negative_salary(self):
        df_negative_salary = pl.DataFrame(
            {
                "id": ["rec-001"],
                "salary_amount": [-500.0],
            }
        )
        res = evaluate_value_range_constraints(df_negative_salary)
        assert res.passed is False
        assert any("Salary constraint violation" in v for v in get_meta(res, "violations", []))

    def test_direct_value_range_asset_check_invocation(self, clean_sample_df):
        res = cleaning_value_range_check(clean_sample_df)
        assert res.passed is True


class TestReferentialIntegrityCheck:
    """Tests for referential integrity between Golden Records and staging records."""

    def test_referential_integrity_passes_when_all_ids_exist(self):
        staging_df = pl.DataFrame(
            {
                "id": ["rec-001", "rec-002", "rec-003"],
                "raw_id": ["r1", "r2", "r3"],
            }
        )
        golden_df = pl.DataFrame(
            {
                "golden_id": ["gr-1", "gr-2"],
                "source_record_ids": [["rec-001", "rec-002"], ["rec-003"]],
            }
        )
        res = evaluate_referential_integrity(golden_df, staging_df)
        assert res.passed is True
        assert get_meta(res, "missing_references_count") == 0

    def test_referential_integrity_passes_with_raw_id_reference(self):
        staging_df = pl.DataFrame(
            {
                "id": ["internal-uuid-1", "internal-uuid-2"],
                "raw_id": ["source-rec-1", "source-rec-2"],
            }
        )
        golden_df = pl.DataFrame(
            {
                "golden_id": ["gr-1"],
                "source_record_ids": [["source-rec-1", "source-rec-2"]],
            }
        )
        res = evaluate_referential_integrity(golden_df, staging_df)
        assert res.passed is True
        assert get_meta(res, "missing_references_count") == 0

    def test_referential_integrity_fails_when_ids_missing(self):
        staging_df = pl.DataFrame(
            {
                "id": ["rec-001"],
                "raw_id": ["r1"],
            }
        )
        golden_df = pl.DataFrame(
            {
                "golden_id": ["gr-1"],
                "source_record_ids": [["rec-001", "nonexistent-rec-999"]],
            }
        )
        res = evaluate_referential_integrity(golden_df, staging_df)
        assert res.passed is False
        assert res.severity == AssetCheckSeverity.ERROR
        assert get_meta(res, "missing_references_count") == 1
        assert "nonexistent-rec-999" in get_meta(res, "missing_sample", [])

    def test_referential_integrity_fails_on_orphaned_golden_record(self):
        staging_df = pl.DataFrame({"id": ["rec-001"]})
        golden_df = pl.DataFrame(
            {
                "golden_id": ["gr-1"],
                "source_record_ids": [[]],
            }
        )
        res = evaluate_referential_integrity(golden_df, staging_df)
        assert res.passed is False
        assert get_meta(res, "orphaned_golden_records") == 1

    def test_direct_er_check_invocation(self):
        staging_df = pl.DataFrame({"id": ["1", "2"]})
        golden_df = pl.DataFrame({"golden_id": ["g1"], "source_record_ids": [["1", "2"]]})
        res = er_referential_integrity_check(golden_df, staging_df)
        assert res.passed is True


class TestDagsterAssetCheckIntegration:
    """Integration tests executing asset checks with Dagster Definitions and materialize."""

    def test_dagster_definitions_registers_asset_checks(self):
        """Definitions.resolve_asset_graph() includes all 4 quality gate check keys."""
        asset_graph = defs.resolve_asset_graph()
        check_names = {k.name for k in asset_graph.asset_check_keys}
        assert "cleaning_min_row_count_check" in check_names
        assert "cleaning_max_null_percentage_check" in check_names
        assert "cleaning_value_range_check" in check_names
        assert "er_referential_integrity_check" in check_names

    def test_materialize_cleaning_pipeline_with_asset_checks(self):
        """In-process materialize evaluates quality checks on the cleaning pipeline."""
        result = materialize(
            assets=[
                raw_ingestion_data,
                cleaned_ingestion_data,
                cleaning_min_row_count_check,
                cleaning_max_null_percentage_check,
                cleaning_value_range_check,
            ]
        )
        assert result.success is True
        check_evals = result.get_asset_check_evaluations()
        assert len(check_evals) == 3
        for evaluation in check_evals:
            assert evaluation.passed is True, f"Check {evaluation.check_name} failed: {evaluation.metadata}"

    def test_materialize_er_pipeline_with_referential_integrity_check(self):
        """In-process materialize evaluates referential integrity on the ER pipeline."""
        result = materialize(
            assets=[
                staged_records_for_er,
                er_blocked_pairs,
                er_scored_pairs,
                er_classified_pairs,
                er_golden_records,
                er_referential_integrity_check,
            ]
        )
        assert result.success is True
        check_evals = result.get_asset_check_evaluations()
        assert len(check_evals) == 1
        assert check_evals[0].check_name == "er_referential_integrity_check"
        assert check_evals[0].passed is True
