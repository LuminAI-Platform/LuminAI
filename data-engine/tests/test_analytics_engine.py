"""Unit tests for DuckDBAnalyticsEngine."""

import json
from datetime import datetime
import polars as pl
import pytest

from app.processing.analytics_engine import DuckDBAnalyticsEngine


@pytest.fixture
def sample_golden_df() -> pl.DataFrame:
    """Sample Polars DataFrame simulating golden_records table."""
    return pl.DataFrame([
        {
            "golden_id": "gr-1",
            "tenant_id": "acme",
            "cluster_size": 2,
            "source_record_ids": json.dumps(["src-1", "src-2"]),
            "attributes": json.dumps({
                "entity_type": "Person",
                "name": "Alice Smith",
                "age": 30,
                "salary": 60000,
                "country": "UK",
                "active": True,
            }),
            "created_at": datetime(2024, 1, 1, 10, 0),
        },
        {
            "golden_id": "gr-2",
            "tenant_id": "acme",
            "cluster_size": 1,
            "source_record_ids": json.dumps(["src-3"]),
            "attributes": json.dumps({
                "entity_type": "Person",
                "name": "Bob Jones",
                "age": 40,
                "salary": 80000,
                "country": "UK",
                "active": True,
            }),
            "created_at": datetime(2024, 1, 2, 11, 0),
        },
        {
            "golden_id": "gr-3",
            "tenant_id": "acme",
            "cluster_size": 3,
            "source_record_ids": json.dumps(["src-4", "src-5", "src-6"]),
            "attributes": json.dumps({
                "entity_type": "Person",
                "name": "Charlie Brown",
                "age": 50,
                "salary": 100000,
                "country": "US",
                "active": False,
            }),
            "created_at": datetime(2024, 1, 3, 9, 0),
        },
        {
            "golden_id": "gr-4",
            "tenant_id": "other_tenant",
            "cluster_size": 1,
            "source_record_ids": json.dumps(["src-7"]),
            "attributes": json.dumps({
                "entity_type": "Person",
                "name": "David Miller",
                "age": 25,
                "salary": 50000,
                "country": "UK",
                "active": True,
            }),
            "created_at": datetime(2024, 1, 4, 14, 0),
        },
        {
            "golden_id": "gr-5",
            "tenant_id": "acme",
            "cluster_size": 1,
            "source_record_ids": json.dumps(["src-8"]),
            "attributes": json.dumps({
                "entity_type": "Company",
                "name": "Acme Corp",
                "employees": 500,
                "country": "UK",
            }),
            "created_at": datetime(2024, 1, 5, 8, 0),
        },
    ])


@pytest.fixture
def sample_staging_df() -> pl.DataFrame:
    """Sample Polars DataFrame simulating staging_records table."""
    return pl.DataFrame([
        {
            "id": "stg-1",
            "tenant_id": "acme",
            "source_id": "crm",
            "raw_id": "raw-1",
            "data": json.dumps({
                "entity_type": "Transaction",
                "amount": 100.50,
                "status": "completed",
            }),
            "staged_at": datetime(2024, 1, 10, 10, 0),
        },
        {
            "id": "stg-2",
            "tenant_id": "acme",
            "source_id": "crm",
            "raw_id": "raw-2",
            "data": json.dumps({
                "entity_type": "Transaction",
                "amount": 250.00,
                "status": "completed",
            }),
            "staged_at": datetime(2024, 1, 10, 15, 0),
        },
        {
            "id": "stg-3",
            "tenant_id": "acme",
            "source_id": "erp",
            "raw_id": "raw-3",
            "data": json.dumps({
                "entity_type": "Transaction",
                "amount": 50.00,
                "status": "pending",
            }),
            "staged_at": datetime(2024, 1, 11, 12, 0),
        },
    ])


