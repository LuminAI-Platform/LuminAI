"""Tests for Relational Entity Decomposition Engine."""

from app.processing.er.relational_decomposer import (
    DecompositionRule,
    RelationalDecomposer,
)


def test_auto_detect_healthcare_rules():
    decomposer = RelationalDecomposer()
    cols = [
        "patient_id", "patient_name", "age",
        "doctor_id", "physician_name", "specialty",
        "department", "hospital_wing",
        "insurance_payer", "policy_no",
        "diagnosis_code", "diagnosis_desc",
        "medication", "dosage"
    ]
    rules = decomposer.auto_detect_rules(cols)
    assert len(rules) >= 4

    types = {r.target_entity_type for r in rules}
    assert "Physician" in types
    assert "Department" in types
    assert "Insurer" in types
    assert "Diagnosis" in types or "Medication" in types


def test_decompose_healthcare_dataset():
    decomposer = RelationalDecomposer()
    records = [
        {
            "patient_id": "P001",
            "patient_name": "Alice Brown",
            "age": 34,
            "doctor_id": "DOC-99",
            "physician_name": "Dr. House",
            "specialty": "Diagnostics",
            "department": "Internal Medicine",
            "insurance_payer": "Blue Cross",
            "diagnosis_code": "E11.9",
            "diagnosis_desc": "Type 2 diabetes",
            "medication": "Metformin",
        },
        {
            "patient_id": "P002",
            "patient_name": "Bob Smith",
            "age": 52,
            "doctor_id": "DOC-99",
            "physician_name": "Dr. House",
            "specialty": "Diagnostics",
            "department": "Internal Medicine",
            "insurance_payer": "Aetna",
            "diagnosis_code": "I10",
            "diagnosis_desc": "Essential hypertension",
            "medication": "Lisinopril",
        },
        {
            "patient_id": "P003",
            "patient_name": "Carol Danvers",
            "age": 29,
            "doctor_id": "DOC-101",
            "physician_name": "Dr. Strange",
            "specialty": "Neuro",
            "department": "Neurology",
            "insurance_payer": "Aetna",
            "diagnosis_code": "G43",
            "diagnosis_desc": "Migraine",
            "medication": "Sumatriptan",
        },
    ]

    result = decomposer.decompose(
        records=records,
        primary_entity_type="Patient",
        primary_id_col="patient_id",
    )

    assert result.primary_entity_type == "Patient"
    assert result.node_counts_by_type["Patient"] == 3
    # Both P001 and P002 share Dr. House (DOC-99) and Internal Medicine
    assert result.node_counts_by_type["Physician"] == 2  # Dr. House & Dr. Strange
    assert result.node_counts_by_type["Department"] == 2  # Internal Medicine & Neurology
    assert result.node_counts_by_type["Insurer"] == 2  # Blue Cross & Aetna

    # Verify edges exist and connect patients to doctors
    treated_by_edges = [e for e in result.edges if e["relationship_type"] == "TREATED_BY"]
    assert len(treated_by_edges) == 3
    p1_edge = next(e for e in treated_by_edges if e["source_entity_id"] == "P001")
    assert p1_edge["target_entity_id"] == "DOC-99"


def test_decompose_custom_rules():
    decomposer = RelationalDecomposer()
    records = [
        {"order_id": "ORD-1", "user_id": "USR-10", "item_sku": "SKU-ABC", "amount": 99.5},
        {"order_id": "ORD-2", "user_id": "USR-10", "item_sku": "SKU-XYZ", "amount": 45.0},
    ]
    rules = [
        DecompositionRule(
            target_entity_type="Customer",
            relationship_type="PLACED_BY",
            id_column="user_id",
        ),
        DecompositionRule(
            target_entity_type="Item",
            relationship_type="INCLUDES_ITEM",
            id_column="item_sku",
        ),
    ]

    result = decomposer.decompose(
        records=records,
        primary_entity_type="Order",
        primary_id_col="order_id",
        rules=rules,
    )

    assert result.node_counts_by_type["Order"] == 2
    assert result.node_counts_by_type["Customer"] == 1  # Deduplicated USR-10
    assert result.node_counts_by_type["Item"] == 2
    assert result.total_edges == 4
