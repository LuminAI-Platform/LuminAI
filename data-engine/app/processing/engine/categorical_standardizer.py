"""Production categorical standardization engine.

Provides configurable canonical dictionaries and mapping policies for:
  - Sex / Gender
  - Country
  - City / Region
  - Status / Classification

Refuses blind coercion of unmapped numbers (e.g. '1' -> 'Female' rejected).
Flags suspicious near-matches for human review rather than blindly merging (e.g. 'Madian' vs 'Madina').
"""

from __future__ import annotations

import difflib
import re
from dataclasses import dataclass
from typing import Any, Dict, Optional, Set, Tuple


@dataclass
class CategoricalResult:
    """Outcome of standardizing a categorical value."""
    canonical_value: Optional[str]
    original_value: Any
    is_valid: bool
    needs_review: bool = False
    confidence: float = 1.0
    category_type: str = "general"
    review_reason: Optional[str] = None
    transformation: Optional[str] = None

    @property
    def canonical(self) -> Optional[str]:
        return self.canonical_value

    @property
    def requires_review(self) -> bool:
        return self.needs_review

    @property
    def suggested_match(self) -> Optional[str]:
        if self.review_reason:
            m = re.search(r"misspelling of '([^']+)'", self.review_reason)
            if m:
                return m.group(1)
        return None


# Default canonical dictionaries
GENDER_CANONICAL_MAP: Dict[str, str] = {
    "female": "Female",
    "f": "Female",
    "woman": "Female",
    "fem": "Female",
    "femme": "Female",
    "male": "Male",
    "m": "Male",
    "man": "Male",
    "masc": "Male",
    "homme": "Male",
    "non-binary": "Non-Binary",
    "nonbinary": "Non-Binary",
    "nb": "Non-Binary",
    "other": "Other",
    "unknown": "Unknown",
    "undisclosed": "Undisclosed",
}

COUNTRY_CANONICAL_MAP: Dict[str, Tuple[str, str]] = {
    # text -> (Canonical Name, ISO Alpha-2)
    "us": ("United States", "US"),
    "usa": ("United States", "US"),
    "u.s.": ("United States", "US"),
    "u.s.a.": ("United States", "US"),
    "united states": ("United States", "US"),
    "united states of america": ("United States", "US"),
    "de": ("Germany", "DE"),
    "deu": ("Germany", "DE"),
    "germany": ("Germany", "DE"),
    "deutschland": ("Germany", "DE"),
    "fr": ("France", "FR"),
    "fra": ("France", "FR"),
    "france": ("France", "FR"),
    "uk": ("United Kingdom", "GB"),
    "gb": ("United Kingdom", "GB"),
    "gbr": ("United Kingdom", "GB"),
    "united kingdom": ("United Kingdom", "GB"),
    "great britain": ("United Kingdom", "GB"),
    "ca": ("Canada", "CA"),
    "can": ("Canada", "CA"),
    "canada": ("Canada", "CA"),
    "gh": ("Ghana", "GH"),
    "gha": ("Ghana", "GH"),
    "ghana": ("Ghana", "GH"),
    "ng": ("Nigeria", "NG"),
    "nga": ("Nigeria", "NG"),
    "nigeria": ("Nigeria", "NG"),
    "au": ("Australia", "AU"),
    "aus": ("Australia", "AU"),
    "australia": ("Australia", "AU"),
    "za": ("South Africa", "ZA"),
    "south africa": ("South Africa", "ZA"),
}

KNOWN_CITIES: Set[str] = {
    "madina", "accra", "kumasi", "tema", "takoradi", "tamale",
    "london", "manchester", "birmingham",
    "berlin", "munich", "frankfurt", "hamburg",
    "paris", "lyon", "marseille",
    "new york", "los angeles", "chicago", "houston", "san francisco",
}

STATUS_CANONICAL_MAP: Dict[str, str] = {
    "low": "Low",
    "medium": "Medium",
    "med": "Medium",
    "high": "High",
    "critical": "Critical",
    "crit": "Critical",
    "active": "Active",
    "inactive": "Inactive",
    "pending": "Pending",
    "completed": "Completed",
    "cancelled": "Cancelled",
    "canceled": "Cancelled",
}


