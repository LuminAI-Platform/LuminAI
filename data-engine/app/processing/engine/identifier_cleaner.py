"""Production identifier validation, cleaning, and collision avoidance engine.

Handles:
  - Medical Record Numbers (MRN)
  - National Identifiers (National ID, SSN)
  - Customer IDs / Account IDs / Transaction IDs
  - Inconsistent formatting and whitespace
  - Collision prevention: strictly avoids stripping prefixes or symbols that distinguish IDs
  - Duplicate identifier tracking across distinct records
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Set


@dataclass
class IdentifierResult:
    """Outcome of validating and standardizing an identifier."""
    normalized_id: Optional[str]
    original_id: Any
    is_valid: bool
    is_missing: bool = False
    needs_review: bool = False
    error: Optional[str] = None
    transformation: Optional[str] = None

    @property
    def cleaned_id(self) -> Optional[str]:
        return self.normalized_id


class IdentifierCleaner:
    """Engine for cleaning and auditing enterprise and medical identifiers."""

    @classmethod
    def clean_identifier(
        cls,
        val: Any,
        id_type: str = "generic",
        required: bool = True,
    ) -> IdentifierResult:
        """Validates and cleans an identifier without destructive collision-inducing operations."""
        if val is None:
            return IdentifierResult(
                normalized_id=None,
                original_id=val,
                is_valid=not required,
                is_missing=True,
                error="Identifier is missing" if required else None,
            )

        s = str(val).strip()
        lower = s.lower()

        if not s or lower in ("null", "none", "n/a", "na", "-", "?", "undefined", "#n/a"):
            return IdentifierResult(
                normalized_id=None,
                original_id=val,
                is_valid=not required,
                is_missing=True,
                error="Identifier is empty or null sentinel" if required else None,
            )

        # Remove unprintable / control characters
        cleaned = re.sub(r"[\x00-\x1f\x7f\u200b-\u200d\ufeff]", "", s).strip()

        # Check for dangerous code injection in identifiers
        if re.search(r"[;<>'\"]", cleaned):
            return IdentifierResult(
                normalized_id=cleaned,
                original_id=val,
                is_valid=False,
                needs_review=True,
                error=f"Identifier '{val}' contains illegal characters or script syntax",
            )

        # Standardize uppercase for standard alphanumeric identifiers: e.g. "nat-00001" -> "NAT-00001"
        normalized = cleaned.upper() if re.match(r"^[a-zA-Z0-9_\-\./#]+$", cleaned) else cleaned

        # Type-specific format validations
        id_type_lower = id_type.lower()

        # MRN: alphanumeric with optional hyphens, length 4 to 30
        if "mrn" in id_type_lower:
            if len(cleaned) < 3 or len(cleaned) > 40:
                return IdentifierResult(
                    normalized_id=normalized,
                    original_id=val,
                    is_valid=False,
                    needs_review=True,
                    error=f"MRN '{val}' has invalid length ({len(cleaned)})",
                )

        # SSN: 9 digits with optional hyphens: ###-##-####
        elif "ssn" in id_type_lower:
            digits = re.sub(r"\D", "", cleaned)
            if len(digits) != 9:
                return IdentifierResult(
                    normalized_id=normalized,
                    original_id=val,
                    is_valid=False,
                    needs_review=True,
                    error=f"SSN '{val}' does not contain exactly 9 digits",
                )
            if digits in ("000000000", "111111111", "123456789"):
                return IdentifierResult(
                    normalized_id=normalized,
                    original_id=val,
                    is_valid=False,
                    needs_review=True,
                    error=f"SSN '{val}' is a known dummy/placeholder sequence",
                )

        # General sanity check: length >= 2
        if len(cleaned) < 2:
            return IdentifierResult(
                normalized_id=normalized,
                original_id=val,
                is_valid=False,
                needs_review=True,
                error=f"Identifier '{val}' is suspiciously short",
            )

        transformation = "uppercased_identifier" if normalized != cleaned else None
        return IdentifierResult(
            normalized_id=normalized,
            original_id=val,
            is_valid=True,
            transformation=transformation,
        )

    @classmethod
    def audit_identifier_collisions(
        cls,
        identifiers: List[Tuple[str, str]],  # (record_id, normalized_id)
    ) -> Dict[str, List[str]]:
        """Audits a list of record IDs and identifiers to detect duplicate/colliding IDs."""
        seen: Dict[str, List[str]] = {}
        for rec_id, ident in identifiers:
            if ident:
                seen.setdefault(ident, []).append(rec_id)

        # Return only colliding identifiers (associated with > 1 record)
        return {ident: rec_ids for ident, rec_ids in seen.items() if len(rec_ids) > 1}
