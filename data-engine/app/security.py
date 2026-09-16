"""Authentication and authorization dependencies for the LuminAI Data Engine.

Supports:
1. Shared API Key authentication for internal service-to-service communication
   (via `X-API-Key` header or `Authorization: Bearer <api-key>`).
2. Keycloak OIDC JWT token validation for user / SPA requests matching the
   Core Java Backend's realm configuration.
3. Dev/sandbox mock token support for local development and integration tests
   (matching Core Backend `SecurityConfig.java`).
4. Role-based access control (RBAC) helpers.
"""

import logging
import secrets
from typing import Any, Dict, List, Optional

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer
import jwt
from jwt import PyJWKClient
from pydantic import BaseModel, Field

from app.config import Settings, get_settings

logger = logging.getLogger("data-engine.security")

# Security Schemes for OpenAPI / Swagger UI
api_key_header_scheme = APIKeyHeader(name="X-API-Key", auto_error=False, description="Internal Service API Key")
http_bearer_scheme = HTTPBearer(auto_error=False, description="Keycloak OIDC JWT Bearer Token or Service API Key")


class AuthIdentity(BaseModel):
    """Represents an authenticated principal (user, service, or sandbox)."""

    user_id: Optional[str] = Field(default=None, description="Unique subject ID (sub)")
    username: str = Field(default="anonymous", description="Principal username or service name")
    email: Optional[str] = Field(default=None, description="User email address")
    roles: List[str] = Field(default_factory=list, description="Assigned roles (prefixed with ROLE_)")
    tenant_id: Optional[str] = Field(default=None, description="Scoping tenant identifier")
    is_service: bool = Field(default=False, description="True if authenticated via API key")
    auth_method: str = Field(default="none", description="Method used: api_key, keycloak_jwt, mock_token, dev_bypass")

    def has_role(self, role: str) -> bool:
        """Check if identity has a specific role (case-insensitive, optional ROLE_ prefix)."""
        normalized = role.upper()
        if not normalized.startswith("ROLE_"):
            prefixed = f"ROLE_{normalized}"
        else:
            prefixed = normalized
        return prefixed in self.roles or normalized in self.roles


