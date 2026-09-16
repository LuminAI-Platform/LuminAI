"""Comprehensive test suite for FastAPI authentication & Keycloak OIDC integration.

Covers:
- Public endpoint exemptions (/health, /openapi.json)
- Service-to-service auth via X-API-Key
- Service-to-service auth via Authorization: Bearer <api-key>
- Keycloak mock/sandbox token support (dev/test parity with Core Backend)
- Cryptographic RSA-signed Keycloak JWT validation
- Expired and tampered token rejection (401 Unauthorized)
- Role and tenant extraction from JWT claims
- RBAC role-checking dependency
- Dev bypass mode when auth_enabled is False
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
import jwt
import pytest

from app.config import Settings, get_settings
from app.main import app
from app.security import (
    AuthIdentity,
    KeycloakTokenValidator,
    extract_roles_from_claims,
    get_keycloak_validator,
)

client = TestClient(app)


# --- Fixtures for RSA Key Pair Generation for JWT Tests ---

@pytest.fixture(scope="module")
def rsa_keys():
    """Generate an RSA key pair for testing Keycloak JWT signature verification."""
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")

    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")

    return {
        "private_key": private_key,
        "private_pem": private_pem,
        "public_pem": public_pem,
    }


def create_test_jwt(
    private_key,
    sub: str = "user-123",
    username: str = "alice",
    email: str = "alice@luminai.dev",
    roles: list[str] | None = None,
    tenant_id: str = "acme",
    expires_in_seconds: int = 3600,
    issuer: str = "http://localhost:8080/realms/luminai",
) -> str:
    """Helper to generate an RS256 signed JWT mimicking Keycloak tokens."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": sub,
        "preferred_username": username,
        "email": email,
        "realm_access": {"roles": roles or ["admin", "user"]},
        "resource_access": {"luminai-spa": {"roles": ["viewer"]}},
        "tenant_id": tenant_id,
        "iss": issuer,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=expires_in_seconds)).timestamp()),
    }
    return jwt.encode(payload, private_key, algorithm="RS256")


# --- Unit Tests for Role Extraction & Models ---

def test_extract_roles_from_claims():
    """Roles are extracted from realm_access and resource_access with ROLE_ prefixes."""
    claims = {
        "realm_access": {"roles": ["admin", "user"]},
        "resource_access": {
            "luminai-spa": {"roles": ["editor"]},
            "other-client": {"roles": ["ignored"]},
        },
    }
    roles = extract_roles_from_claims(claims, client_id="luminai-spa")
    assert "ROLE_ADMIN" in roles
    assert "ROLE_USER" in roles
    assert "ROLE_EDITOR" in roles
    assert "ROLE_IGNORED" not in roles


def test_auth_identity_has_role():
    """AuthIdentity.has_role accurately matches both prefixed and unprefixed roles."""
    identity = AuthIdentity(
        user_id="u1",
        username="alice",
        roles=["ROLE_ADMIN", "ROLE_USER"],
        tenant_id="acme",
    )
    assert identity.has_role("ADMIN") is True
    assert identity.has_role("admin") is True
    assert identity.has_role("ROLE_ADMIN") is True
    assert identity.has_role("SUPERUSER") is False


@pytest.fixture(autouse=True)
def mock_dagster_trigger():
    """Mock background Dagster pipeline trigger so auth tests execute instantaneously."""
    with patch("app.processing.trigger.DagsterTrigger.trigger_cleaning_pipeline") as mock:
        yield mock


# --- Integration Tests with auth_enabled = True ---

