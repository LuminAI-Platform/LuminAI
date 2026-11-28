"""Tests for numeric histograms, EDA extensions, DataProfiler histograms, and DuckDB distribution analytics."""

from __future__ import annotations

import json
from datetime import datetime
from unittest.mock import patch

from fastapi.testclient import TestClient
import polars as pl
import pytest

from app.main import app
from app.processing.analytics_engine import DuckDBAnalyticsEngine
from app.processing.engine.eda_engine import EdaEngine
from app.processing.engine.profiler import DataProfiler
from app.processing.engine.stats_utils import compute_numeric_histogram

client = TestClient(app)


def test_compute_numeric_histogram_buckets_and_constant_values():
    assert compute_numeric_histogram([]) == []

    const_hist = compute_numeric_histogram([42.0, 42.0, 42.0], bins=5)
    assert len(const_hist) == 1
    assert const_hist[0]["count"] == 3
    assert const_hist[0]["percentage"] == 100.0
    assert const_hist[0]["label"] == "42"

    vals = [10, 15, 22, 28, 35, 44, 51, 63, 78, 90]
    hist = compute_numeric_histogram(vals, bins=4)
    assert len(hist) == 4
    assert sum(b["count"] for b in hist) == len(vals)
    assert hist[0]["bin_start"] == 10.0
    assert hist[-1]["bin_end"] == 90.0


def test_eda_engine_emits_histograms_and_other_count():
    rows = [
        {"city": f"City_{i % 10}", "amount": 100.0 + i * 25.0}
        for i in range(20)
    ]
    df = pl.DataFrame(rows)
    report = EdaEngine.generate_eda_report(df)

    amount_stats = report["numeric_statistics"]["amount"]
    assert "histogram" in amount_stats
    assert len(amount_stats["histogram"]) >= 5
    assert sum(b["count"] for b in amount_stats["histogram"]) == 20

    city_stats = report["categorical_statistics"]["city"]
    assert len(city_stats["top_categories"]) == 8
    assert city_stats["other_count"] == 4


def test_profiler_emits_numeric_histograms():
    records = [
        {"name": "Alice", "age": 24},
        {"name": "Bob", "age": 31},
        {"name": "Carol", "age": 42},
        {"name": "Dave", "age": 55},
        {"name": "Eve", "age": 63},
    ]
    df = pl.DataFrame(records)
    report = DataProfiler().profile_dataset(df).to_dict()

    assert report["columns"]["name"]["histogram"] == []
    age_hist = report["columns"]["age"]["histogram"]
    assert len(age_hist) >= 4
    assert sum(b["count"] for b in age_hist) == 5


@pytest.fixture
def golden_distribution_df() -> pl.DataFrame:
    return pl.DataFrame(
        [
            {
                "golden_id": "g-1",
                "tenant_id": "tenant_a",
                "entity_type": "Person",
                "confidence_score": 0.95,
                "attributes": json.dumps({"country": "GH", "age": 22}),
                "created_at": datetime(2025, 1, 1),
            },
            {
                "golden_id": "g-2",
                "tenant_id": "tenant_a",
                "entity_type": "Person",
                "confidence_score": 0.88,
                "attributes": json.dumps({"country": "GH", "age": 34}),
                "created_at": datetime(2025, 1, 2),
            },
            {
                "golden_id": "g-3",
                "tenant_id": "tenant_a",
                "entity_type": "Person",
                "confidence_score": 0.72,
                "attributes": json.dumps({"country": "KE", "age": 48}),
                "created_at": datetime(2025, 1, 3),
            },
            {
                "golden_id": "g-4",
                "tenant_id": "tenant_b",
                "entity_type": "Person",
                "confidence_score": 0.99,
                "attributes": json.dumps({"country": "US", "age": 60}),
                "created_at": datetime(2025, 1, 4),
            },
        ]
    )


def test_duckdb_distribution_categorical_and_histogram(golden_distribution_df):
    engine = DuckDBAnalyticsEngine(override_df=golden_distribution_df)

    cat = engine.execute_distribution(
        tenant_id="tenant_a",
        field="country",
        mode="auto",
    )
    assert cat["mode"] == "categorical"
    assert cat["total_count"] == 3
    assert cat["buckets"][0]["label"] == "GH"
    assert cat["buckets"][0]["count"] == 2
    assert cat["buckets"][1]["label"] == "KE"

    hist = engine.execute_distribution(
        tenant_id="tenant_a",
        field="age",
        mode="histogram",
        bins=3,
    )
    assert hist["mode"] == "histogram"
    assert hist["total_count"] == 3
    assert len(hist["buckets"]) == 3
    assert sum(b["count"] for b in hist["buckets"]) == 3

    with pytest.raises(ValueError):
        engine.execute_distribution(tenant_id="tenant_a", field="bad;drop table")


def test_api_analytics_distribution_endpoint(golden_distribution_df):
    with patch.object(
        DuckDBAnalyticsEngine,
        "load_table_dataframe",
        return_value=golden_distribution_df,
    ):
        resp = client.post(
            "/analytics/distribution",
            json={
                "tenant_id": "tenant_a",
                "field": "country",
                "mode": "categorical",
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["tenant_id"] == "tenant_a"
        assert body["mode"] == "categorical"
        assert body["total_count"] == 3
        assert body["buckets"][0]["label"] == "GH"

        bad_resp = client.post(
            "/analytics/distribution",
            json={"tenant_id": "tenant_a", "field": "bad-field!", "mode": "auto"},
        )
        assert bad_resp.status_code == 400
