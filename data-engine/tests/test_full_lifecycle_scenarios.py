"""End-to-End Verification Test Suite across the 8 Core Data Lifecycle Scenarios.

Benchmark: Palantir Foundry Operating System Principles:
  1. Data Profiling & Understanding (Immutable Raw Layer)
  2. Data Cleaning with Interactive Diff Previews & Audit Logs
  3. Transformation Pipelines (DAG Execution & Curated Datasets)
  4. Real Analytics & Exploratory Data Analysis (EDA)
  5. Machine Learning Studio (Training, Evaluation, Persistent Registry)
  6. Graph Intelligence (Multi-Class Entity Decomposition & Semantic Edges)
  7. Evidence-Based Insights (Descriptive, Diagnostic, Predictive, Prescriptive)
  8. End-to-End Lineage & Provenance Traceability
"""

import polars as pl
import pytest

from app.processing.ai_insights.analyzer import DatasetProfiler
from app.processing.ai_insights.generator import InsightGenerator
from app.processing.engine.cleaning_engine import CleaningEngine, CleaningStepConfig
from app.processing.engine.eda_engine import EdaEngine
from app.processing.engine.lineage import GlobalLineageGraph
from app.processing.engine.pipeline_builder import PipelineBuilderEngine, TransformationStep
from app.processing.engine.profiler import DataProfiler
from app.processing.engine.type_inference import InferredType, TypeInferenceEngine
from app.processing.er.relational_decomposer import RelationalDecomposer
from app.processing.ml.ml_engine import MachineLearningEngine
from app.processing.ml.ml_registry import ModelRegistryService


@pytest.fixture
def qa_dirty_records() -> list[dict]:
    """Sample records containing duplicates, whitespace, nulls, and identifier codes."""
    return [
        {
            "record_id": "DUP-001",
            "full_name": "  Alice Smith  ",
            "national_id": "00123456",  # Identifier with leading zero
            "country": "US",
            "annual_turnover": 250000.0,
            "risk_rating": "LOW",
            "physician_name": "Dr. Sarah Adams",
            "department": "Cardiology",
            "insurance_payer": "Aetna",
        },
        {
            "record_id": "DUP-002",
            "full_name": "Alice Smith",
            "national_id": "00123456",
            "country": "US",
            "annual_turnover": 250000.0,
            "risk_rating": "LOW",
            "physician_name": "Dr. Sarah Adams",
            "department": "Cardiology",
            "insurance_payer": "Aetna",
        },
        {
            "record_id": "DUP-003",
            "full_name": "Bob Jones",
            "national_id": "00987654",
            "country": "UK",
            "annual_turnover": 450000.0,
            "risk_rating": "MEDIUM",
            "physician_name": "Dr. Sarah Adams",
            "department": "Cardiology",
            "insurance_payer": "Bupa",
        },
        {
            "record_id": "DUP-004",
            "full_name": "Charlie Brown",
            "national_id": "00332211",
            "country": "UK",
            "annual_turnover": 120000.0,
            "risk_rating": "HIGH",
            "physician_name": "Dr. Gregory House",
            "department": "Diagnostics",
            "insurance_payer": "Bupa",
        },
        {
            "record_id": "DUP-005",
            "full_name": "Diana Prince",
            "national_id": "00445566",
            "country": "CA",
            "annual_turnover": 9500000.0,  # Outlier
            "risk_rating": "LOW",
            "physician_name": "Dr. Gregory House",
            "department": "Diagnostics",
            "insurance_payer": "SunLife",
        },
    ]


def test_scenario_1_profiling_and_type_inference(qa_dirty_records):
    """Scenario 1: Profile dataset without mutating source, preserving identifiers."""
    type_engine = TypeInferenceEngine()
    col_profile = type_engine.profile_column("national_id", ["00123456", "00987654"])
    assert col_profile.predominant_type == InferredType.IDENTIFIER

    profiler = DataProfiler()
    df = pl.DataFrame(qa_dirty_records)
    report = profiler.profile_dataset(df)

    assert report.total_rows == 5
    assert report.total_columns == len(qa_dirty_records[0])
    assert report.duplicate_row_count >= 0
    assert len(report.quality_issues) >= 1
    # Ensure source df was not mutated
    assert df["national_id"][0] == "00123456"


