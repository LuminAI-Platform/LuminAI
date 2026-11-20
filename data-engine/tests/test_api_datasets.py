"""Unit and integration tests for dataset profiling and preview API endpoints."""

from fastapi.testclient import TestClient
import pytest

from app.main import app

client = TestClient(app)


@pytest.fixture
def sample_dataset_records():
    return [
        {"customer_id": "CUST-001", "name": "Alice Smith", "email": "alice@example.com", "signup_date": "2023-01-15", "score": 85.5},
        {"customer_id": "CUST-002", "name": "Bob Jones", "email": "bob@example.com", "signup_date": "2023-02-20", "score": 92.0},
        {"customer_id": "CUST-003", "name": "Charlie Brown", "email": "N/A", "signup_date": "invalid-date", "score": None},
        {"customer_id": "CUST-004", "name": "Diana Prince", "email": "diana@example.com", "signup_date": "2023-04-10", "score": 78.4},
    ]


def test_profile_dataset_endpoint(sample_dataset_records):
    """Profiles dataset and verifies comprehensive statistics and quality scores."""
    response = client.post(
        "/analytics/datasets/profile",
        json={
            "tenant_id": "test_tenant",
            "dataset_name": "crm_customers",
            "records": sample_dataset_records,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["dataset_name"] == "crm_customers"
    assert "profile" in data
    assert "quality" in data

    profile = data["profile"]
    assert profile["total_rows"] == 4
    assert profile["total_columns"] == 5
    assert "customer_id" in profile["columns"]
    assert "email" in profile["columns"]
    assert "score" in profile["columns"]

    # Quality assessment
    quality = data["quality"]
    assert quality["total_records"] == 4
    assert "overall_score" in quality["dimension_scores"]


def test_profile_dataset_empty_fails():
    """Fails with HTTP 400 when attempting to profile empty dataset."""
    response = client.post(
        "/analytics/datasets/profile",
        json={
            "tenant_id": "test_tenant",
            "dataset_name": "empty_set",
            "records": [],
        },
    )
    assert response.status_code == 400
    assert "Cannot profile an empty dataset" in response.json()["detail"]


def test_preview_dataset_endpoint(sample_dataset_records):
    """Generates preview schema and rows."""
    response = client.post(
        "/analytics/datasets/preview",
        json={
            "records": sample_dataset_records,
            "limit": 2,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["columns"]) == 5
    assert len(data["rows"]) == 2
    assert data["total_rows"] == 4
