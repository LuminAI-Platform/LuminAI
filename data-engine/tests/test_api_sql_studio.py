"""Unit and integration tests for SQL Studio API endpoint."""

from fastapi.testclient import TestClient
import pytest

from app.main import app

client = TestClient(app)


@pytest.fixture
def sample_sales_tables():
    return {
        "customers": [
            {"customer_id": 1, "name": "Acme Corp", "tier": "Enterprise", "country": "US"},
            {"customer_id": 2, "name": "Global Tech", "tier": "Pro", "country": "UK"},
            {"customer_id": 3, "name": "SmallBiz", "tier": "Free", "country": "US"},
        ],
        "orders": [
            {"order_id": 101, "customer_id": 1, "amount": 1200.50, "status": "completed"},
            {"order_id": 102, "customer_id": 1, "amount": 3400.00, "status": "completed"},
            {"order_id": 103, "customer_id": 2, "amount": 500.00, "status": "pending"},
        ],
    }


def test_sql_studio_select_simple(sample_sales_tables):
    """Simple SELECT returns expected columns and rows."""
    response = client.post(
        "/analytics/sql/execute",
        json={
            "query": "SELECT customer_id, name, tier FROM customers ORDER BY customer_id ASC",
            "tenant_id": "test_tenant",
            "tables": sample_sales_tables,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["row_count"] == 3
    assert len(data["columns"]) == 3
    assert data["columns"][0]["name"] == "customer_id"
    assert data["rows"][0]["name"] == "Acme Corp"
    assert data["execution_time_ms"] >= 0.0


def test_sql_studio_join_aggregation(sample_sales_tables):
    """JOIN and GROUP BY aggregation calculates real totals."""
    query = """
    SELECT
        c.tier,
        COUNT(o.order_id) AS total_orders,
        SUM(o.amount) AS total_revenue
    FROM customers c
    JOIN orders o ON c.customer_id = o.customer_id
    GROUP BY c.tier
    ORDER BY total_revenue DESC
    """
    response = client.post(
        "/analytics/sql/execute",
        json={
            "query": query,
            "tenant_id": "test_tenant",
            "tables": sample_sales_tables,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["row_count"] == 2
    # Acme Corp is Enterprise with 1200.5 + 3400 = 4600.5
    enterprise_row = next(r for r in data["rows"] if r["tier"] == "Enterprise")
    assert enterprise_row["total_orders"] == 2
    assert enterprise_row["total_revenue"] == 4600.5


def test_sql_studio_blocks_mutation_drop(sample_sales_tables):
    """DDL statement DROP TABLE is blocked with HTTP 400."""
    response = client.post(
        "/analytics/sql/execute",
        json={
            "query": "DROP TABLE customers",
            "tenant_id": "test_tenant",
            "tables": sample_sales_tables,
        },
    )
    assert response.status_code == 400
    assert "read-only" in response.json()["detail"].lower()


def test_sql_studio_blocks_mutation_delete(sample_sales_tables):
    """DML statement DELETE FROM is blocked with HTTP 400."""
    response = client.post(
        "/analytics/sql/execute",
        json={
            "query": "DELETE FROM customers WHERE customer_id = 1",
            "tenant_id": "test_tenant",
            "tables": sample_sales_tables,
        },
    )
    assert response.status_code == 400
    assert "read-only" in response.json()["detail"].lower()


def test_sql_studio_syntax_error(sample_sales_tables):
    """Syntax error in query returns HTTP 400 with DuckDB message."""
    response = client.post(
        "/analytics/sql/execute",
        json={
            "query": "SELECT FROM INVALID SYNTAX WHERE",
            "tenant_id": "test_tenant",
            "tables": sample_sales_tables,
        },
    )
    assert response.status_code == 400
    assert "DuckDB execution error" in response.json()["detail"]


def test_sql_studio_limit_enforced(sample_sales_tables):
    """Row limit restricts returned dataset size."""
    response = client.post(
        "/analytics/sql/execute",
        json={
            "query": "SELECT * FROM customers",
            "tenant_id": "test_tenant",
            "tables": sample_sales_tables,
            "limit": 1,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["row_count"] == 1
    assert data["total_count"] == 3
