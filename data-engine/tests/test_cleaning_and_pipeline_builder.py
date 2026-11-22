"""Comprehensive tests for Configurable Cleaning Engine, Pipeline Builder, and Type Inference rules."""

import pytest
import polars as pl
from fastapi.testclient import TestClient

from app.main import app
from app.processing.engine.cleaning_engine import CleaningEngine, CleaningStepConfig
from app.processing.engine.cleaning_operations import (
    apply_deduplicate,
    apply_fill_missing,
    apply_handle_outliers,
    apply_remove_missing,
    apply_standardize_text,
)
from app.processing.engine.pipeline_builder import PipelineBuilderEngine, TransformationStep
from app.processing.engine.type_inference import InferredType, TypeInferenceEngine

client = TestClient(app)


def test_type_inference_preserves_leading_zeros_and_identifier_context():
    """Verify numeric strings with leading zeros or identifier context are NOT coerced to integers."""
    engine = TypeInferenceEngine()

    # Rule 1: Leading zeros are strictly IDENTIFIER
    assert engine.detect_scalar_type("001234") == InferredType.IDENTIFIER
    assert engine.detect_scalar_type("012345") == InferredType.IDENTIFIER

    # Rule 2: Column context detection
    assert engine.detect_scalar_type("12345", col_name="customer_id") == InferredType.IDENTIFIER
    assert engine.detect_scalar_type("98765", col_name="account_no") == InferredType.IDENTIFIER
    assert engine.detect_scalar_type("90210", col_name="zip_code") == InferredType.IDENTIFIER
    assert engine.detect_scalar_type(12345, col_name="customer_id") == InferredType.IDENTIFIER

    # Rule 3: Regular numbers without leading zero remain integers
    assert engine.detect_scalar_type("12345") == InferredType.INTEGER

    # Rule 4: Conversion protects leading zeros
    res = engine.convert_value("001234", InferredType.INTEGER, allow_lossy=False)
    assert not res.success
    assert "leading zeroes" in (res.warning or "").lower()

    # Rule 5: Conversion to IDENTIFIER preserves string intact
    id_res = engine.convert_value("  001234  ", InferredType.IDENTIFIER)
    assert id_res.success
    assert id_res.converted_value == "001234"


def test_cleaning_operations_missing_values():
    """Test missing value removal and various filling strategies."""
    df = pl.DataFrame({
        "id": ["1", "2", "3", "4", "5"],
        "score": [10.0, None, 30.0, None, 50.0],
        "category": ["A", "B", None, "A", "A"],
    })

    # Remove missing
    df_dropped, dropped_count = apply_remove_missing(df, ["score"])
    assert dropped_count == 2
    assert df_dropped.height == 3

    # Fill missing with mean (mean of 10, 30, 50 is 30.0)
    df_mean, filled_count = apply_fill_missing(df, "score", strategy="mean")
    assert filled_count == 2
    assert df_mean["score"].null_count() == 0
    assert df_mean["score"][1] == 30.0

    # Fill missing with mode (mode of category is "A")
    df_mode, _ = apply_fill_missing(df, "category", strategy="mode")
    assert df_mode["category"].null_count() == 0
    assert df_mode["category"][2] == "A"

    # Flag missing without modifying
    df_flagged, _ = apply_fill_missing(df, "score", strategy="flag")
    assert "_is_missing_score" in df_flagged.columns
    assert df_flagged["_is_missing_score"].to_list() == [False, True, False, True, False]


def test_cleaning_operations_text_and_deduplication():
    """Test text standardization and key-based deduplication."""
    df = pl.DataFrame({
        "name": ["  alice smith  ", "bob jones", "ALICE SMITH", "  alice smith  "],
        "email": ["alice@corp.com", "bob@corp.com", "alice@corp.com", "alice@corp.com"],
        "status": ["active", "PENDING", "act", "active"],
    })

    # Standardize text: trim, title case, dictionary mapping
    df_clean, mod_cnt = apply_standardize_text(
        df,
        column="status",
        trim=True,
        case="lower",
        replace_map={"act": "active"},
    )
    assert mod_cnt > 0
    assert "act" not in df_clean["status"].to_list()
    assert all(s in ("active", "pending") for s in df_clean["status"].to_list())

    # Deduplicate by business key "email"
    df_dedup, dedup_cnt = apply_deduplicate(df, subset=["email"], keep="first")
    assert dedup_cnt == 2
    assert df_dedup.height == 2


def test_cleaning_engine_preview_and_recipe_execution():
    """Test interactive cleaning preview diffs and sequential recipe execution."""
    df = pl.DataFrame({
        "id": ["1", "2", "3", "4"],
        "val": [10.0, None, 30.0, 40.0],
        "name": ["john", "jane", "joe", "john"],
    })

    engine = CleaningEngine()
    step_config = CleaningStepConfig(
        step_id="step-1",
        operation="fill_missing",
        column="val",
        parameters={"strategy": "mean"},
        description="Fill missing values with mean",
    )

    # 1. Preview step
    preview = engine.preview_step(df, step_config)
    assert preview.affected_rows == 1
    assert len(preview.sample_diffs) == 1
    assert preview.sample_diffs[0].column == "val"
    assert preview.sample_diffs[0].original_value is None
    assert preview.sample_diffs[0].proposed_value is not None

    # 2. Execute recipe
    steps = [
        step_config,
        CleaningStepConfig(
            step_id="step-2",
            operation="standardize_text",
            column="name",
            parameters={"case": "title"},
        ),
        CleaningStepConfig(
            step_id="step-3",
            operation="deduplicate",
            parameters={"subset": ["name"]},
        ),
    ]
    cleaned_df, audit_log = engine.execute_recipe(df, steps)
    assert len(audit_log) == 3
    assert cleaned_df["val"].null_count() == 0
    assert cleaned_df["name"].to_list() == ["John", "Jane", "Joe"]


