"""Production Golden Record generation and explainable survivorship engine.

Replaces naive timestamp/length overwriting with a multi-criteria survivorship hierarchy:
  1. Validation Status: Valid, verified values strictly win over unvalidated or invalid values.
  2. Source Priority: High-reliability source systems beat low-reliability feeds.
  3. Completeness: Richer, non-truncated values beat sparse entries.
  4. Recency: More recent updates take precedence when validity and reliability are tied.
  5. Field-Level Provenance: Tracks source record ID, source file, rule used, and timestamp.
  6. Conflict Preservation: Stores unresolved competing values in '_conflicts' metadata.
"""

from __future__ import annotations

import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from app.processing.engine.date_cleaner import DateCleaner
from app.processing.engine.type_inference import TypeInferenceEngine


@dataclass
class FieldProvenance:
    """Detailed lineage and survivorship explanation for an individual field."""
    field_name: str
    selected_value: Any
    source_record_id: str
    source_dataset: str
    survivorship_rule: str
    selection_reason: str
    is_verified: bool
    confidence: float
    timestamp: str


@dataclass
class GoldenRecordOutput:
    """Consolidated Golden Record with field-level provenance and preserved conflicts."""
    golden_id: str
    tenant_id: str
    version: int
    canonical_name: str
    entity_type: str
    quality_state: str  # "VERIFIED", "NEEDS_REVIEW", "REJECTED"
    quality_score: float
    confidence_score: float
    source_record_ids: List[str]
    cluster_size: int
    attributes: Dict[str, Any]
    field_provenance: Dict[str, FieldProvenance]
    conflicts: Dict[str, List[Dict[str, Any]]]
    created_at: str
    updated_at: str

    def to_dict(self) -> Dict[str, Any]:
        """Converts output to dictionary for persistence or JSON response."""
        res = {
            "golden_id": self.golden_id,
            "tenant_id": self.tenant_id,
            "version": self.version,
            "canonical_name": self.canonical_name,
            "entity_type": self.entity_type,
            "quality_state": self.quality_state,
            "quality_score": self.quality_score,
            "confidence_score": self.confidence_score,
            "source_record_ids": self.source_record_ids,
            "cluster_size": self.cluster_size,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "attributes": self.attributes,
            "_field_provenance": {k: asdict(v) for k, v in self.field_provenance.items()},
            "_conflicts": self.conflicts,
        }
        return res


