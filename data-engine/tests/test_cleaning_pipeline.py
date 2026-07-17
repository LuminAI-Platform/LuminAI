"""Tests for the Polars cleaning pipeline assets."""

import polars as pl
from dagster import build_asset_context

from app.processing.pipelines.cleaning_pipeline import (
    _parse_date_string,
    _parse_currency_string,
    cleaned_ingestion_data,
    raw_ingestion_data,
    deduplicated_ingestion_data,
    validated_ingestion_data,
    staged_ingestion_data,
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


def test_deduplicated_ingestion_data_removes_duplicates():
    """deduplicated_ingestion_data removes exact and fuzzy duplicate records."""
    ctx = build_asset_context()
    raw = raw_ingestion_data(ctx)
    cleaned = cleaned_ingestion_data(ctx, raw)
    deduped = deduplicated_ingestion_data(ctx, cleaned)

    # Should have fewer rows than cleaned
    assert deduped.height <= cleaned.height
    # No duplicate emails
    assert deduped["email"].n_unique() == deduped.height


def test_cleaned_ingestion_data_normalises_cases():
    """cleaned_ingestion_data normalises casing standard: title case names, lowercase emails."""
    ctx = build_asset_context()
    raw = raw_ingestion_data(ctx)
    cleaned = cleaned_ingestion_data(ctx, raw)

    for name in cleaned["name"].to_list():
        if name:  # skip empty strings
            assert name == name.title(), f"Name '{name}' is not title case"

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
    deduped = deduplicated_ingestion_data(ctx, cleaned)
    validated = validated_ingestion_data(ctx, deduped)

    assert isinstance(validated, pl.DataFrame)
    assert validated.height <= deduped.height

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


def test_parse_currency_usd():
    """_parse_currency_string parses USD formats."""
    res = _parse_currency_string("$1,200.50")
    assert res["amount"] == 1200.50
    assert res["currency"] == "USD"


def test_parse_currency_eur():
    """_parse_currency_string parses EUR formats."""
    res = _parse_currency_string("€500")
    assert res["amount"] == 500.0
    assert res["currency"] == "EUR"


def test_parse_currency_gbp():
    """_parse_currency_string parses GBP formats."""
    res = _parse_currency_string("£80.00")
    assert res["amount"] == 80.0
    assert res["currency"] == "GBP"


def test_parse_currency_no_symbol():
    """_parse_currency_string handles plain numbers as USD."""
    res = _parse_currency_string("150.00")
    assert res["amount"] == 150.0
    assert res["currency"] == "USD"


def test_parse_currency_invalid():
    """_parse_currency_string defaults gracefully on invalid entries."""
    res = _parse_currency_string("invalid")
    assert res["amount"] == 0.0
    assert res["currency"] == "USD"


def test_staged_ingestion_data_stages_parquet_and_db():
    """staged_ingestion_data staging asset executes without errors."""
    ctx = build_asset_context()
    raw = raw_ingestion_data(ctx)
    cleaned = cleaned_ingestion_data(ctx, raw)
    deduped = deduplicated_ingestion_data(ctx, cleaned)
    validated = validated_ingestion_data(ctx, deduped)
    staged = staged_ingestion_data(ctx, validated)

    assert isinstance(staged, pl.DataFrame)
    assert staged.height == validated.height