def test_pipeline_builder_dag_transformations():
    """Test Palantir Foundry-style pipeline builder execution (Filter, Derive, GroupBy, Join)."""
    customers_df = pl.DataFrame({
        "cust_id": ["C1", "C2", "C3", "C4"],
        "tier": ["Enterprise", "Pro", "Free", "Enterprise"],
        "region": ["US", "EU", "US", "APAC"],
        "active": [True, True, False, True],
    })

    orders_df = pl.DataFrame({
        "cust_id": ["C1", "C1", "C2", "C4"],
        "amount": [500.0, 1500.0, 300.0, 2000.0],
    })

    steps = [
        # 1. Filter only active customers
        TransformationStep(
            step_id="s1",
            step_type="FILTER",
            parameters={"column": "active", "operator": "==", "value": True},
        ),
        # 2. Join with orders
        TransformationStep(
            step_id="s2",
            step_type="JOIN",
            parameters={"right_dataset": "orders", "on": "cust_id", "how": "inner"},
        ),
        # 3. Derive total with tax
        TransformationStep(
            step_id="s3",
            step_type="DERIVE",
            parameters={"column_name": "tax_rate", "constant_value": 0.1},
        ),
        # 4. Group by tier and compute count and sum
        TransformationStep(
            step_id="s4",
            step_type="GROUP_BY",
            parameters={"group_by": ["tier"], "aggregate_column": "amount", "function": "sum"},
        ),
        # 5. Sort by tier
        TransformationStep(
            step_id="s5",
            step_type="SORT",
            parameters={"by": ["tier"], "descending": False},
        ),
    ]

    out_df, report = PipelineBuilderEngine.execute_pipeline(
        input_df=customers_df,
        steps=steps,
        secondary_datasets={"orders": orders_df},
    )

    assert report.status == "COMPLETED"
    assert len(report.step_metrics) == 5
    assert "tier" in out_df.columns
    assert "amount_sum" in out_df.columns
    assert out_df.height >= 2


def test_api_cleaning_and_pipeline_endpoints():
    """Test HTTP endpoints for interactive cleaning preview, recipe execution, and pipeline DAGs."""
    sample_records = [
        {"id": "001", "name": "alice", "age": 25, "salary": 50000.0},
        {"id": "002", "name": "bob", "age": None, "salary": 60000.0},
        {"id": "003", "name": "charlie", "age": 35, "salary": None},
    ]

    # Test /analytics/cleaning/preview
    prev_resp = client.post(
        "/analytics/cleaning/preview",
        json={
            "records": sample_records,
            "step": {
                "operation": "fill_missing",
                "column": "age",
                "parameters": {"strategy": "mean"},
                "description": "Impute missing age",
            },
        },
    )
    assert prev_resp.status_code == 200
    prev_data = prev_resp.json()
    assert prev_data["affected_rows"] == 1
    assert len(prev_data["sample_diffs"]) == 1
    assert prev_data["sample_diffs"][0]["column"] == "age"

    # Test /analytics/cleaning/execute
    exec_resp = client.post(
        "/analytics/cleaning/execute",
        json={
            "tenant_id": "test_tenant",
            "dataset_name": "clean_employees",
            "records": sample_records,
            "steps": [
                {
                    "operation": "standardize_text",
                    "column": "name",
                    "parameters": {"case": "title"},
                },
                {
                    "operation": "fill_missing",
                    "column": "age",
                    "parameters": {"strategy": "constant", "fill_value": 30},
                },
            ],
        },
    )
    assert exec_resp.status_code == 200
    exec_data = exec_resp.json()
    assert exec_data["total_output_rows"] == 3
    assert len(exec_data["audit_log"]) == 2
    assert exec_data["rows"][0]["name"] == "Alice"
    assert exec_data["rows"][1]["age"] == 30

    # Test /analytics/pipelines/execute
    pipe_resp = client.post(
        "/analytics/pipelines/execute",
        json={
            "tenant_id": "test_tenant",
            "dataset_name": "curated_high_earners",
            "records": sample_records,
            "steps": [
                {
                    "step_type": "FILTER",
                    "parameters": {"column": "salary", "operator": ">=", "value": 55000.0},
                },
                {
                    "step_type": "SELECT",
                    "parameters": {"columns": ["id", "name", "salary"]},
                },
            ],
        },
    )
    assert pipe_resp.status_code == 200
    pipe_data = pipe_resp.json()
    assert pipe_data["total_output_rows"] == 1
    assert pipe_data["rows"][0]["id"] == "002"