def test_scenario_2_cleaning_with_preview_and_audit(qa_dirty_records):
    """Scenario 2: Preview proposed cleaning diffs, execute recipe, verify audit log."""
    engine = CleaningEngine()
    df = pl.DataFrame(qa_dirty_records)

    steps = [
        CleaningStepConfig(
            step_id="step_1",
            operation="standardize_text",
            column="full_name",
            parameters={"trim": True, "case": "title"},
            description="Trim whitespace and standardize name case",
        ),
        CleaningStepConfig(
            step_id="step_2",
            operation="deduplicate",
            column="national_id",
            parameters={"subset": ["national_id"], "keep": "first"},
            description="Deduplicate records by national identifier",
        ),
    ]

    preview = engine.preview_step(df, steps[0])
    assert preview.affected_rows >= 1
    assert preview.sample_diffs[0].original_value == "  Alice Smith  "
    assert preview.sample_diffs[0].proposed_value == "Alice Smith"

    cleaned_df, audit_log = engine.execute_recipe(df, steps)
    # DUP-001 and DUP-002 share national_id '00123456', so 1 is removed
    assert cleaned_df.height == 4
    assert len(audit_log) == 2
    assert audit_log[1]["rows_after"] == 4
    assert cleaned_df["national_id"][0] == "00123456"


def test_scenario_3_transformation_pipeline_dag(qa_dirty_records):
    """Scenario 3: Execute DAG transformation pipeline deterministically to curated dataset."""
    df = pl.DataFrame(qa_dirty_records)
    steps = [
        TransformationStep(
            step_id="t1",
            step_type="FILTER",
            parameters={"column": "annual_turnover", "operator": "lt", "value": 5000000.0},
        ),
        TransformationStep(
            step_id="t2",
            step_type="DERIVE",
            parameters={"target_column": "tax_amount", "expression": "annual_turnover * 0.2"},
        ),
        TransformationStep(
            step_id="t3",
            step_type="SORT",
            parameters={"by": ["annual_turnover"], "descending": [True]},
        ),
    ]

    curated_df, report = PipelineBuilderEngine.execute_pipeline(df, steps)
    assert curated_df.height == 4  # 9500000 filtered out
    assert "tax_amount" in curated_df.columns
    assert curated_df["tax_amount"][0] == 450000.0 * 0.2
    assert curated_df["annual_turnover"][0] == 450000.0
    assert report.status == "COMPLETED"


def test_scenario_4_exploratory_data_analysis(qa_dirty_records):
    """Scenario 4: Perform real statistical EDA with zero mock data."""
    df = pl.DataFrame(qa_dirty_records)
    report = EdaEngine.generate_eda_report(df)

    assert report["overview"]["total_rows"] == 5
    assert "annual_turnover" in report["numeric_statistics"]
    stats = report["numeric_statistics"]["annual_turnover"]
    assert stats["min"] == 120000.0
    assert stats["max"] == 9500000.0
    assert stats["median"] == 250000.0  # Median
    assert stats["outlier_count"] == 1  # 9.5M outlier detected
    assert "country" in report["categorical_statistics"]
    assert report["categorical_statistics"]["country"]["distinct_count"] == 3


def test_scenario_5_machine_learning_studio_and_registry():
    """Scenario 5: Train classification & clustering models and register in persistent registry."""
    training_data = [
        {"x1": 1.0, "x2": 2.0, "label": "CLASS_A"},
        {"x1": 1.5, "x2": 1.8, "label": "CLASS_A"},
        {"x1": 1.2, "x2": 2.2, "label": "CLASS_A"},
        {"x1": 1.8, "x2": 2.4, "label": "CLASS_A"},
        {"x1": 1.1, "x2": 1.9, "label": "CLASS_A"},
        {"x1": 5.0, "x2": 8.0, "label": "CLASS_B"},
        {"x1": 5.5, "x2": 8.2, "label": "CLASS_B"},
        {"x1": 6.0, "x2": 9.0, "label": "CLASS_B"},
        {"x1": 5.8, "x2": 8.6, "label": "CLASS_B"},
        {"x1": 6.2, "x2": 9.2, "label": "CLASS_B"},
    ]

    # Classification
    clf_result = MachineLearningEngine.train_and_evaluate(
        records=training_data,
        target_column="label",
        feature_columns=["x1", "x2"],
        algorithm="Random Forest",
        task_type="CLASSIFICATION",
    )
    assert clf_result["metrics"]["accuracy"] >= 0.5

    # Clustering
    clust_result = MachineLearningEngine.train_and_evaluate(
        records=training_data,
        target_column="",
        feature_columns=["x1", "x2"],
        algorithm="K-Means",
        task_type="CLUSTERING",
        hyperparameters={"n_clusters": 2},
    )
    assert "silhouette_score" in clust_result["metrics"]
    assert clust_result["n_clusters"] == 2

    # Persistent Model Registry & Experiment Logging
    exp_run = ModelRegistryService.log_experiment(
        tenant_id="test_tenant",
        model_name="Risk Classifier",
        algorithm="Random Forest",
        task_type="CLASSIFICATION",
        dataset_name="training_data",
        dataset_version=1,
        features=["x1", "x2"],
        target_column="label",
        metrics=clf_result["metrics"],
    )
    assert exp_run.run_id is not None

    model_entry = ModelRegistryService.register_model(
        tenant_id="test_tenant",
        run_id=exp_run.run_id,
        name="Risk Classifier",
        status="CHAMPION",
    )
    assert model_entry.model_id is not None

    loaded_models = ModelRegistryService.list_models("test_tenant")
    assert any(m["model_id"] == model_entry.model_id for m in loaded_models)


