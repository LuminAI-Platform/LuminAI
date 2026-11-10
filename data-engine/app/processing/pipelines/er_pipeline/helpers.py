"""Helper utilities and constants for the Entity Resolution (ER) pipeline."""

from __future__ import annotations

import warnings
from typing import Any, Dict, List, Optional

from dagster import AssetExecutionContext, Backoff, Jitter, RetryPolicy

DEFAULT_RETRY_POLICY = RetryPolicy(
    max_retries=3,
    delay=1.0,
    backoff=Backoff.EXPONENTIAL,
    jitter=Jitter.FULL,
)


def _extract_run_tags(context: AssetExecutionContext) -> dict[str, str]:
    """Safely extract tags from AssetExecutionContext across invocation styles."""
    try:
        if getattr(context, "has_run", False) and context.run:
            return dict(context.run.tags or {})
    except Exception:
        pass

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", DeprecationWarning)
            if hasattr(context, "run_tags") and context.run_tags:
                return dict(context.run_tags)
    except Exception:
        pass

    return {}


def get_synthetic_er_records(tenant_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Generate synthetic realistic multi-source dataset for ER development/testing."""
    records = [
        # Cluster 1: Alice Smith (Source A CRM vs Source B Billing)
        {
            "id": "rec-001",
            "source_id": "crm-postgres",
            "name": "Alice Smith",
            "email": "alice@example.com",
            "dob": "1990-05-12",
            "country": "UK",
            "entity_type": "Person",
            "salary": 75000.0,
            "updated_at": "2024-01-10T00:00:00Z",
        },
        {
            "id": "rec-002",
            "source_id": "billing-stripe",
            "name": "Alice Smyth",
            "email": "alice@example.com",
            "dob": "1990-05-12",
            "country": "UK",
            "entity_type": "Person",
            "salary": 78000.0,
            "updated_at": "2024-06-15T00:00:00Z",
        },
        # Cluster 2: Bob Jones (Transitive match: rec-003=rec-004 and rec-004=rec-005)
        {
            "id": "rec-003",
            "source_id": "hr-workday",
            "name": "Bob Jones",
            "email": "bob.jones@corp.com",
            "dob": "1985-11-20",
            "country": "US",
            "entity_type": "Person",
            "salary": 92000.0,
            "updated_at": "2023-12-01T00:00:00Z",
        },
        {
            "id": "rec-004",
            "source_id": "crm-salesforce",
            "name": "Bobby Jones",
            "email": "bob.jones@corp.com",
            "dob": "1985-11-20",
            "country": "US",
            "entity_type": "Person",
            "salary": 95000.0,
            "updated_at": "2024-05-20T00:00:00Z",
        },
        # Disjoint Record: Carol White
        {
            "id": "rec-005",
            "source_id": "support-zendesk",
            "name": "Carol White",
            "email": "carol.white@acme.org",
            "dob": "1992-03-15",
            "country": "CA",
            "entity_type": "Person",
            "salary": 68000.0,
            "updated_at": "2024-02-14T00:00:00Z",
        },
    ]

    active_tenant = tenant_id or "acme"
    for r in records:
        r["tenant_id"] = active_tenant
    return records
