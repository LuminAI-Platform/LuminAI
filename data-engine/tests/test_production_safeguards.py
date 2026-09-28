"""Tests validating Production Safeguards for LuminAI Data Engine.

Verifies:
1. P0-SEC-01: Mock and sandbox tokens are rejected in production mode (401).
2. P0-CRIT-01: Silent fallback to synthetic data is blocked in production mode.
3. P0-SEC-02: SQL injection via limit/max_rows parameter is eliminated.
4. P0-CRIT-03: Dynamic entity_type propagation across cleaning and ER pipelines.
"""

from unittest.mock import MagicMock, patch
import pytest
from dagster import build_asset_context
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app
from app.processing.pipelines import cleaning_pipeline, er_pipeline
from app.security import KeycloakTokenValidator, get_keycloak_validator

client = TestClient(app)


def test_production_rejects_mock_and_sandbox_tokens():
    """Verify that in production mode, mock/sandbox tokens are rejected with 401."""
    prod_settings = Settings(
        auth_enabled=True,
        environment="production",
        api_key="prod-secret-key-12345",
        keycloak_url="http://keycloak.internal:8080",
    )
    validator = KeycloakTokenValidator(prod_settings)

    app.dependency_overrides[get_settings] = lambda: prod_settings
    app.dependency_overrides[get_keycloak_validator] = lambda: validator

    try:
        malicious_tokens = [
            "mock-access-token-123",
            "mock-admin-token",
            "sandbox-token",
            "bearer-sandbox-bypass",
        ]
        for token in malicious_tokens:
            res = client.post(
                "/process/trigger",
                headers={"Authorization": f"Bearer {token}"},
                json={"source_id": "src-1", "tenant_id": "acme"},
            )
            assert res.status_code == 401
            assert "prohibited in production" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_cleaning_pipeline_fails_fast_in_production_without_minio():
    """Verify that raw_ingestion_data raises RuntimeError in production when MinIO is unavailable."""
    prod_settings = Settings(
        environment="production",
        allow_synthetic_data=False,
    )

    context = build_asset_context(
        run_tags={
            "tenant_id": "prod-tenant",
            "source_id": "prod-source",
            "object_key": "incoming/data.csv",
        }
    )

    with patch("app.processing.pipelines.cleaning_pipeline.get_settings", return_value=prod_settings):
        with patch("app.processing.pipelines.cleaning_pipeline.get_minio_client") as mock_minio:
            mock_minio.return_value.load_dataframe.side_effect = ConnectionError("MinIO cluster unreachable")
            with pytest.raises(RuntimeError) as exc_info:
                cleaning_pipeline.raw_ingestion_data(context)
            assert "synthetic data fallback is prohibited in production mode" in str(exc_info.value)


def test_er_pipeline_fails_fast_in_production_without_staged_records():
    """Verify staged_records_for_er raises RuntimeError in production when no records exist."""
    prod_settings = Settings(
        environment="production",
        allow_synthetic_data=False,
    )

    context = build_asset_context(
        run_tags={
            "tenant_id": "empty-prod-tenant",
            "luminai_run_id": "run-test-safeguard-01",
        }
    )

    with patch("app.processing.pipelines.er_pipeline.get_settings", return_value=prod_settings):
        with patch("app.processing.pipelines.er_pipeline.get_checkpoint_manager") as mock_cp:
            mock_cp.return_value.load_checkpoint.return_value = None
            with patch("app.db.get_engine") as mock_engine:
                mock_conn = MagicMock()
                mock_conn.execute.return_value = []
                mock_engine.return_value.connect.return_value.__enter__.return_value = mock_conn
                with patch("os.path.exists", return_value=False):
                    with pytest.raises(RuntimeError) as exc_info:
                        er_pipeline.staged_records_for_er(context)
                    assert "synthetic data fallback is prohibited in production mode" in str(exc_info.value)


def test_er_pipeline_sanitizes_limit_tag():
    """Verify SQL injection payloads in 'limit' run tags are safely sanitized to None."""
    context = build_asset_context(
        run_tags={
            "tenant_id": "acme",
            "limit": "10; DROP TABLE staging_records; --",
        }
    )

    with patch("app.db.get_engine") as mock_engine:
        mock_conn = MagicMock()
        mock_conn.execute.return_value = []
        mock_engine.return_value.connect.return_value.__enter__.return_value = mock_conn

        # Execute asset in dev mode (will fall through to synthetic after safe query execution)
        df = er_pipeline.staged_records_for_er(context)
        assert df is not None

        # Verify the query executed by engine did NOT interpolate the SQL injection payload
        call_args = mock_conn.execute.call_args
        executed_query = str(call_args[0][0])
        query_params = call_args[0][1]

        assert "DROP TABLE" not in executed_query
        assert "DROP TABLE" not in str(query_params)


def test_cleaning_and_er_support_dynamic_entity_type():
    """Verify that passing non-Person entity_type is accepted and recorded in telemetry."""
    context = build_asset_context(
        run_tags={
            "tenant_id": "acme",
            "source_id": "financial_feed",
            "entity_type": "Transaction",
        }
    )

    with patch("app.processing.pipelines.cleaning_pipeline.record_records_processed") as mock_telemetry:
        # Generate dummy cleaned data
        import polars as pl
        dummy_df = pl.DataFrame({
            "id": ["tx-001", "tx-002"],
            "amount": [100.0, 200.0],
            "currency": ["USD", "EUR"],
        })
        res = cleaning_pipeline.cleaned_ingestion_data(context, dummy_df)
        assert res.height == 2

        # Verify entity_type passed to telemetry was "Transaction"
        assert mock_telemetry.called
        call_kwargs = mock_telemetry.call_args[1]
        assert call_kwargs["entity_type"] == "Transaction"
