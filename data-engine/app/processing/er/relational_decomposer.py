"""Relational Entity Decomposition Engine for Multi-Class Knowledge Graphs.

Decomposes flat, denormalized tabular datasets (e.g. clinical records, sales orders)
into first-class multi-entity graph ontologies (e.g. Patient, Doctor, Department,
Insurer, Diagnosis, Medication) with typed semantic relationships in Neo4j.
"""

from __future__ import annotations

import hashlib
import re
import uuid
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple


from app.processing.engine.golden_record_engine import GoldenRecordEngine


@dataclass
class DecompositionRule:
    """Configuration rule for decomposing a flat column group into an entity."""

    target_entity_type: str
    relationship_type: str
    id_column: Optional[str] = None
    name_column: Optional[str] = None
    attribute_columns: List[str] = field(default_factory=list)
    direction: str = "OUTGOING"  # OUTGOING: Primary -> Secondary


@dataclass
class DecompositionResult:
    """Summary and extracted nodes/edges from relational decomposition."""

    primary_entity_type: str
    total_nodes: int
    total_edges: int
    node_counts_by_type: Dict[str, int]
    edge_counts_by_type: Dict[str, int]
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


# Built-in semantic heuristics for automatic multi-entity decomposition
SEMANTIC_DOMAIN_PATTERNS = [
    # Healthcare / Clinical
    {
        "entity_type": "Physician",
        "rel_type": "TREATED_BY",
        "name_patterns": [r"physician.*name", r"doctor.*name", r"provider.*name", r"attending.*name"],
        "id_patterns": [r"doctor.*id", r"physician.*id", r"npi", r"provider.*id"],
        "attr_patterns": [r"specialty", r"physician.*role", r"clinic.*staff"],
    },
    {
        "entity_type": "Department",
        "rel_type": "ADMITTED_TO",
        "name_patterns": [r"^department$", r"^department.*name$", r"^clinic.*name$", r"^unit$", r"^ward$"],
        "id_patterns": [r"dept.*id", r"department.*id", r"unit.*id"],
        "attr_patterns": [r"hospital.*wing", r"building", r"floor"],
    },
    {
        "entity_type": "Insurer",
        "rel_type": "COVERED_BY",
        "name_patterns": [r"insurance.*payer", r"^payer$", r"^insurer$", r"insurance.*company"],
        "id_patterns": [r"payer.*id", r"insurance.*id", r"carrier.*id"],
        "attr_patterns": [r"policy.*no", r"plan.*type", r"coverage.*level"],
    },
    {
        "entity_type": "Diagnosis",
        "rel_type": "DIAGNOSED_WITH",
        "name_patterns": [r"diagnosis.*desc", r"^diagnosis$", r"condition.*name"],
        "id_patterns": [r"diagnosis.*code", r"icd.*code", r"icd10", r"icd9"],
        "attr_patterns": [r"diagnosis.*severity", r"stage", r"chronicity"],
    },
    {
        "entity_type": "Medication",
        "rel_type": "PRESCRIBED",
        "name_patterns": [r"^medication$", r"drug.*name", r"rx.*name"],
        "id_patterns": [r"ndc.*code", r"rx.*id", r"medication.*id"],
        "attr_patterns": [r"dosage", r"route", r"frequency"],
    },
    # Enterprise / Supply Chain / E-commerce
    {
        "entity_type": "Vendor",
        "rel_type": "SUPPLIED_BY",
        "name_patterns": [r"vendor.*name", r"supplier.*name", r"^seller$"],
        "id_patterns": [r"vendor.*id", r"supplier.*id", r"seller.*id"],
        "attr_patterns": [r"vendor.*country", r"supplier.*tier"],
    },
    {
        "entity_type": "Customer",
        "rel_type": "PURCHASED_BY",
        "name_patterns": [r"customer.*name", r"client.*name", r"buyer.*name"],
        "id_patterns": [r"customer.*id", r"client.*id", r"buyer.*id"],
        "attr_patterns": [r"customer.*segment", r"loyalty.*tier"],
    },
    {
        "entity_type": "Product",
        "rel_type": "CONTAINS_PRODUCT",
        "name_patterns": [r"product.*name", r"item.*name", r"sku.*name"],
        "id_patterns": [r"product.*id", r"sku", r"item.*id"],
        "attr_patterns": [r"category", r"brand", r"unit.*price"],
    },
    {
        "entity_type": "Store",
        "rel_type": "LOCATED_AT",
        "name_patterns": [r"store.*name", r"branch.*name", r"location.*name"],
        "id_patterns": [r"store.*id", r"branch.*id", r"location.*id"],
        "attr_patterns": [r"city", r"state", r"region", r"postal.*code"],
    },
]