class TestDuckDBAnalyticsEngineQuery:
    """Tests for execute_query in DuckDBAnalyticsEngine."""

    def test_query_count_and_averages(self, sample_golden_df):
        engine = DuckDBAnalyticsEngine(override_df=sample_golden_df)
        result, row_count = engine.execute_query(
            tenant_id="acme",
            entity_type="Person",
            aggregations=["count", "avg:age", "sum:salary", "min:age", "max:age"],
        )

        assert row_count == 3
        assert result["count"] == 3
        # (30 + 40 + 50) / 3 = 40.0
        assert result["avg_age"] == 40.0
        # 60000 + 80000 + 100000 = 240000
        assert result["sum_salary"] == 240000.0
        assert result["min_age"] == 30.0
        assert result["max_age"] == 50.0

    def test_query_with_json_filter(self, sample_golden_df):
        engine = DuckDBAnalyticsEngine(override_df=sample_golden_df)
        result, row_count = engine.execute_query(
            tenant_id="acme",
            entity_type="Person",
            aggregations=["count", "avg:age"],
            filters={"country": "UK"},
        )

        assert row_count == 2
        assert result["count"] == 2
        # (30 + 40) / 2 = 35.0
        assert result["avg_age"] == 35.0

    def test_query_with_boolean_filter(self, sample_golden_df):
        engine = DuckDBAnalyticsEngine(override_df=sample_golden_df)
        result, row_count = engine.execute_query(
            tenant_id="acme",
            entity_type="Person",
            aggregations=["count"],
            filters={"active": True},
        )
        assert row_count == 2
        assert result["count"] == 2

    def test_query_distinct_count(self, sample_golden_df):
        engine = DuckDBAnalyticsEngine(override_df=sample_golden_df)
        result, row_count = engine.execute_query(
            tenant_id="acme",
            entity_type="Person",
            aggregations=["distinct:country"],
        )
        assert row_count == 3
        # 2 distinct countries: UK and US
        assert result["distinct_country"] == 2

    def test_query_tenant_isolation(self, sample_golden_df):
        engine = DuckDBAnalyticsEngine(override_df=sample_golden_df)
        result, row_count = engine.execute_query(
            tenant_id="other_tenant",
            entity_type="Person",
            aggregations=["count", "avg:age"],
        )
        assert row_count == 1
        assert result["count"] == 1
        assert result["avg_age"] == 25.0

    def test_query_entity_type_scoping(self, sample_golden_df):
        engine = DuckDBAnalyticsEngine(override_df=sample_golden_df)
        result, row_count = engine.execute_query(
            tenant_id="acme",
            entity_type="Company",
            aggregations=["count", "avg:employees"],
        )
        assert row_count == 1
        assert result["count"] == 1
        assert result["avg_employees"] == 500.0

    def test_query_empty_results(self, sample_golden_df):
        engine = DuckDBAnalyticsEngine(override_df=sample_golden_df)
        result, row_count = engine.execute_query(
            tenant_id="nonexistent_tenant",
            entity_type="Person",
            aggregations=["count", "avg:age", "sum:salary"],
        )
        assert row_count == 0
        assert result["count"] == 0
        assert result.get("avg_age") is None
        assert result.get("sum_salary") == 0

    def test_query_staging_records(self, sample_staging_df):
        engine = DuckDBAnalyticsEngine(override_df=sample_staging_df)
        result, row_count = engine.execute_query(
            tenant_id="acme",
            entity_type="Transaction",
            aggregations=["count", "sum:amount", "avg:amount"],
            filters={"status": "completed"},
            table_name="staging_records",
        )
        assert row_count == 2
        assert result["count"] == 2
        assert result["sum_amount"] == 350.50
        assert result["avg_amount"] == 175.25


class TestDuckDBAnalyticsEngineTimeseries:
    """Tests for execute_timeseries in DuckDBAnalyticsEngine."""

    def test_timeseries_daily_count(self, sample_golden_df):
        engine = DuckDBAnalyticsEngine(override_df=sample_golden_df)
        series = engine.execute_timeseries(
            tenant_id="acme",
            entity_type="Person",
            time_field="created_at",
            interval="1d",
            metric="count",
        )
        assert len(series) == 3
        # Jan 1, Jan 2, Jan 3: each has 1 Person record
        assert series[0]["value"] == 1
        assert series[1]["value"] == 1
        assert series[2]["value"] == 1

    def test_timeseries_staging_sum_metric(self, sample_staging_df):
        engine = DuckDBAnalyticsEngine(override_df=sample_staging_df)
        series = engine.execute_timeseries(
            tenant_id="acme",
            entity_type="Transaction",
            time_field="staged_at",
            interval="1d",
            metric="sum:amount",
            table_name="staging_records",
        )
        assert len(series) == 2
        # Jan 10 has 100.50 + 250.00 = 350.50
        assert series[0]["value"] == 350.50
        # Jan 11 has 50.00
        assert series[1]["value"] == 50.00

    def test_timeseries_with_filter(self, sample_staging_df):
        engine = DuckDBAnalyticsEngine(override_df=sample_staging_df)
        series = engine.execute_timeseries(
            tenant_id="acme",
            entity_type="Transaction",
            time_field="staged_at",
            interval="1d",
            metric="count",
            filters={"status": "completed"},
            table_name="staging_records",
        )
        assert len(series) == 1
        assert series[0]["value"] == 2


class TestDuckDBSecurityAndValidation:
    """Tests for identifier sanitization and defense against injection."""

    def test_sql_injection_in_filter_key_rejected(self, sample_golden_df):
        engine = DuckDBAnalyticsEngine(override_df=sample_golden_df)
        with pytest.raises(ValueError, match="Invalid filter field name"):
            engine.execute_query(
                tenant_id="acme",
                entity_type="Person",
                aggregations=["count"],
                filters={"age; DROP TABLE source_table; --": 30},
            )

    def test_sql_injection_in_aggregation_field_rejected(self, sample_golden_df):
        engine = DuckDBAnalyticsEngine(override_df=sample_golden_df)
        with pytest.raises(ValueError, match="Invalid field name"):
            engine.execute_query(
                tenant_id="acme",
                entity_type="Person",
                aggregations=["avg:age; SELECT 1"],
            )

    def test_unsupported_aggregation_operation_rejected(self, sample_golden_df):
        engine = DuckDBAnalyticsEngine(override_df=sample_golden_df)
        with pytest.raises(ValueError, match="Unsupported aggregation operation"):
            engine.execute_query(
                tenant_id="acme",
                entity_type="Person",
                aggregations=["hack:age"],
            )

    def test_unsupported_interval_rejected(self, sample_golden_df):
        engine = DuckDBAnalyticsEngine(override_df=sample_golden_df)
        with pytest.raises(ValueError, match="Unsupported interval"):
            engine.execute_timeseries(
                tenant_id="acme",
                entity_type="Person",
                time_field="created_at",
                interval="invalid_interval",
            )