class TestAuthenticationEnforced:
    """Tests when auth_enabled=True."""

    @pytest.fixture(autouse=True)
    def enable_auth(self, rsa_keys):
        """Override get_settings and validator for this test suite."""
        test_settings = Settings(
            auth_enabled=True,
            api_key="secret-api-key-999",
            keycloak_url="http://localhost:8080",
            keycloak_realm="luminai",
            keycloak_client_id="luminai-spa",
            keycloak_public_key=rsa_keys["public_pem"],
        )
        test_validator = KeycloakTokenValidator(test_settings)

        app.dependency_overrides[get_settings] = lambda: test_settings
        app.dependency_overrides[get_keycloak_validator] = lambda: test_validator

        yield

        app.dependency_overrides.clear()

    def test_public_health_accessible_without_auth(self):
        """GET /health is always public even when auth is enabled."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    def test_public_docs_accessible_without_auth(self):
        """GET /openapi.json is public for Swagger docs."""
        response = client.get("/openapi.json")
        assert response.status_code == 200
        assert "paths" in response.json()

    def test_protected_endpoint_rejects_anonymous(self):
        """Protected endpoint returns 401 when no credentials are provided."""
        response = client.post(
            "/process/trigger",
            json={"source_id": "src-1", "tenant_id": "acme"},
        )
        assert response.status_code == 401
        assert "Authentication credentials were not provided" in response.json()["detail"]

    def test_protected_endpoint_rejects_invalid_api_key(self):
        """Protected endpoint returns 401 when an invalid X-API-Key is passed."""
        response = client.post(
            "/process/trigger",
            headers={"X-API-Key": "wrong-key"},
            json={"source_id": "src-1", "tenant_id": "acme"},
        )
        assert response.status_code == 401
        assert "Invalid API Key" in response.json()["detail"]

    def test_protected_endpoint_accepts_valid_x_api_key(self):
        """Protected endpoint returns 202 when a valid X-API-Key is provided."""
        response = client.post(
            "/process/trigger",
            headers={"X-API-Key": "secret-api-key-999"},
            json={"source_id": "src-1", "tenant_id": "acme"},
        )
        assert response.status_code == 202
        assert response.json()["status"] == "queued"

    def test_protected_endpoint_accepts_bearer_api_key(self):
        """Protected endpoint returns 202 when internal API key is passed as Bearer token."""
        response = client.post(
            "/process/trigger",
            headers={"Authorization": "Bearer secret-api-key-999"},
            json={"source_id": "src-1", "tenant_id": "acme"},
        )
        assert response.status_code == 202
        assert response.json()["status"] == "queued"

    def test_protected_endpoint_accepts_mock_token(self):
        """Protected endpoint returns 202 with mock-access-token-123 (sandbox parity)."""
        response = client.post(
            "/process/trigger",
            headers={"Authorization": "Bearer mock-access-token-123"},
            json={"source_id": "src-1", "tenant_id": "acme"},
        )
        assert response.status_code == 202
        assert response.json()["status"] == "queued"

    def test_protected_endpoint_accepts_valid_keycloak_jwt(self, rsa_keys):
        """Protected endpoint accepts a cryptographically valid Keycloak RS256 token."""
        token = create_test_jwt(rsa_keys["private_key"], sub="user-007", username="bond")
        response = client.post(
            "/process/trigger",
            headers={"Authorization": f"Bearer {token}"},
            json={"source_id": "src-1", "tenant_id": "acme"},
        )
        assert response.status_code == 202
        assert response.json()["status"] == "queued"

    def test_protected_endpoint_rejects_expired_keycloak_jwt(self, rsa_keys):
        """Protected endpoint returns 401 when token has expired."""
        token = create_test_jwt(
            rsa_keys["private_key"],
            expires_in_seconds=-3600,  # expired 1 hour ago
        )
        response = client.post(
            "/process/trigger",
            headers={"Authorization": f"Bearer {token}"},
            json={"source_id": "src-1", "tenant_id": "acme"},
        )
        assert response.status_code == 401
        assert "Token has expired" in response.json()["detail"]

    def test_protected_endpoint_rejects_tampered_jwt(self, rsa_keys):
        """Protected endpoint returns 401 when signature doesn't match."""
        # Generate another key pair
        other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        tampered_token = create_test_jwt(other_key)

        response = client.post(
            "/process/trigger",
            headers={"Authorization": f"Bearer {tampered_token}"},
            json={"source_id": "src-1", "tenant_id": "acme"},
        )
        assert response.status_code == 401
        assert "Invalid token" in response.json()["detail"]

    def test_analytics_query_protected_endpoint(self):
        """Analytics router is also protected by the security dependency."""
        # Without auth -> 401
        res_unauth = client.post(
            "/analytics/query",
            json={"tenant_id": "acme", "entity_type": "Person"},
        )
        assert res_unauth.status_code == 401

        # With valid API Key -> 200
        res_auth = client.post(
            "/analytics/query",
            headers={"X-API-Key": "secret-api-key-999"},
            json={"tenant_id": "acme", "entity_type": "Person"},
        )
        assert res_auth.status_code == 200


# --- Integration Tests with auth_enabled = False (Dev Bypass Mode) ---

class TestAuthenticationDisabledDevMode:
    """Tests when auth_enabled=False (default dev/test mode)."""

    def test_requests_succeed_without_auth_headers_by_default(self):
        """When auth_enabled is False, endpoints pass through with dev bypass identity."""
        # Ensure default settings are active
        app.dependency_overrides.clear()

        response = client.post(
            "/process/trigger",
            json={"source_id": "src-1", "tenant_id": "acme"},
        )
        assert response.status_code == 202
        assert response.json()["status"] == "queued"
