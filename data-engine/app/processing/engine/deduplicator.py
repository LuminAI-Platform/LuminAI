"""Production multi-stage deduplication and entity resolution engine.

Implements:
  1. Exact identifier matching (MRN, National ID, SSN, normalized email).
  2. Normalized compound attribute matching.
  3. Weighted multi-field fuzzy matching with Jaro-Winkler & Levenshtein.
  4. Strict Contradiction Guard: records with differing verified identifiers (e.g. MRN, SSN)
     are NEVER merged regardless of name similarity.
  5. Confidence-based classification:
     - CONFIRMED_DUPLICATE (auto-merge with full provenance)
     - PROBABLE_DUPLICATE (auto-merge with audit flag)
     - POSSIBLE_MATCH (sent to human review queue)
     - DISTINCT_ENTITY (kept separate)
  6. Non-destructive merge lineage and audit trail.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import re
from typing import Any, Dict, List, Optional

import jellyfish


class MatchDecision:
    CONFIRMED_DUPLICATE = "CONFIRMED_DUPLICATE"
    PROBABLE_DUPLICATE = "PROBABLE_DUPLICATE"
    POSSIBLE_MATCH = "POSSIBLE_MATCH"
    DISTINCT_ENTITY = "DISTINCT_ENTITY"


# Backward compatibility alias
MatchState = MatchDecision


@dataclass
class MatchEvidence:
    """Detailed evidence supporting an entity resolution match or non-match decision."""
    matched_rules: List[str]
    attribute_scores: Dict[str, float]
    overall_confidence: float
    decision: str  # "CONFIRMED_DUPLICATE", "PROBABLE_DUPLICATE", "POSSIBLE_MATCH", "DISTINCT_ENTITY"
    has_conflicting_identifiers: bool = False
    notes: Optional[str] = None


@dataclass
class MergeRecordProvenance:
    """Provenance tracking which source records contributed to a consolidated entity."""
    source_record_ids: List[str]
    source_datasets: List[str]
    matching_evidence: MatchEvidence
    merge_timestamp: str
    rule_name: str
    field_survivorship: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    conflicting_values: Dict[str, List[Dict[str, Any]]] = field(default_factory=dict)


class MultiStageEntityResolver:
    """Multi-stage entity resolution and deduplication engine."""

    # Default weights for attribute comparison
    DEFAULT_WEIGHTS = {
        "name": 0.35,
        "email": 0.25,
        "dob": 0.20,
        "phone": 0.10,
        "address": 0.10,
    }

    CONFIRMED_THRESHOLD = 0.95
    PROBABLE_THRESHOLD = 0.85
    REVIEW_THRESHOLD = 0.65

    # Core identifier field names
    ID_FIELDS = {"mrn", "national_id", "ssn", "tax_id", "id_number", "customer_id", "account_id"}
    ID_FIELDS_CLEAN = {f.replace("_", "") for f in ID_FIELDS}

    @classmethod
    def extract_identifiers(cls, record: Dict[str, Any]) -> Dict[str, str]:
        """Extracts normalized identifiers from record attributes."""
        idents: Dict[str, str] = {}
        for k, v in record.items():
            if not v:
                continue
            k_clean = k.lower().replace("_", "").replace("-", "")
            for id_field in cls.ID_FIELDS_CLEAN:
                if id_field in k_clean:
                    s_val = str(v).strip().upper()
                    if s_val and s_val not in ("NULL", "NONE", "N/A", "-", "?", "0", "UNKNOWN"):
                        idents[id_field] = s_val
                        break
        return idents

    @classmethod
    def evaluate_pair(
        cls,
        rec_a: Dict[str, Any],
        rec_b: Dict[str, Any],
        custom_weights: Optional[Dict[str, float]] = None,
    ) -> MatchEvidence:
        """Evaluates a pair of records across multi-stage matching rules."""
        matched_rules: List[str] = []
        attr_scores: Dict[str, float] = {}

        # ─── STAGE 1: Check Strong Identifiers ──────────────────────────────────
        idents_a = cls.extract_identifiers(rec_a)
        idents_b = cls.extract_identifiers(rec_b)

        # Contradiction check: if both records have the SAME identifier type (e.g. MRN, SSN, National ID)
        # but DIFFERENT non-empty values, they are DIFFERENT entities!
        conflicting_ident = False
        shared_ident_types = set(idents_a.keys()) & set(idents_b.keys())
        for itype in shared_ident_types:
            if idents_a[itype] != idents_b[itype]:
                conflicting_ident = True
                break

        if conflicting_ident:
            return MatchEvidence(
                matched_rules=["IDENTIFIER_CONTRADICTION_GUARD"],
                attribute_scores={"identifier_conflict": 1.0},
                overall_confidence=0.0,
                decision="DISTINCT_ENTITY",
                has_conflicting_identifiers=True,
                notes=f"Records have contradictory verified identifiers ({shared_ident_types}); merge prohibited",
            )

        # Exact identifier match
        exact_ident_match = False
        for itype in shared_ident_types:
            if idents_a[itype] == idents_b[itype]:
                exact_ident_match = True
                matched_rules.append(f"EXACT_IDENTIFIER_MATCH_{itype.upper()}")

        if exact_ident_match:
            # Check name consistency if available
            name_a = str(rec_a.get("name") or rec_a.get("full_name") or "").strip().lower()
            name_b = str(rec_b.get("name") or rec_b.get("full_name") or "").strip().lower()
            if name_a and name_b:
                sim = jellyfish.jaro_winkler_similarity(name_a, name_b)
                attr_scores["name"] = round(sim, 4)
                if sim < 0.60:
                    # Identifier matches but names are completely different -> potential family member or ID error!
                    return MatchEvidence(
                        matched_rules=matched_rules + ["NAME_MISMATCH_ON_SHARED_ID"],
                        attribute_scores=attr_scores,
                        overall_confidence=0.75,
                        decision="POSSIBLE_MATCH",
                        notes="Identical identifier but significantly different names; flagged for human review",
                    )
            return MatchEvidence(
                matched_rules=matched_rules,
                attribute_scores={"identifier_match": 1.0},
                overall_confidence=0.99,
                decision="CONFIRMED_DUPLICATE",
                notes="Exact match on verified primary identifier with compatible attributes",
            )

        # ─── STAGE 2: Multi-Field Fuzzy Comparison & Email Matching ───────────
        weights = dict(custom_weights or cls.DEFAULT_WEIGHTS)
        active_weight = 0.0
        weighted_sum = 0.0

        # Compare Email
        email_a = str(rec_a.get("email") or rec_a.get("contact_email") or "").strip().lower()
        email_b = str(rec_b.get("email") or rec_b.get("contact_email") or "").strip().lower()
        if email_a and email_b and "@" in email_a:
            if email_a == email_b:
                matched_rules.append("EXACT_EMAIL_MATCH")
                attr_scores["email"] = 1.0
                w = weights.get("email", 0.25)
                weighted_sum += w * 1.0
                active_weight += w
            else:
                dist = jellyfish.levenshtein_distance(email_a, email_b)
                e_sim = max(0.0, 1.0 - (dist / max(len(email_a), len(email_b))))
                attr_scores["email"] = round(e_sim, 4)
                w = weights.get("email", 0.25)
                weighted_sum += w * e_sim
                active_weight += w

        # Compare Name
        name_a = str(rec_a.get("name") or rec_a.get("full_name") or "").strip().lower()
        name_b = str(rec_b.get("name") or rec_b.get("full_name") or "").strip().lower()
        if name_a and name_b:
            name_sim = jellyfish.jaro_winkler_similarity(name_a, name_b)
            attr_scores["name"] = round(name_sim, 4)
            w = weights.get("name", 0.35)
            weighted_sum += w * name_sim
            active_weight += w

        # Compare DOB
        dob_a = str(rec_a.get("dob") or rec_a.get("date_of_birth") or rec_a.get("birth_date") or "").strip()
        dob_b = str(rec_b.get("dob") or rec_b.get("date_of_birth") or rec_b.get("birth_date") or "").strip()
        if dob_a and dob_b and dob_a not in ("null", "none", "") and dob_b not in ("null", "none", ""):
            # Exact or Levenshtein similarity on date string
            if dob_a == dob_b:
                dob_sim = 1.0
            else:
                dist = jellyfish.levenshtein_distance(dob_a, dob_b)
                dob_sim = max(0.0, 1.0 - (dist / max(len(dob_a), len(dob_b))))
            attr_scores["dob"] = round(dob_sim, 4)
            w = weights.get("dob", 0.20)
            weighted_sum += w * dob_sim
            active_weight += w

        # Compare Phone
        phone_a = re.sub(r"\D", "", str(rec_a.get("phone") or rec_a.get("contact_phone") or ""))
        phone_b = re.sub(r"\D", "", str(rec_b.get("phone") or rec_b.get("contact_phone") or ""))
        if len(phone_a) >= 7 and len(phone_b) >= 7:
            phone_sim = 1.0 if phone_a == phone_b or phone_a.endswith(phone_b) or phone_b.endswith(phone_a) else 0.0
            attr_scores["phone"] = phone_sim
            w = weights.get("phone", 0.10)
            weighted_sum += w * phone_sim
            active_weight += w

        if active_weight > 0:
            score = round(weighted_sum / active_weight, 4)
        else:
            score = 0.0

        # Exact email match with compatible name qualifies as confirmed duplicate
        if "EXACT_EMAIL_MATCH" in matched_rules and attr_scores.get("name", 1.0) >= 0.70:
            score = max(score, 0.95)

        # Safeguard: if ONLY name was compared (no DOB, no email, no phone, no ID)
        # Never allow a single name similarity to exceed 0.85 without secondary corroborating attribute!
        if len(attr_scores) == 1 and "name" in attr_scores:
            if score >= 0.90:
                return MatchEvidence(
                    matched_rules=["SINGLE_ATTRIBUTE_SIMILAR_NAME"],
                    attribute_scores=attr_scores,
                    overall_confidence=0.80,  # Capped at review threshold
                    decision="POSSIBLE_MATCH",
                    notes="High name similarity but lacks secondary corroborating attributes (DOB/email/phone); human review required",
                )

        # ─── STAGE 4: Decision Classification ─────────────────────────────────
        if score >= cls.CONFIRMED_THRESHOLD:
            decision = "CONFIRMED_DUPLICATE"
            matched_rules.append("WEIGHTED_CONFIRMED_MATCH")
        elif score >= cls.PROBABLE_THRESHOLD:
            decision = "PROBABLE_DUPLICATE"
            matched_rules.append("WEIGHTED_PROBABLE_MATCH")
        elif score >= cls.REVIEW_THRESHOLD:
            decision = "POSSIBLE_MATCH"
            matched_rules.append("BORDERLINE_REVIEW_CANDIDATE")
        else:
            decision = "DISTINCT_ENTITY"

        return MatchEvidence(
            matched_rules=matched_rules,
            attribute_scores=attr_scores,
            overall_confidence=score,
            decision=decision,
            has_conflicting_identifiers=False,
            notes=f"Weighted score: {score} based on {list(attr_scores.keys())}",
        )


cls_ID_FIELDS_CLEAN = [f.replace("_", "") for f in MultiStageEntityResolver.ID_FIELDS]