class RelationalDecomposer:
    """Decomposes flat record rows into multi-entity graphs."""

    @staticmethod
    def _slugify(val: Any) -> str:
        s = str(val).strip().lower()
        s = re.sub(r"[^\w\s-]", "", s)
        return re.sub(r"[-\s]+", "_", s)

    @classmethod
    def generate_entity_id(cls, entity_type: str, raw_key: Any) -> str:
        """Create a deterministic stable identifier for a secondary entity."""
        clean_key = cls._slugify(raw_key)
        digest = hashlib.sha256(f"{entity_type.lower()}:{clean_key}".encode("utf-8")).hexdigest()[:12]
        return f"{entity_type.lower()}_{clean_key[:16]}_{digest}"

    def auto_detect_rules(self, columns: List[str]) -> List[DecompositionRule]:
        """Infer decomposition rules by matching column headers against known domain patterns."""
        rules: List[DecompositionRule] = []
        assigned_cols: Set[str] = set()

        for domain in SEMANTIC_DOMAIN_PATTERNS:
            target_type = domain["entity_type"]
            rel_type = domain["rel_type"]

            id_col: Optional[str] = None
            for p in domain["id_patterns"]:
                rx = re.compile(p, re.IGNORECASE)
                match = next((c for c in columns if rx.search(c) and c not in assigned_cols), None)
                if match:
                    id_col = match
                    break

            name_col: Optional[str] = None
            for p in domain["name_patterns"]:
                rx = re.compile(p, re.IGNORECASE)
                match = next((c for c in columns if rx.search(c) and c != id_col and c not in assigned_cols), None)
                if match:
                    name_col = match
                    break

            # Need at least an ID or a Name column to extract an entity
            if not id_col and not name_col:
                continue

            attr_cols: List[str] = []
            for p in domain["attr_patterns"]:
                rx = re.compile(p, re.IGNORECASE)
                matches = [c for c in columns if rx.search(c) and c not in (id_col, name_col) and c not in assigned_cols]
                attr_cols.extend(matches)

            for col in filter(None, [id_col, name_col] + attr_cols):
                assigned_cols.add(col)

            rules.append(
                DecompositionRule(
                    target_entity_type=target_type,
                    relationship_type=rel_type,
                    id_column=id_col,
                    name_column=name_col,
                    attribute_columns=attr_cols,
                )
            )

        return rules

    def decompose(
        self,
        records: List[Dict[str, Any]],
        primary_entity_type: str = "Record",
        primary_id_col: Optional[str] = None,
        rules: Optional[List[DecompositionRule]] = None,
    ) -> DecompositionResult:
        """Decompose flat record dictionaries into multi-class graph nodes and edges."""
        if not records:
            return DecompositionResult(
                primary_entity_type=primary_entity_type,
                total_nodes=0,
                total_edges=0,
                node_counts_by_type={},
                edge_counts_by_type={},
                nodes=[],
                edges=[],
            )

        cols = list(records[0].keys())
        if rules is None or len(rules) == 0:
            rules = self.auto_detect_rules(cols)

        # Detect primary ID column if not provided
        if not primary_id_col:
            candidate_pks = ["id", "_id", "record_id", "patient_id", "order_id", "customer_id", "code"]
            for cand in candidate_pks:
                if cand in cols:
                    primary_id_col = cand
                    break
            if not primary_id_col:
                primary_id_col = cols[0]

        all_secondary_cols: Set[str] = set()
        for r in rules:
            if r.id_column:
                all_secondary_cols.add(r.id_column)
            if r.name_column:
                all_secondary_cols.add(r.name_column)
            all_secondary_cols.update(r.attribute_columns)

        nodes_dict: Dict[Tuple[str, str], Dict[str, Any]] = {}
        edges_list: List[Dict[str, Any]] = []
        edge_fingerprints: Set[Tuple[str, str, str]] = set()

        for idx, row in enumerate(records):
            raw_primary_id = row.get(primary_id_col)
            primary_id = str(raw_primary_id).strip() if raw_primary_id is not None else f"{primary_entity_type}_{idx}"
            if not primary_id:
                primary_id = f"{primary_entity_type}_{idx}"

            primary_props = {k: v for k, v in row.items() if k not in all_secondary_cols and v is not None}
            primary_label = GoldenRecordEngine.resolve_canonical_name(
                primary_props, fallback_id=primary_id
            )
            p_key = (primary_entity_type, primary_id)
            if p_key not in nodes_dict:
                nodes_dict[p_key] = {
                    "id": primary_id,
                    "label": primary_label,
                    "canonical_name": primary_label,
                    "entity_type": primary_entity_type,
                    "properties": primary_props,
                }

            # Extract secondary entities according to rules
            for r in rules:
                sec_raw_id = row.get(r.id_column) if r.id_column else None
                sec_raw_name = row.get(r.name_column) if r.name_column else None

                key_basis = sec_raw_id if (sec_raw_id is not None and str(sec_raw_id).strip()) else sec_raw_name
                if key_basis is None or not str(key_basis).strip():
                    continue

                sec_id = str(sec_raw_id).strip() if (sec_raw_id is not None and str(sec_raw_id).strip()) else self.generate_entity_id(r.target_entity_type, key_basis)
                sec_key = (r.target_entity_type, sec_id)

                if sec_key not in nodes_dict:
                    sec_props: Dict[str, Any] = {}
                    if r.name_column and sec_raw_name is not None:
                        sec_props["name"] = str(sec_raw_name).strip()
                    if r.id_column and sec_raw_id is not None:
                        sec_props["code"] = str(sec_raw_id).strip()
                    for attr_col in r.attribute_columns:
                        if attr_col in row and row[attr_col] is not None:
                            sec_props[attr_col] = row[attr_col]
                    sec_label = (
                        str(sec_raw_name).strip()
                        if sec_raw_name is not None and str(sec_raw_name).strip()
                        else str(key_basis).strip()
                    )
                    nodes_dict[sec_key] = {
                        "id": sec_id,
                        "label": sec_label,
                        "canonical_name": sec_label,
                        "entity_type": r.target_entity_type,
                        "properties": sec_props,
                    }

                # Create typed semantic relationship edge
                fp = (primary_id, sec_id, r.relationship_type)
                if fp not in edge_fingerprints:
                    edge_fingerprints.add(fp)
                    edges_list.append({
                        "id": str(uuid.uuid4()),
                        "source_entity_id": primary_id,
                        "source_entity_type": primary_entity_type,
                        "target_entity_id": sec_id,
                        "target_entity_type": r.target_entity_type,
                        "relationship_type": r.relationship_type,
                        "direction": r.direction,
                        "confidence": 1.0,
                    })

        final_nodes = list(nodes_dict.values())
        node_counts: Dict[str, int] = {}
        for n in final_nodes:
            node_counts[n["entity_type"]] = node_counts.get(n["entity_type"], 0) + 1

        edge_counts: Dict[str, int] = {}
        for e in edges_list:
            edge_counts[e["relationship_type"]] = edge_counts.get(e["relationship_type"], 0) + 1

        return DecompositionResult(
            primary_entity_type=primary_entity_type,
            total_nodes=len(final_nodes),
            total_edges=len(edges_list),
            node_counts_by_type=node_counts,
            edge_counts_by_type=edge_counts,
            nodes=final_nodes,
            edges=edges_list,
        )
