"""Integration API Test Suite verifying all REST endpoints supporting the 8 Data Lifecycle Scenarios."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.security import get_current_identity, AuthIdentity


# Override authentication for automated tests
def mock_identity():
    return AuthIdentity(user_id="test_user", username="test", tenant_id="acme", roles=["ANALYST", "DATA_ENGINEER"])


app.dependency_overrides[get_current_identity] = mock_identity
client = TestClient(app)


@pytest.fixture
def api_sample_records():
    return [
        {
            "id": "REC-01",
            "name": "  Enterprise Solutions  ",
            "country": "US",
            "revenue": 1000000.0,
            "physician_name": "Dr. Sarah Adams",
            "department": "Cardiology",
            "insurance_payer": "Aetna",
        },
        {
            "id": "REC-02",
            "name": "Enterprise Solutions",
            "country": "US",
            "revenue": 1000000.0,
            "physician_name": "Dr. Sarah Adams",
            "department": "Cardiology",
            "insurance_payer": "Aetna",
        },
    ]


def test_api_cleaning_preview(api_sample_records):
    """POST /analytics/cleaning/preview returns 200 with before/after diffs."""
    response = client.post(
        "/analytics/cleaning/preview",
        json={
            "records": api_sample_records,
            "step": {
                "step_id": "s1",
                "operation": "standardize_text",
                "column": "name",
                "parameters": {"trim": True, "case": "title"},
            },
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["affected_rows"] >= 1
    assert data["sample_diffs"][0]["original_value"] == "  Enterprise Solutions  "
    assert data["sample_diffs"][0]["proposed_value"] == "Enterprise Solutions"


def test_api_cleaning_execute(api_sample_records):
    """POST /analytics/cleaning/execute returns 200 with cleaned records and audit log."""
    response = client.post(
        "/analytics/cleaning/execute",
        json={
            "records": api_sample_records,
            "steps": [
                {
                    "step_id": "s1",
                    "operation": "standardize_text",
                    "column": "name",
                    "parameters": {"trim": True, "case": "title"},
                },
                {
                    "step_id": "s2",
                    "operation": "deduplicate",
                    "column": "name",
                    "parameters": {"subset": ["name"], "keep": "first"},
                },
            ],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["rows"]) == 1  # Deduplicated
    assert len(data["audit_log"]) == 2


def test_api_pipeline_execute(api_sample_records):
    """POST /analytics/pipelines/execute returns 200 with transformed records."""
    response = client.post(
        "/analytics/pipelines/execute",
        json={
            "records": api_sample_records,
            "steps": [
                {
                    "step_id": "t1",
                    "step_type": "DERIVE",
                    "parameters": {"column_name": "tax", "expression": "revenue * 0.15"},
                }
            ],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total_output_rows"] == 2
    assert "tax" in data["rows"][0]
    assert data["rows"][0]["tax"] == 150000.0


def test_api_eda_report(api_sample_records):
    """POST /analytics/eda/report returns 200 with complete statistics."""
    response = client.post(
        "/analytics/eda/report",
        json={"records": api_sample_records},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["overview"]["total_rows"] == 2
    assert "revenue" in data["numeric_statistics"]


def test_api_graph_decompose(api_sample_records):
    """POST /analytics/graph/decompose returns 200 with nodes and typed edges."""
    response = client.post(
        "/analytics/graph/decompose",
        json={
            "records": api_sample_records,
            "primary_entity_type": "Patient",
            "primary_id_column": "id",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["primary_entity_type"] == "Patient"
    assert data["total_nodes"] > 2
    assert data["total_edges"] > 0
    assert "TREATED_BY" in data["edge_counts_by_type"]
