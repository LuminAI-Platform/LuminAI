"""Tests for unified EDA report, storage-backed dataset loading, and multi-column cleaning."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
import polars as pl

from app.main import app

client = TestClient(app)


def test_eda_report_unifies_dama_dimensions_columns_and_histograms():
    records = [
        {"id": "1", "name": "Alice", "age": 28, "dept": "Engineering", "salary": 120000.0},
        {"id": "2", "name": "Bob", "age": 34, "dept": "Engineering", "salary": 130000.0},
        {"id": "3", "name": "Carol", "age": 41, "dept": "Sales", "salary": 95000.0},
        {"id": "4", "name": None, "age": 52, "dept": "Sales", "salary": 105000.0},
    ]
    response = client.post(
        "/analytics/eda/report",
        json={"tenant_id": "tenant-1", "dataset_name": "employees", "records": records},
    )
    assert response.status_code == 200
    body = response.json()

    assert body["tenant_id"] == "tenant-1"
    assert body["dataset_name"] == "employees"
    assert body["row_count"] == 4
    assert body["column_count"] == 5
    assert isinstance(body["overallScore"], float)
    assert body["overallScore"] == body["quality_score"]
    for dim in ("completeness", "validity", "consistency", "uniqueness", "accuracy"):
        assert isinstance(body[dim], float)

    assert "overview" in body
    assert "numeric_statistics" in body
    assert "categorical_statistics" in body
    assert "correlation_matrix" in body

    age_col = body["columns"]["age"]
    assert age_col["distinct_count"] == 4
    assert age_col["health"] == 100.0
    assert len(age_col["histogram"]) >= 3

    name_col = body["columns"]["name"]
    assert name_col["null_count"] == 1
    assert name_col["null_percentage"] == 25.0
    assert name_col["health"] == 75.0


def test_eda_and_sql_support_tenant_scoped_storage_location():
    df = pl.DataFrame(
        [
            {"customer_id": "c1", "country": "GH", "spend": 150.0},
            {"customer_id": "c2", "country": "KE", "spend": 250.0},
        ]
    )
    mock_minio = MagicMock()
    mock_minio.load_dataframe.return_value = df

    with patch("app.api.dataset_input.get_minio_client", return_value=mock_minio):
        eda_resp = client.post(
            "/analytics/eda/report",
            json={
                "tenant_id": "tenant-a",
                "dataset_name": "customers",
                "storage_location": "tenant-a/raw/customers.csv",
            },
        )
        assert eda_resp.status_code == 200
        assert eda_resp.json()["row_count"] == 2

        sql_resp = client.post(
            "/analytics/sql/execute",
            json={
                "tenant_id": "tenant-a",
                "storage_location": "tenant-a/raw/customers.csv",
                "query": "SELECT country, SUM(spend) AS total_spend FROM dataset GROUP BY country ORDER BY country",
            },
        )
        assert sql_resp.status_code == 200
        assert sql_resp.json()["rows"] == [
            {"country": "GH", "total_spend": 150.0},
            {"country": "KE", "total_spend": 250.0},
        ]

        cross_tenant = client.post(
            "/analytics/eda/report",
            json={
                "tenant_id": "tenant-a",
                "storage_location": "tenant-b/raw/secret.csv",
            },
        )
        assert cross_tenant.status_code == 403


def test_cleaning_execute_expands_multi_column_steps_and_storage():
    df = pl.DataFrame(
        [
            {"first": "  alice  ", "last": "  SMITH "},
            {"first": "bob", "last": "jones"},
        ]
    )
    mock_minio = MagicMock()
    mock_minio.load_dataframe.return_value = df

    with patch("app.api.dataset_input.get_minio_client", return_value=mock_minio):
        resp = client.post(
            "/analytics/cleaning/execute",
            json={
                "tenant_id": "tenant-a",
                "dataset_name": "names_clean",
                "storage_location": "tenant-a/raw/names.csv",
                "steps": [
                    {
                        "operation": "standardize_text",
                        "columns": ["first", "last"],
                        "parameters": {"trim": True, "case": "title"},
                    }
                ],
            },
        )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["audit_log"]) == 2
    assert data["rows"][0] == {"first": "Alice", "last": "Smith"}