class KeycloakTokenValidator:
    """Validates Keycloak JWT tokens via JWKS public keys or configured public key."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.jwks_url = settings.keycloak_jwks_url
        self.issuer = settings.keycloak_issuer
        self.client_id = settings.keycloak_client_id
        self.audience = settings.keycloak_audience
        self.public_key = settings.keycloak_public_key

        self._jwks_client: Optional[PyJWKClient] = None
        if not self.public_key:
            try:
                self._jwks_client = PyJWKClient(self.jwks_url, cache_keys=True, max_cached_keys=16)
            except Exception as e:
                logger.warning("Could not initialize Keycloak JWKS client: %s", e)

    def validate_token(self, token: str) -> Dict[str, Any]:
        """Validate and decode a JWT token string, returning its claims payload."""
        # 1. Dev / Sandbox mock token parity (matching Core Backend SecurityConfig.java)
        if (
            token in ("mock-access-token-123", "mock-token", "sandbox-token")
            or token.startswith("mock-")
            or token.startswith("sandbox")
            or "sandbox" in token
        ):
            return {
                "sub": "sandbox-admin-id",
                "preferred_username": "admin",
                "email": "admin@luminai.dev",
                "realm_access": {"roles": ["admin", "user", "TENANT_ADMIN"]},
                "tenant_id": "acme",
            }

        # 2. Keycloak cryptographic validation
        signing_key: Any = None
        algorithms = ["RS256", "ES256", "HS256"]

        if self.public_key:
            signing_key = self.public_key
        elif self._jwks_client:
            try:
                signing_key = self._jwks_client.get_signing_key_from_jwt(token).key
            except Exception as e:
                logger.error("Failed to retrieve Keycloak signing key: %s", e)
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Unable to verify token with Keycloak JWKS: {str(e)}",
                    headers={"WWW-Authenticate": "Bearer"},
                ) from e
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Keycloak JWKS validator is not configured and no public key was provided",
                headers={"WWW-Authenticate": "Bearer"},
            )

        try:
            decode_options = {
                "verify_exp": True,
                "verify_aud": bool(self.audience),
            }
            claims = jwt.decode(
                token,
                signing_key,
                algorithms=algorithms,
                issuer=self.issuer if self.issuer else None,
                audience=self.audience if self.audience else None,
                options=decode_options,
            )
            return claims
        except jwt.ExpiredSignatureError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer error=\"invalid_token\", error_description=\"The token has expired\""},
            ) from e
        except jwt.InvalidIssuerError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token issuer",
                headers={"WWW-Authenticate": "Bearer error=\"invalid_token\", error_description=\"Invalid token issuer\""},
            ) from e
        except jwt.InvalidAudienceError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token audience",
                headers={"WWW-Authenticate": "Bearer error=\"invalid_token\", error_description=\"Invalid token audience\""},
            ) from e
        except jwt.PyJWTError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token: {str(e)}",
                headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""},
            ) from e


_validators: Dict[str, KeycloakTokenValidator] = {}


def get_keycloak_validator(settings: Settings = Depends(get_settings)) -> KeycloakTokenValidator:
    """Return a cached KeycloakTokenValidator instance keyed by realm configuration."""
    cache_key = f"{settings.keycloak_jwks_url}:{settings.keycloak_public_key or ''}"
    if cache_key not in _validators:
        _validators[cache_key] = KeycloakTokenValidator(settings)
    return _validators[cache_key]


def extract_roles_from_claims(claims: Dict[str, Any], client_id: Optional[str] = None) -> List[str]:
    """Extract and normalize roles from Keycloak JWT claims into Spring-compatible format."""
    roles_set = set()

    # Realm roles: realm_access.roles
    realm_access = claims.get("realm_access")
    if isinstance(realm_access, dict):
        for role in realm_access.get("roles", []):
            if isinstance(role, str):
                role_upper = role.upper()
                roles_set.add(f"ROLE_{role_upper}" if not role_upper.startswith("ROLE_") else role_upper)

    # Client/Resource roles: resource_access.<client_id>.roles
    resource_access = claims.get("resource_access")
    if isinstance(resource_access, dict) and client_id:
        client_access = resource_access.get(client_id)
        if isinstance(client_access, dict):
            for role in client_access.get("roles", []):
                if isinstance(role, str):
                    role_upper = role.upper()
                    roles_set.add(f"ROLE_{role_upper}" if not role_upper.startswith("ROLE_") else role_upper)

    return sorted(list(roles_set))


async def get_current_identity(
    api_key_header: Optional[str] = Security(api_key_header_scheme),
    bearer_credentials: Optional[HTTPAuthorizationCredentials] = Security(http_bearer_scheme),
    settings: Settings = Depends(get_settings),
    validator: KeycloakTokenValidator = Depends(get_keycloak_validator),
) -> AuthIdentity:
    """FastAPI dependency to authenticate requests using API key or Keycloak JWT.

    Priority:
    1. If auth_enabled is False: return dev bypass identity.
    2. Check X-API-Key header.
    3. Check Authorization: Bearer <token> (supports API key or Keycloak JWT).
    4. If none present: raise 401 Unauthorized.
    """
    # 1. Dev bypass if auth is disabled
    if not settings.auth_enabled:
        return AuthIdentity(
            user_id="dev-user",
            username="developer",
            email="dev@luminai.local",
            roles=["ROLE_ADMIN", "ROLE_USER", "ROLE_TENANT_ADMIN"],
            tenant_id="acme",
            is_service=False,
            auth_method="dev_bypass",
        )

    # 2. Service API Key via X-API-Key header
    if api_key_header:
        if secrets.compare_digest(api_key_header, settings.api_key):
            return AuthIdentity(
                user_id="service-account",
                username="service-core-backend",
                roles=["ROLE_SERVICE", "ROLE_ADMIN"],
                tenant_id=None,
                is_service=True,
                auth_method="api_key",
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API Key",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    # 3. Bearer token (either API key or Keycloak JWT)
    if bearer_credentials and bearer_credentials.credentials:
        token = bearer_credentials.credentials.strip()

        # Check if the bearer token matches the internal API key directly
        if secrets.compare_digest(token, settings.api_key):
            return AuthIdentity(
                user_id="service-account",
                username="service-core-backend",
                roles=["ROLE_SERVICE", "ROLE_ADMIN"],
                tenant_id=None,
                is_service=True,
                auth_method="api_key",
            )

        # Validate as Keycloak JWT
        claims = validator.validate_token(token)
        roles = extract_roles_from_claims(claims, settings.keycloak_client_id)
        tenant_id = claims.get("tenant_id") or claims.get("tenant") or claims.get("organization")

        return AuthIdentity(
            user_id=claims.get("sub"),
            username=claims.get("preferred_username", claims.get("sub", "unknown")),
            email=claims.get("email"),
            roles=roles,
            tenant_id=tenant_id,
            is_service=False,
            auth_method="mock_token" if "sandbox" in str(claims.get("sub")) else "keycloak_jwt",
        )

    # 4. No credentials provided
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication credentials were not provided",
        headers={"WWW-Authenticate": "Bearer, ApiKey"},
    )


def require_role(*required_roles: str):
    """Dependency factory ensuring the authenticated identity holds at least one of the required roles."""

    async def _role_checker(identity: AuthIdentity = Depends(get_current_identity)) -> AuthIdentity:
        for role in required_roles:
            if identity.has_role(role):
                return identity
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User '{identity.username}' does not have the required role ({', '.join(required_roles)})",
        )

    return _role_checker
