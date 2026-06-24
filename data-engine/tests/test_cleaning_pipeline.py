"""
tests/test_cleaning_pipeline.py
-------------------------------
Tests for the Polars cleaning pipeline assets.
"""

import polars as pl
from dagster import build_asset_context

from app.processing.pipelines.cleaning_pipeline import (
    _parse_date_string,
    cleaned_ingestion_data,
    raw_ingestion_data,
    validated_ingestion_data,
)


def test_raw_ingestion_data_returns_dataframe():
    """raw_ingestion_data produces a non-empty Polars DataFrame."""
    ctx = build_asset_context()
    result = raw_ingestion_data(ctx)
    assert isinstance(result, pl.DataFrame)
    assert result.height > 0
    assert "id" in result.columns
    assert "name" in result.columns
    assert "email" in result.columns


def test_cleaned_ingestion_data_removes_duplicates():
    """cleaned_ingestion_data deduplicates by email."""
    ctx = build_asset_context()
    raw = raw_ingestion_data(ctx)
    cleaned = cleaned_ingestion_data(ctx, raw)

    # Should have fewer rows than raw (duplicates removed)
    assert cleaned.height <= raw.height
    # No duplicate emails
    assert cleaned["email"].n_unique() == cleaned.height


def test_cleaned_ingestion_data_lowercases_names():
    """cleaned_ingestion_data lowercases name and email columns."""
    ctx = build_asset_context()
    raw = raw_ingestion_data(ctx)
    cleaned = cleaned_ingestion_data(ctx, raw)

    for name in cleaned["name"].to_list():
        if name:  # skip empty strings
            assert name == name.lower(), f"Name '{name}' is not lowercase"

    for email in cleaned["email"].to_list():
        if email:
            assert email == email.lower(), f"Email '{email}' is not lowercase"


def test_cleaned_ingestion_data_fills_nulls():
    """cleaned_ingestion_data replaces null values."""
    ctx = build_asset_context()
    raw = raw_ingestion_data(ctx)
    cleaned = cleaned_ingestion_data(ctx, raw)

    # String columns should have no nulls
    for col in ["name", "email", "country"]:
        if col in cleaned.columns:
            assert cleaned[col].null_count() == 0, f"Column '{col}' still has nulls"


def test_validated_ingestion_data_filters_invalid():
    """validated_ingestion_data removes rows with empty required fields."""
    ctx = build_asset_context()
    raw = raw_ingestion_data(ctx)
    cleaned = cleaned_ingestion_data(ctx, raw)
    validated = validated_ingestion_data(ctx, cleaned)

    assert isinstance(validated, pl.DataFrame)
    assert validated.height <= cleaned.height

    # All validated rows should have non-empty id and name
    for row_id in validated["id"].to_list():
        assert len(row_id) > 0

    # All validated emails should contain @
    for email in validated["email"].to_list():
        assert "@" in email


def test_parse_date_iso_format():
    """_parse_date_string handles standard ISO dates."""
    result = _parse_date_string("2024-01-15")
    assert "2024-01-15" in result


def test_parse_date_slash_format():
    """_parse_date_string handles DD/MM/YYYY format."""
    result = _parse_date_string("15/03/2024")
    assert "2024" in result
    assert "03" in result


def test_parse_date_invalid_returns_original():
    """_parse_date_string returns original string for unparseable dates."""
    result = _parse_date_string("invalid-date")
    assert result == "invalid-date"


def test_parse_date_none_returns_empty():
    """_parse_date_string returns empty string for None."""
    assert _parse_date_string(None) == ""
    assert _parse_date_string("") == ""