class CategoricalStandardizer:
    """Configurable domain categorical normalizer and near-match auditor."""

    def __init__(
        self,
        custom_gender_map: Optional[Dict[str, str]] = None,
        custom_country_map: Optional[Dict[str, Tuple[str, str]]] = None,
        custom_city_set: Optional[Set[str]] = None,
    ):
        self.gender_map = {**GENDER_CANONICAL_MAP, **(custom_gender_map or {})}
        self.country_map = {**COUNTRY_CANONICAL_MAP, **(custom_country_map or {})}
        self.known_cities = {*(custom_city_set or KNOWN_CITIES)}

    def standardize_gender(self, val: Any) -> CategoricalResult:
        """Standardizes gender / sex while strictly preventing blind numeric conversion."""
        if val is None:
            return CategoricalResult(
                canonical_value=None,
                original_value=val,
                is_valid=True,
                category_type="gender",
            )

        s = str(val).strip()
        lower = s.lower()

        if not lower or lower in ("null", "none", "n/a", "na", "-", "?", "undefined"):
            return CategoricalResult(
                canonical_value=None,
                original_value=val,
                is_valid=True,
                category_type="gender",
            )

        # STRICT SAFEGUARD: Reject numbers like '1' or '0' without established mapping!
        if lower in ("1", "0", "2", "3"):
            return CategoricalResult(
                canonical_value=None,
                original_value=val,
                is_valid=False,
                needs_review=True,
                category_type="gender",
                review_reason=f"Ambiguous numeric code '{val}' in gender column rejected without explicit source dictionary mapping",
            )

        if lower in self.gender_map:
            canonical = self.gender_map[lower]
            return CategoricalResult(
                canonical_value=canonical,
                original_value=val,
                is_valid=True,
                category_type="gender",
                transformation="gender_mapped_to_canonical" if canonical != s else None,
            )

        # Unknown gender category
        return CategoricalResult(
            canonical_value=s.capitalize(),
            original_value=val,
            is_valid=False,
            needs_review=True,
            confidence=0.5,
            category_type="gender",
            review_reason=f"Unrecognized gender term '{val}' requires classification verification",
        )

    def standardize_country(self, val: Any) -> CategoricalResult:
        """Standardizes country codes and names into canonical representations."""
        if val is None:
            return CategoricalResult(
                canonical_value=None,
                original_value=val,
                is_valid=True,
                category_type="country",
            )

        s = str(val).strip()
        lower = s.lower()

        if not lower or lower in ("null", "none", "n/a", "na", "-", "?", "undefined", "unknown"):
            return CategoricalResult(
                canonical_value=None,
                original_value=val,
                is_valid=True,
                category_type="country",
            )

        # Reject pure numbers like '99' or '00'
        if lower.isdigit():
            return CategoricalResult(
                canonical_value=None,
                original_value=val,
                is_valid=False,
                needs_review=True,
                category_type="country",
                review_reason=f"Invalid numeric code '{val}' in country column",
            )

        # Exact dictionary lookup
        clean_key = re.sub(r"[\._\s]+", " ", lower).strip()
        stripped_key = re.sub(r"[^a-z]", "", lower)
        matched_tuple = (
            self.country_map.get(lower)
            or self.country_map.get(clean_key)
            or self.country_map.get(stripped_key)
        )
        if matched_tuple:
            name, iso = matched_tuple
            return CategoricalResult(
                canonical_value=name,
                original_value=val,
                is_valid=True,
                category_type="country",
                transformation="country_canonicalized" if name != s else None,
            )

        # Check for near matches
        candidates = list(self.country_map.keys())
        matches = difflib.get_close_matches(clean_key, candidates, n=1, cutoff=0.85)
        if matches:
            best_match = matches[0]
            name, iso = self.country_map[best_match]
            return CategoricalResult(
                canonical_value=s.title(),
                original_value=val,
                is_valid=False,
                needs_review=True,
                confidence=0.8,
                category_type="country",
                review_reason=f"Country '{val}' is close to canonical '{name}'; human review recommended",
            )

        return CategoricalResult(
            canonical_value=s.title(),
            original_value=val,
            is_valid=True,
            needs_review=False,
            confidence=0.9,
            category_type="country",
        )

    def standardize_city(self, val: Any) -> CategoricalResult:
        """Standardizes city or region name, flagging suspicious spelling near-matches."""
        if val is None:
            return CategoricalResult(
                canonical_value=None,
                original_value=val,
                is_valid=True,
                category_type="city",
            )

        s = str(val).strip()
        lower = s.lower()

        if not lower or lower in ("null", "none", "n/a", "na", "-", "?", "undefined"):
            return CategoricalResult(
                canonical_value=None,
                original_value=val,
                is_valid=True,
                category_type="city",
            )

        # If in known cities exact match
        if lower in self.known_cities:
            canonical = lower.capitalize() if " " not in lower else " ".join(w.capitalize() for w in lower.split())
            return CategoricalResult(
                canonical_value=canonical,
                original_value=val,
                is_valid=True,
                category_type="city",
                transformation="city_casing_standardized" if canonical != s else None,
            )

        # Check for near match in known cities: e.g. "Madian" -> near match for "Madina"
        # Must be FLAGGED FOR REVIEW, never automatically merged!
        close = difflib.get_close_matches(lower, list(self.known_cities), n=1, cutoff=0.80)
        if close:
            suggested = close[0].capitalize()
            return CategoricalResult(
                canonical_value=s.capitalize(),
                original_value=val,
                is_valid=True,
                needs_review=True,
                confidence=0.75,
                category_type="city",
                review_reason=f"City '{s}' may be a misspelling of '{suggested}'; flagged for verification",
            )

        # Valid formatted city
        canonical = " ".join(w.capitalize() for w in s.split())
        return CategoricalResult(
            canonical_value=canonical,
            original_value=val,
            is_valid=True,
            category_type="city",
        )

    def standardize_status(self, val: Any) -> CategoricalResult:
        """Standardizes status or risk classification."""
        if val is None:
            return CategoricalResult(
                canonical_value=None,
                original_value=val,
                is_valid=True,
                category_type="status",
            )

        s = str(val).strip()
        lower = s.lower()

        if not lower or lower in ("null", "none", "n/a", "na", "-", "?", "undefined"):
            return CategoricalResult(
                canonical_value=None,
                original_value=val,
                is_valid=True,
                category_type="status",
            )

        # Check for percentages like "100%" or numbers
        if "%" in lower or lower.isdigit():
            return CategoricalResult(
                canonical_value=s,
                original_value=val,
                is_valid=False,
                needs_review=True,
                category_type="status",
                review_reason=f"Unexpected numeric format '{val}' in status/rating column",
            )

        if lower in STATUS_CANONICAL_MAP:
            canonical = STATUS_CANONICAL_MAP[lower]
            return CategoricalResult(
                canonical_value=canonical,
                original_value=val,
                is_valid=True,
                category_type="status",
                transformation="status_canonicalized" if canonical != s else None,
            )

        return CategoricalResult(
            canonical_value=s.capitalize(),
            original_value=val,
            is_valid=True,
            category_type="status",
        )
