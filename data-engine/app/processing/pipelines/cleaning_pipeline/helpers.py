"""Helper functions, date/currency parsers, and synthetic data for the cleaning pipeline."""

import logging
import re
import warnings
from datetime import datetime, timezone

import polars as pl
from dagster import AssetExecutionContext, Backoff, Jitter, RetryPolicy

logger = logging.getLogger(__name__)

DEFAULT_RETRY_POLICY = RetryPolicy(
    max_retries=3,
    delay=1.0,
    backoff=Backoff.EXPONENTIAL,
    jitter=Jitter.FULL,
)

# Column type defaults for null substitution
NULL_DEFAULTS: dict[type, object] = {
    pl.Utf8: "",
    pl.String: "",
    pl.Int64: 0,
    pl.Int32: 0,
    pl.Float64: 0.0,
    pl.Float32: 0.0,
    pl.Boolean: False,
}

# Common date formats for timestamp parsing
DATE_FORMATS = [
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%dT%H:%M:%SZ",
    "%Y-%m-%dT%H:%M:%S%z",
    "%d/%m/%Y",
    "%m/%d/%Y",
    "%Y-%m-%d",
    "%d-%m-%Y",
]


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


def _generate_synthetic_raw_data() -> pl.DataFrame:
    """Generate realistic synthetic dataset for testing when raw files are not provided."""
    return pl.DataFrame(
        {
            "id": [
                "rec-001",
                "rec-002",
                "rec-003",
                "rec-004",
                "rec-005",
                "rec-006",
                "rec-007",
                "rec-008",
                "rec-009",
                "rec-010",
            ],
            "name": [
                "  Alice Smith  ",
                "alice smith",
                "Bob Jones",
                "  Bobby Jones",
                "Carol White",
                None,
                "David Brown",
                "david brown  ",
                "Eve Wilson",
                "Frank Taylor",
            ],
            "email": [
                "Alice@Example.COM",
                "alice@example.com",
                "bob@example.com",
                "bobby@example.com",
                "carol@example.com",
                "unknown@test.com",
                "david@example.com",
                "david@example.com",
                "eve@example.com",
                "  frank@example.com  ",
            ],
            "age": [34, 34, 28, None, 45, 29, None, 31, 55, 42],
            "country": [
                "UK",
                "uk",
                "US",
                "US",
                "CA",
                "za",
                None,
                "DE",
                "FR",
                "  AU  ",
            ],
            "joined_at": [
                "2024-01-15",
                "2024-01-15",
                "15/03/2024",
                "2024-04-20T10:30:00Z",
                "2024-05-01",
                None,
                "01/06/2024",
                "2024-07-10 14:22:00",
                "2024-08-15",
                "invalid-date",
            ],
            "score": [0.85, 0.85, 0.72, 0.68, None, 0.91, 0.77, 0.65, 0.88, 0.73],
            "salary": [
                "$1,200.50",
                "€1500",
                "£80.00",
                "150.00",
                "$9,000",
                None,
                "€3,400.25",
                "$420",
                "invalid-currency",
                "£2,500",
            ],
        }
    )


def _parse_date_string(value: str | None) -> str:
    """
    Attempt to parse a date string using common formats.

    Returns ISO format string on success, or the original value
    (or empty string) if parsing fails.
    """
    if not value or not isinstance(value, str) or value.strip() == "":
        return ""

    value = value.strip()

    for fmt in DATE_FORMATS:
        try:
            parsed = datetime.strptime(value, fmt)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.isoformat()
        except ValueError:
            continue

    logger.debug("Could not parse date string: '%s'", value)
    return value


def _parse_currency_string(value: str | None) -> dict[str, object]:
    """Parse currency string into ``{"amount": float | None, "currency": str | None}``.

    Never fabricates ``0.0`` or ``"USD"`` when input is missing or unparseable.
    """
    if value is None or isinstance(value, bool):
        return {"amount": None, "currency": None}
    if isinstance(value, (int, float)):
        import math
        fval = float(value)
        return {"amount": fval if math.isfinite(fval) else None, "currency": "USD" if math.isfinite(fval) else None}
    if not isinstance(value, str):
        return {"amount": None, "currency": None}

    raw = value.strip()
    if not raw or raw.lower() in ("null", "none", "n/a", "na", "-", "?", "undefined", "#n/a"):
        return {"amount": None, "currency": None}

    cleaned = raw.replace(",", "")
    sign = -1.0 if cleaned.startswith("-") else 1.0
    if cleaned[0] in ("+", "-"):
        cleaned = cleaned[1:].strip()

    symbol_map = {
        "$": "USD",
        "€": "EUR",
        "£": "GBP",
        "¥": "JPY",
        "₹": "INR",
        "₵": "GHS",
    }
    iso_codes = ("USD", "EUR", "GBP", "JPY", "INR", "GHS", "NGN", "KES", "ZAR", "CAD", "AUD", "CHF")

    currency_code: str | None = None
    for sym, code in symbol_map.items():
        if cleaned.startswith(sym):
            currency_code = code
            cleaned = cleaned[len(sym):].strip()
            break
        elif cleaned.endswith(sym):
            currency_code = code
            cleaned = cleaned[: -len(sym)].strip()
            break

    if currency_code is None:
        upper_cleaned = cleaned.upper()
        for iso in iso_codes:
            if upper_cleaned.startswith(iso + " ") or upper_cleaned.startswith(iso):
                rest = cleaned[len(iso):].strip()
                if rest and any(ch.isdigit() for ch in rest):
                    currency_code = iso
                    cleaned = rest
                    break
            elif upper_cleaned.endswith(" " + iso) or upper_cleaned.endswith(iso):
                rest = cleaned[: -len(iso)].strip()
                if rest and any(ch.isdigit() for ch in rest):
                    currency_code = iso
                    cleaned = rest
                    break

    match = re.fullmatch(r"[-+]?(?:\d+(?:\.\d+)?|\.\d+)", cleaned)
    if not match:
        return {"amount": None, "currency": None}

    try:
        amount = sign * float(match.group())
    except ValueError:
        return {"amount": None, "currency": None}

    return {"amount": amount, "currency": currency_code or "USD"}