class GoldenRecordEngine:
    """Engine for generating explainable canonical Golden Records with field-level lineage."""

    NAME_CANDIDATE_KEYS: Tuple[str, ...] = (
        "canonical_name",
        "canonicalname",
        "name",
        "full_name",
        "fullname",
        "customer_name",
        "customername",
        "client_name",
        "clientname",
        "company_name",
        "companyname",
        "company",
        "organization",
        "organization_name",
        "org_name",
        "patient_name",
        "person_name",
        "employee_name",
        "contact_name",
        "supplier_name",
        "carrier_name",
        "account_name",
        "user_name",
        "username",
        "title",
        "label",
    )

    IDENTIFIER_NAME_KEYS: Tuple[str, ...] = (
        "order_id",
        "shipment_id",
        "invoice_id",
        "tracking_number",
        "tracking_id",
        "waybill",
        "awb",
        "sku",
        "product_name",
        "product",
        "item_name",
        "item",
        "customer_id",
        "account_id",
        "email",
        "id",
        "record_id",
        "raw_id",
    )

    @classmethod
    def resolve_canonical_name(
        cls,
        attrs: Dict[str, Any],
        fallback_id: Optional[str] = None,
    ) -> str:
        """Resolve a human-readable canonical name across common domain column aliases."""
        if not attrs:
            return str(fallback_id).strip() if fallback_id else "Unnamed Entity"

        lower_map: Dict[str, Any] = {}
        for k, v in attrs.items():
            if not k or str(k).startswith("_"):
                continue
            lk = str(k).lower().strip()
            norm_lk = lk.replace("-", "_")
            lower_map.setdefault(lk, v)
            lower_map.setdefault(norm_lk, v)
            lower_map.setdefault(norm_lk.replace("_", ""), v)

        for key in cls.NAME_CANDIDATE_KEYS:
            val = lower_map.get(key)
            if val is not None and not TypeInferenceEngine.is_null_value(val):
                s = str(val).strip()
                if s and s.lower() not in ("unnamed entity", "null", "none"):
                    return s

        first = lower_map.get("first_name") or lower_map.get("firstname")
        last = lower_map.get("last_name") or lower_map.get("lastname")
        first_str = "" if TypeInferenceEngine.is_null_value(first) else str(first).strip()
        last_str = "" if TypeInferenceEngine.is_null_value(last) else str(last).strip()
        combined = f"{first_str} {last_str}".strip()
        if combined:
            return combined

        for key in cls.IDENTIFIER_NAME_KEYS:
            val = lower_map.get(key)
            if val is not None and not TypeInferenceEngine.is_null_value(val):
                s = str(val).strip()
                if s and s.lower() not in ("null", "none"):
                    return s

        for k, v in attrs.items():
            if str(k).startswith("_") or v is None or TypeInferenceEngine.is_null_value(v):
                continue
            s = str(v).strip()
            if s and s.lower() not in ("unnamed entity", "null", "none"):
                return s

        return str(fallback_id).strip() if fallback_id else "Unnamed Entity"

    @staticmethod
    def infer_entity_type(
        columns_or_attrs: Any,
        entity_type_hint: Optional[str] = None,
    ) -> str:
        """Preserve explicit entity types or infer an appropriate domain type from column names."""
        if entity_type_hint and str(entity_type_hint).strip() and str(entity_type_hint).strip().lower() != "entity":
            return str(entity_type_hint).strip()

        if isinstance(columns_or_attrs, dict):
            explicit = columns_or_attrs.get("_entity_type") or columns_or_attrs.get("entity_type") or columns_or_attrs.get("entityType")
            if explicit and str(explicit).strip() and str(explicit).strip().lower() != "entity":
                return str(explicit).strip()
            cols = [str(k) for k in columns_or_attrs.keys() if not str(k).startswith("_")]
        else:
            cols = [str(c) for c in (columns_or_attrs or []) if not str(c).startswith("_")]

        if not cols:
            return "Entity"

        keys = " ".join(c.lower() for c in cols)
        if any(tok in keys for tok in ("shipment", "tracking", "waybill", "awb", "freight", "carrier", "container", "origin", "destination")):
            return "Shipment"
        if any(tok in keys for tok in ("student", "academic", "school", "grade", "course")):
            return "Student"
        if any(tok in keys for tok in ("patient", "diagnosis", "mrn", "blood_type", "hospital")):
            return "Patient"
        if any(tok in keys for tok in ("order", "transaction", "revenue", "sales", "sale", "amount", "payment", "invoice")):
            return "Transaction"
        if any(tok in keys for tok in ("company", "organization", "org_name", "industry", "domain", "employees")) and not any(
            tok in keys for tok in ("first_name", "last_name", "dob", "birth_date", "gender")
        ):
            return "Organization"
        if any(tok in keys for tok in ("sku", "product", "inventory", "price")):
            return "Product"
        if any(tok in keys for tok in ("email", "first_name", "last_name", "person", "age", "gender", "dob", "salary", "name", "user")):
            return "Person"
        return "Entity"

    # Configurable source priority: higher value = higher trust
    DEFAULT_SOURCE_PRIORITY: Dict[str, int] = {
        "ehr": 100,
        "emr": 100,
        "hospital_master": 95,
        "crm": 80,
        "portal": 70,
        "csv_upload": 60,
        "external_feed": 50,
        "default": 50,
    }

    def __init__(self, source_priorities: Optional[Dict[str, int]] = None):
        self.source_priorities = {**self.DEFAULT_SOURCE_PRIORITY, **(source_priorities or {})}

    def _get_source_priority(self, source_name: Optional[str]) -> int:
        if not source_name:
            return self.source_priorities.get("default", 50)
        s_lower = source_name.lower()
        for k, prio in self.source_priorities.items():
            if k in s_lower:
                return prio
        return self.source_priorities.get("default", 50)

    @staticmethod
    def _parse_timestamp(val: Any) -> float:
        """Safely parses timestamp into epoch seconds for recency comparison."""
        if not val:
            return 0.0
        if isinstance(val, (int, float)):
            return float(val)
        if isinstance(val, datetime):
            if val.tzinfo is None:
                val = val.replace(tzinfo=timezone.utc)
            return val.timestamp()
        s = str(val).strip()
        try:
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
            return dt.timestamp()
        except Exception:
            return 0.0

    def select_best_field_value(
        self,
        field_name: str,
        candidates: List[Dict[str, Any]],  # list of {"value": v, "rec_id": id, "source": src, "ts": epoch, "valid": bool}
    ) -> Tuple[Any, FieldProvenance, List[Dict[str, Any]]]:
        """Applies field survivorship rules to select the single best attribute value."""
        if not candidates:
            prov = FieldProvenance(
                field_name=field_name,
                selected_value=None,
                source_record_id="",
                source_dataset="",
                survivorship_rule="NO_CANDIDATE",
                selection_reason="No non-null values present in source records",
                is_verified=False,
                confidence=0.0,
                timestamp=datetime.now(timezone.utc).isoformat(),
            )
            return None, prov, []

        # If only 1 candidate, select it
        if len(candidates) == 1:
            c = candidates[0]
            prov = FieldProvenance(
                field_name=field_name,
                selected_value=c["value"],
                source_record_id=c["rec_id"],
                source_dataset=c["source"],
                survivorship_rule="SINGLE_CANDIDATE",
                selection_reason="Single available value across source records",
                is_verified=c["valid"],
                confidence=1.0 if c["valid"] else 0.5,
                timestamp=datetime.now(timezone.utc).isoformat(),
            )
            return c["value"], prov, []

        # Filter candidates: separate valid from invalid
        valid_candidates = [c for c in candidates if c["valid"]]
        pool = valid_candidates if valid_candidates else candidates

        # Multi-factor score for each candidate:
        # Score = (validity * 1000) + (source_priority * 10) + (completeness_len * 0.1) + (recency_epoch * 1e-8)
        scored_candidates = []
        for c in pool:
            val_str = str(c["value"]).strip()
            score = (
                (1000.0 if c["valid"] else 0.0)
                + (self._get_source_priority(c["source"]) * 10.0)
                + (min(100, len(val_str)) * 0.1)
                + (c["ts"] * 1e-8)
            )
            scored_candidates.append((score, c))

        scored_candidates.sort(key=lambda x: x[0], reverse=True)
        winner = scored_candidates[0][1]

        # Determine explanation
        reasons = []
        if winner["valid"] and not all(c["valid"] for c in candidates):
            reasons.append("Validation status priority (clean value beats invalid)")
        if self._get_source_priority(winner["source"]) > 50:
            reasons.append(f"Source trust priority ('{winner['source']}')")
        if winner["ts"] > 0:
            reasons.append("Temporal recency priority")
        reasons.append("Maximum completeness")
        selection_reason = " > ".join(reasons)

        # Collect distinct competing conflicting values
        conflicts = []
        winner_val_str = str(winner["value"]).strip().lower()
        for _, c in scored_candidates[1:]:
            c_str = str(c["value"]).strip().lower()
            if c_str != winner_val_str:
                conflicts.append({
                    "value": c["value"],
                    "source_record_id": c["rec_id"],
                    "source_dataset": c["source"],
                    "is_valid": c["valid"],
                })

        prov = FieldProvenance(
            field_name=field_name,
            selected_value=winner["value"],
            source_record_id=winner["rec_id"],
            source_dataset=winner["source"],
            survivorship_rule="VALIDATION_SOURCE_RECENCY_COMPLETENESS",
            selection_reason=selection_reason,
            is_verified=winner["valid"],
            confidence=0.95 if winner["valid"] else 0.60,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

        return winner["value"], prov, conflicts

    def build_golden_record(
        self,
        cluster_records: List[Dict[str, Any]],
        tenant_id: str,
        golden_id: Optional[str] = None,
        entity_type: Optional[str] = None,
        matching_confidence: float = 1.0,
    ) -> GoldenRecordOutput:
        """Consolidates a cluster of records into a single verified Golden Record with provenance."""
        if not cluster_records:
            raise ValueError("Cannot generate Golden Record from empty cluster")

        if not golden_id:
            golden_id = f"gr-{uuid.uuid4()}"

        source_record_ids = [
            str(r.get("id") or r.get("record_id") or r.get("raw_id") or f"src-{i}")
            for i, r in enumerate(cluster_records)
        ]

        # Determine canonical entity type
        inferred_type = self.infer_entity_type(
            cluster_records[0],
            entity_type or cluster_records[0].get("_entity_type") or cluster_records[0].get("entity_type"),
        )

        # Pre-process candidate values per field
        field_candidates: Dict[str, List[Dict[str, Any]]] = {}
        exclude_keys = {
            "id", "record_id", "raw_id", "tenant_id", "confidence_score",
            "quality_state", "quality_score", "_table", "_is_valid", "_rowQuality",
        }

        for rec in cluster_records:
            rec_id = str(rec.get("id") or rec.get("record_id") or rec.get("raw_id") or "")
            src = str(rec.get("_table") or rec.get("source_id") or "default")
            ts = self._parse_timestamp(
                rec.get("updated_at")
                or rec.get("created_at")
                or rec.get("staged_at")
                or rec.get("joined_at")
                or rec.get("timestamp")
                or next((v for k, v in rec.items() if k.endswith("_at") or "date" in k.lower()), None)
            )

            for k, v in rec.items():
                if k in exclude_keys or k.startswith("_"):
                    continue
                if TypeInferenceEngine.is_null_value(v):
                    continue

                # Check field-level validity
                is_field_valid = True
                if "date" in k.lower() or k.lower() in ("dob", "birth_date", "joined_at"):
                    dres = DateCleaner.clean_date(v, field_name=k)
                    is_field_valid = dres.is_valid and not dres.is_ambiguous
                elif "email" in k.lower():
                    is_field_valid = "@" in str(v)

                field_candidates.setdefault(k, []).append({
                    "value": v,
                    "rec_id": rec_id,
                    "source": src,
                    "ts": ts,
                    "valid": is_field_valid,
                })

        # Apply survivorship across all fields
        consolidated_attrs: Dict[str, Any] = {}
        provenance_map: Dict[str, FieldProvenance] = {}
        conflicts_map: Dict[str, List[Dict[str, Any]]] = {}

        has_critical_error = False
        has_ambiguity_or_conflict = False

        for field_name, candidates in field_candidates.items():
            best_val, prov, conflicts = self.select_best_field_value(field_name, candidates)
            consolidated_attrs[field_name] = best_val
            provenance_map[field_name] = prov
            if conflicts:
                conflicts_map[field_name] = conflicts
                has_ambiguity_or_conflict = True

            if not prov.is_verified:
                has_critical_error = True

        # Extract Canonical Name
        canonical_name = self.resolve_canonical_name(
            consolidated_attrs,
            fallback_id=source_record_ids[0] if source_record_ids else None,
        )

        # Determine Record Quality State
        if has_critical_error:
            quality_state = "REJECTED"
            quality_score = 45.0
        elif has_ambiguity_or_conflict or matching_confidence < 0.90:
            quality_state = "NEEDS_REVIEW"
            quality_score = 78.5
        else:
            quality_state = "VERIFIED"
            quality_score = 98.0

        now_iso = datetime.now(timezone.utc).isoformat()

        return GoldenRecordOutput(
            golden_id=golden_id,
            tenant_id=tenant_id,
            version=1,
            canonical_name=canonical_name,
            entity_type=inferred_type,
            quality_state=quality_state,
            quality_score=quality_score,
            confidence_score=matching_confidence,
            source_record_ids=source_record_ids,
            cluster_size=len(cluster_records),
            attributes=consolidated_attrs,
            field_provenance=provenance_map,
            conflicts=conflicts_map,
            created_at=now_iso,
            updated_at=now_iso,
        )

    def generate_golden_record(
        self,
        cluster_records: List[Dict[str, Any]],
        tenant_id: str = "default_tenant",
        golden_id: Optional[str] = None,
        entity_type: Optional[str] = None,
        matching_confidence: float = 1.0,
        source_priorities: Optional[Dict[str, int]] = None,
    ) -> Dict[str, Any]:
        """Convenience method returning a flat merged record dict with metadata."""
        if source_priorities:
            self.source_priorities.update(source_priorities)
        output = self.build_golden_record(
            cluster_records=cluster_records,
            tenant_id=tenant_id,
            golden_id=golden_id,
            entity_type=entity_type,
            matching_confidence=matching_confidence,
        )
        res = output.to_dict()
        res.update(output.attributes)
        res["_provenance"] = res.get("_field_provenance", {})
        return res