def test_scenario_6_relational_graph_decomposition(qa_dirty_records):
    """Scenario 6: Decompose flat rows into multi-class entity graph (Patient, Doctor, Dept, Insurer)."""
    decomposer = RelationalDecomposer()
    res = decomposer.decompose(
        records=qa_dirty_records,
        primary_entity_type="Patient",
        primary_id_col="record_id",
    )

    assert res.primary_entity_type == "Patient"
    assert res.node_counts_by_type["Patient"] == 5
    assert res.node_counts_by_type["Physician"] == 2  # Dr. Adams & Dr. House
    assert res.node_counts_by_type["Department"] == 2  # Cardiology & Diagnostics
    assert res.node_counts_by_type["Insurer"] == 3  # Aetna, Bupa, SunLife
    assert len(res.edges) > 10

    rel_types = {e["relationship_type"] for e in res.edges}
    assert "TREATED_BY" in rel_types
    assert "ADMITTED_TO" in rel_types
    assert "COVERED_BY" in rel_types


def test_scenario_7_evidence_based_insights(qa_dirty_records):
    """Scenario 7: Generate 4-tier insights (descriptive, diagnostic, predictive, prescriptive) with math evidence."""
    df = pl.DataFrame(qa_dirty_records)
    profiler = DatasetProfiler()
    profile = profiler.profile_dataframe(df, entity_type="Customer")

    generator = InsightGenerator()
    response = generator._generate_heuristic(
        profile=profile,
        tenant_id="acme",
        entity_type="Customer",
        table="golden_records",
    )

    categories = {item.category for item in response.insights}
    assert "descriptive" in categories
    assert "diagnostic" in categories
    assert "predictive" in categories
    assert "prescriptive" in categories

    for item in response.insights:
        assert item.evidence is not None  # Proof/calculation attached


def test_scenario_8_end_to_end_lineage_and_provenance():
    """Scenario 8: Trace asset provenance end-to-end from ML model/insight back to raw file."""
    graph = GlobalLineageGraph(tenant_id="acme")

    # Build provenance chain:
    # source_file -> raw_dataset -> cleaning_recipe -> pipeline_dag -> curated_dataset -> ml_model
    graph.register_node("file_01", "enterprise_data.csv", "SOURCE_FILE", tier="RAW")
    graph.register_node("ds_raw", "Raw Customers", "RAW_DATASET", tier="RAW")
    graph.register_node("recipe_01", "Deduplicate & Impute", "CLEANING_RECIPE", tier="WORKING")
    graph.register_node("pipeline_01", "Revenue DAG", "PIPELINE_DAG", tier="WORKING")
    graph.register_node("ds_curated", "Curated Customers V1", "CURATED_DATASET", tier="CURATED")
    graph.register_node("model_rf", "Risk Classifier Model", "ML_MODEL", tier="CURATED")

    graph.link("file_01", "ds_raw", "INGESTED_AS")
    graph.link("ds_raw", "recipe_01", "CLEANED_BY")
    graph.link("recipe_01", "pipeline_01", "TRANSFORMED_BY")
    graph.link("pipeline_01", "ds_curated", "PRODUCED_AS")
    graph.link("ds_curated", "model_rf", "TRAINED_ON")

    # Trace upstream from model
    upstream = graph.trace_upstream("model_rf")
    upstream_ids = [n["node_id"] for n in upstream]
    assert "model_rf" in upstream_ids
    assert "ds_curated" in upstream_ids
    assert "pipeline_01" in upstream_ids
    assert "recipe_01" in upstream_ids
    assert "ds_raw" in upstream_ids
    assert "file_01" in upstream_ids

    # Trace downstream from raw source file
    downstream = graph.trace_downstream("file_01")
    downstream_ids = [n["node_id"] for n in downstream]
    assert "file_01" in downstream_ids
    assert "ds_raw" in downstream_ids
    assert "ds_curated" in downstream_ids
    assert "model_rf" in downstream_ids
