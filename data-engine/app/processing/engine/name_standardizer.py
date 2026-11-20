"""Production name standardization and placeholder identity detection engine.

Handles:
  - Whitespace collapsing and trimming
  - Intelligent Title-Casing (handles McDonald, O'Connor, D'Angelo, van der Beek, Al-Hassan)
  - Reversed name detection ("Last, First" -> "First Last")
  - Placeholder / test identity detection ("Unknown Doe", "John Doe", "Jane Doe", "Test User")
  - Transposition / spelling error flagging for verification
  - Separate retention of original raw name and standardized canonical name
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, List, Optional, Tuple


@dataclass
class NameStandardizationResult:
    """Outcome of personal or entity name standardization."""
    normalized_name: str
    original_name: str
    is_valid: bool
    is_placeholder: bool = False
    is_reversed: bool = False
    needs_review: bool = False
    review_reason: Optional[str] = None
    transformation: Optional[str] = None

    @property
    def canonical_name(self) -> str:
        return self.normalized_name

    @property
    def reversed_detected(self) -> bool:
        return self.is_reversed

    @property
    def potential_transposition(self) -> bool:
        return self.needs_review


PLACEHOLDER_NAMES = {
    "unknown",
    "unknown doe",
    "john doe",
    "jane doe",
    "baby doe",
    "test user",
    "test patient",
    "test customer",
    "anonymous",
    "n/a",
    "none",
    "null",
    "dummy",
    "sample user",
    "default user",
}

# Known common spelling transposition patterns to flag for human review
SUSPICIOUS_NAME_TRANSPOSITIONS = {
    "borwn": "Brown",
    "smiht": "Smith",
    "whiet": "White",
    "davisn": "Davis",
    "jonhs": "Johns",
}


class NameStandardizer:
    """Engine for cleaning and standardizing names while preserving identity integrity."""

    @classmethod
    def to_title_case_smart(cls, name_str: str) -> str:
        """Intelligently capitalizes name components respecting particles, prefixes, and hyphens."""
        if not name_str:
            return ""

        # Lowercase particles in compound surnames
        particles = {"van", "von", "der", "den", "de", "del", "della", "di", "da", "la", "le", "al", "el"}

        words = name_str.split(" ")
        formatted_words = []

        for i, w in enumerate(words):
            if not w:
                continue

            # Check hyphenated names: e.g. "Smith-Jones"
            if "-" in w:
                sub_parts = [cls._capitalize_single_part(sp) for sp in w.split("-")]
                formatted_words.append("-".join(sub_parts))
                continue

            # Check apostrophe names: e.g. "O'Connor", "D'Angelo"
            if "'" in w:
                ap_parts = [cls._capitalize_single_part(sp) for sp in w.split("'")]
                formatted_words.append("'".join(ap_parts))
                continue

            # Particle in middle of name
            if i > 0 and i < len(words) - 1 and w.lower() in particles:
                formatted_words.append(w.lower())
                continue

            formatted_words.append(cls._capitalize_single_part(w))

        return " ".join(formatted_words)

    @staticmethod
    def _capitalize_single_part(part: str) -> str:
        """Capitalizes a single name word, handling Mc/Mac prefixes."""
        if not part:
            return ""
        p_lower = part.lower()
        if p_lower.startswith("mc") and len(p_lower) > 2:
            return "Mc" + p_lower[2:].capitalize()
        if p_lower.startswith("mac") and len(p_lower) > 3 and p_lower[3] in "bcdfghjklmnpqrstvwxyz":
            return "Mac" + p_lower[3:].capitalize()
        return p_lower.capitalize()

    @classmethod
    def standardize_name(cls, raw_val: Any) -> NameStandardizationResult:
        """Standardizes a name string, detects placeholders, and flags suspicious transpositions."""
        if raw_val is None:
            return NameStandardizationResult(
                normalized_name="",
                original_name="",
                is_valid=False,
                is_placeholder=True,
                needs_review=True,
                review_reason="Name is missing",
            )

        raw = str(raw_val).strip()
        if not raw:
            return NameStandardizationResult(
                normalized_name="",
                original_name=raw,
                is_valid=False,
                is_placeholder=True,
                needs_review=True,
                review_reason="Name is empty",
            )

        # Collapse internal multiple whitespace
        clean = re.sub(r"\s+", " ", raw).strip()
        lower_clean = clean.lower()

        # Step 1: Detect placeholder identities
        if lower_clean in PLACEHOLDER_NAMES or re.match(r"^(unknown|user|patient|customer|test)[\s_-]*\d*$", lower_clean):
            return NameStandardizationResult(
                normalized_name=clean,
                original_name=raw,
                is_valid=False,
                is_placeholder=True,
                needs_review=True,
                review_reason=f"Placeholder or unresolved identity '{clean}' detected",
            )

        # Step 2: Detect reversed names: "Darko, Efua" or "Smith, John"
        is_reversed = False
        if "," in clean and len(clean.split(",")) == 2:
            last, first = clean.split(",")
            last_clean = last.strip()
            first_clean = first.strip()
            if first_clean and last_clean and not any(char.isdigit() for char in clean):
                clean = f"{first_clean} {last_clean}"
                is_reversed = True

        # Step 3: Apply smart title casing
        normalized = cls.to_title_case_smart(clean)

        # Step 4: Flag suspicious spelling transpositions (do not auto-correct!)
        needs_review = False
        review_reason = None
        for word in normalized.split(" "):
            w_lower = word.lower().strip(".,-")
            if w_lower in SUSPICIOUS_NAME_TRANSPOSITIONS:
                suggested = SUSPICIOUS_NAME_TRANSPOSITIONS[w_lower]
                needs_review = True
                review_reason = f"Potential spelling error '{word}' matches transposition of '{suggested}'; verification required"
                break

        # Step 5: Flag names containing unusual characters or SQL/code injection patterns
        if re.search(r"[;<>\[\]\{\}\(\)\*\|\=\@]", clean):
            needs_review = True
            review_reason = f"Name contains unexpected special characters or code syntax: '{clean}'"

        transformation = []
        if is_reversed:
            transformation.append("reversed_components_restored")
        if normalized != raw:
            transformation.append("smart_title_cased")

        return NameStandardizationResult(
            normalized_name=normalized,
            original_name=raw,
            is_valid=not needs_review or not review_reason or "unexpected special characters" not in review_reason,
            is_placeholder=False,
            is_reversed=is_reversed,
            needs_review=needs_review,
            review_reason=review_reason,
            transformation="; ".join(transformation) if transformation else None,
        )
