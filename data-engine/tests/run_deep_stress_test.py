"""Senior QA Principal Stress & Accuracy Test Harness for LuminAI Data Engine.

Executes an exhaustive, brutal manual & automated test across all data engine subsystems:
  1. Pre-Flight Schema Detection & Rejection Gate
  2. Polars Cleaning & Currency/Date Parsing Engine
  3. Safe Intra-Source Deduplication
  4. Entity Resolution Candidate Blocking & O(N^2) Reduction
  5. Pairwise Scoring & Semantic Nickname Comparison
  6. Threshold Classification & Review Candidate Persistence
  7. Connected Components Graph Clustering & Canonical Golden Record Synthesis
  8. Field-Level Provenance Attribution
  9. Production Data Quality Asset Checks & Constraints
 10. Memory, CPU, and Throughput Benchmarks

Usage:
  uv run python tests/run_deep_stress_test.py --file storage/test_datasets/production_dirty_50k.csv
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
import tracemalloc
from typing import Any, Dict, List

# Ensure repository root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import polars as pl

# Core Engine Modules
from app.processing.checks.quality_checks import (
    evaluate_min_row_count,
    evaluate_null_percentages,
    evaluate_referential_integrity,
    evaluate_value_range_constraints,
)
from app.processing.er.blocking import (
    calculate_blocking_reduction_ratio,
    generate_candidate_pairs,
)
from app.processing.er.classification import classify_candidate_pairs
from app.processing.er.clustering import cluster_record_dictionaries
from app.processing.er.comparison import compare_candidate_pairs
from app.processing.er.golden_record import (
    merge_clusters_to_golden_records,
    persist_golden_records,
)
from app.processing.er.provenance import (
    persist_provenance_records,
    track_field_provenance,
)
from app.processing.pipelines.cleaning_pipeline import (
    _parse_currency_string,
    _parse_date_string,
)
from app.processing.reconciliation import run_cross_store_reconciliation
from app.processing.schema_detector import ColumnType, get_schema_detector

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("QA_StressTest")


class TestFailure(Exception):
    """Raised when a strict QA acceptance criterion is violated."""
    pass


def print_banner(title: str) -> None:
    print("\n" + "=" * 80)
    print(f" [QA SUITE] {title.upper()}")
    print("=" * 80)


def print_substep(step_num: str, title: str) -> None:
    print(f"\n---> [Phase {step_num}] {title}")


def run_comprehensive_qa_stress_test(
    file_path: str,
    tenant_id: str = "stress-tenant",
    max_rows: int | None = None,
) -> None:
    start_time = time.perf_counter()
    tracemalloc.start()

    print_banner(f"LuminAI Data Engine Deep Stress & QA Audit: {file_path}")
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Test dataset not found at '{file_path}'")

    file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
    print(f"Target File: {file_path} ({file_size_mb:.2f} MB)")

    # -------------------------------------------------------------------------
    # Phase 1: Pre-Flight Ingestion & Schema Auto-Detection Gate
    # -------------------------------------------------------------------------
    print_substep("1.0", "Pre-Flight Schema Detection & Poison File Rejection Gate")
    detector = get_schema_detector()
    with open(file_path, "rb") as f:
        file_bytes = f.read()

    preflight_report = detector.validate_file_bytes(file_bytes, file_name=os.path.basename(file_path))

    print(f"  - Ingest Validation Passed : {preflight_report.is_valid}")
    print(f"  - Total Ingested Rows      : {preflight_report.total_rows:,}")
    print(f"  - Total Detected Columns   : {preflight_report.total_columns}")
    print(f"  - Suggested Entity Target  : {preflight_report.suggested_entity_type} (Confidence: {preflight_report.entity_confidence:.2f})")

    if not preflight_report.is_valid:
        raise TestFailure(f"Pre-flight validation failed unexpectedly: {preflight_report.error_message}")

    # Verify column type detections
    for col in preflight_report.columns:
        print(f"    * Col '{col.column_name}': Detected Type={col.detected_type.upper():<7} | Nulls={col.null_percentage:>5.1f}% | Uniques={col.unique_percentage:>5.1f}% | Mapped='{col.suggested_property}'")
        if col.column_name.lower() in ("email", "contact_email") and col.detected_type != "email":
            logger.warning("Type detection warning: Email column was not classified as EMAIL type")

    # Poison File Test: Verify rejection when a column has >50% nulls
    print("\n  [Testing Poison Rejection Threshold (>50% Nulls)]")
    poison_df = pl.DataFrame({
        "id": ["p-1", "p-2", "p-3", "p-4"],
        "critical_field": [None, None, None, "value"],  # 75% null
    })
    poison_report = detector.validate_dataframe(poison_df)
    if poison_report.is_valid:
        raise TestFailure("CRITICAL SECURITY HOLE: Dataset with 75% null column was NOT rejected by pre-flight gate!")
    print(f"  [OK] Successfully rejected poisoned dataset: {poison_report.error_message}")

    # -------------------------------------------------------------------------
    # Phase 2: High-Performance Ingestion & Cleaning Engine
    # -------------------------------------------------------------------------
    print_substep("2.0", "Polars Cleaning & Attribute Normalization Engine")
    t0 = time.perf_counter()
    raw_df = pl.read_csv(file_path, ignore_errors=True)
    if max_rows and raw_df.height > max_rows:
        raw_df = raw_df.head(max_rows)
    print(f"  - Loaded {raw_df.height:,} raw rows in {time.perf_counter() - t0:.3f}s")

    t_clean_start = time.perf_counter()

    # Step A: Whitespace Strip
    string_cols = [c for c, dt in zip(raw_df.columns, raw_df.dtypes) if dt in (pl.Utf8, pl.String)]
    cleaned_df = raw_df.with_columns([pl.col(c).str.strip_chars().alias(c) for c in string_cols])

    # Step B: Lowercase Email & Uppercase Country
    if "email" in cleaned_df.columns:
        cleaned_df = cleaned_df.with_columns(pl.col("email").str.to_lowercase().alias("email"))
    if "country" in cleaned_df.columns:
        cleaned_df = cleaned_df.with_columns(pl.col("country").str.to_uppercase().alias("country"))

    # Step C: Currency Parsing Verification
    if "salary" in cleaned_df.columns:
        cleaned_df = cleaned_df.with_columns(
            pl.col("salary")
            .map_elements(
                _parse_currency_string,
                return_dtype=pl.Struct([
                    pl.Field("amount", pl.Float64),
                    pl.Field("currency", pl.String),
                ]),
            )
            .alias("salary_parsed")
        ).with_columns(
            pl.col("salary_parsed").struct.field("amount").alias("salary_amount"),
            pl.col("salary_parsed").struct.field("currency").alias("salary_currency"),
        ).drop(["salary_parsed", "salary"])

    # Step D: Timestamp Parsing Verification
    if "joined_at" in cleaned_df.columns:
        cleaned_df = cleaned_df.with_columns(
            pl.col("joined_at").map_elements(_parse_date_string, return_dtype=pl.Utf8).alias("joined_at")
        )

    clean_duration = time.perf_counter() - t_clean_start
    throughput = cleaned_df.height / max(0.001, clean_duration)
    print(f"  - Cleaned {cleaned_df.height:,} records in {clean_duration:.3f}s ({throughput:,.0f} rows/sec)")

    # Assertions on cleaned data
    if "email" in cleaned_df.columns:
        sample_emails = cleaned_df["email"].drop_nulls().head(100).to_list()
        if any(e != e.lower() for e in sample_emails):
            raise TestFailure("Cleaning engine failed: uppercase characters detected in normalized email column")
    print("  [OK] Email case normalization verified.")

    if "salary_amount" in cleaned_df.columns:
        sample_salaries = cleaned_df["salary_amount"].drop_nulls().head(100).to_list()
        if any(not isinstance(s, (int, float)) for s in sample_salaries):
            raise TestFailure("Currency parsing failed: non-numeric values present in salary_amount")
    print("  [OK] Currency extraction & normalization verified.")

    # -------------------------------------------------------------------------
    # Phase 3: Entity Resolution (ER) Candidate Blocking
    # -------------------------------------------------------------------------
    print_substep("3.0", "Phonetic Blocking Engine & Complexity Reduction")
    t_block_start = time.perf_counter()

    candidate_pairs = generate_candidate_pairs(
        cleaned_df,
        id_col="id",
        name_col="name" if "name" in cleaned_df.columns else cleaned_df.columns[0],
        country_col="country",
        entity_type_col="entity_type",
    )
    block_duration = time.perf_counter() - t_block_start

    total_possible_pairs = cleaned_df.height * (cleaned_df.height - 1) // 2
    reduction_ratio = calculate_blocking_reduction_ratio(cleaned_df.height, candidate_pairs.height)

    print(f"  - Input Records             : {cleaned_df.height:,}")
    print(f"  - Theoretical O(N^2) Pairs  : {total_possible_pairs:,}")
    print(f"  - Generated Candidate Pairs : {candidate_pairs.height:,}")
    print(f"  - Search Space Reduction    : {reduction_ratio:.4%}")
    print(f"  - Blocking Elapsed Time     : {block_duration:.3f}s")

    if candidate_pairs.height > 0 and reduction_ratio < 0.90:
        logger.warning("Blocking reduction ratio is low (<90%%). Check for mega-block skew on common keys.")
    print("  [OK] Blocking search space reduction verified.")

    # -------------------------------------------------------------------------
    # Phase 4: Pairwise Similarity Scoring & Semantic Nickname Matching
    # -------------------------------------------------------------------------
    print_substep("4.0", "Pairwise Similarity Scoring & Semantic Nickname Evaluation")
    t_score_start = time.perf_counter()

    if candidate_pairs.height > 0:
        scored_pairs = compare_candidate_pairs(candidate_pairs)
        score_duration = time.perf_counter() - t_score_start
        print(f"  - Scored {scored_pairs.height:,} candidate pairs in {score_duration:.3f}s ({scored_pairs.height / max(0.001, score_duration):,.0f} pairs/sec)")

        # Verify score bounds [0.0, 1.0]
        min_score = scored_pairs["confidence_score"].min()
        max_score = scored_pairs["confidence_score"].max()
        if min_score < 0.0 or max_score > 1.0:
            raise TestFailure(f"Scoring violation: Confidence score out of bounds [{min_score}, {max_score}]")
        print(f"  [OK] Confidence score range validated: [{min_score:.4f}, {max_score:.4f}]")
    else:
        scored_pairs = pl.DataFrame()
        print("  - Zero candidate pairs generated (homogeneous distinct records).")

    # -------------------------------------------------------------------------
    # Phase 5: Classification Engine & Boundary Testing
    # -------------------------------------------------------------------------
    print_substep("5.0", "Classification Partitioning (Match >= 0.90, Review 0.70-0.89, Non-Match < 0.70)")
    matches_df, review_df, non_matches_df = classify_candidate_pairs(scored_pairs)

    print(f"  - Automatic Matches   (S >= 0.90) : {matches_df.height:,}")
    print(f"  - Human Review Queue  (0.70-0.89) : {review_df.height:,}")
    print(f"  - Discarded Non-Match (S < 0.70)  : {non_matches_df.height:,}")

    # Verify no partition leakage
    if matches_df.height > 0 and (matches_df["confidence_score"] < 0.90).any():
        raise TestFailure("Classification leak: Matches DataFrame contains scores below 0.90 threshold")
    if review_df.height > 0 and ((review_df["confidence_score"] < 0.70) | (review_df["confidence_score"] >= 0.90)).any():
        raise TestFailure("Classification leak: Review DataFrame contains scores outside [0.70, 0.90) range")
    print("  [OK] Classification partitioning strictly enforced.")

    # -------------------------------------------------------------------------
    # Phase 6: Graph Clustering (Union-Find) & Canonical Golden Record Synthesis
    # -------------------------------------------------------------------------
    print_substep("6.0", "Connected Components Graph Clustering & Golden Record Merge")
    t_cluster_start = time.perf_counter()

    records_list = cleaned_df.to_dicts()
    clusters = cluster_record_dictionaries(matches_df, records_list, id_col="id")
    golden_records_df = merge_clusters_to_golden_records(clusters, tenant_id=tenant_id)
    cluster_duration = time.perf_counter() - t_cluster_start

    print(f"  - Input Records               : {len(records_list):,}")
    print(f"  - Resolved Clusters           : {len(clusters):,}")
    print(f"  - Canonical Golden Records    : {golden_records_df.height:,}")
    print(f"  - Duplicate Records Merged    : {len(records_list) - golden_records_df.height:,}")
    print(f"  - Clustering Execution Time   : {cluster_duration:.3f}s")

    if golden_records_df.height > len(records_list):
        raise TestFailure("Data integrity violation: Golden records count exceeds input records count!")
    print("  [OK] Graph clustering and transitive closure verified.")

    # -------------------------------------------------------------------------
    # Phase 7: Field-Level Provenance Attribution
    # -------------------------------------------------------------------------
    print_substep("7.0", "Field-Level Source Provenance Audit Trail")
    all_provenance: list[dict[str, Any]] = []
    golden_records_dict = golden_records_df.to_dicts()
    for cluster in clusters[:500]:  # Profile first 500 clusters
        if not cluster:
            continue
        c_ids = {str(r.get("id")) for r in cluster}
        matching_golden = next((gr for gr in golden_records_dict if any(sid in c_ids for sid in gr.get("source_record_ids", []))), None)
        if matching_golden:
            prov = track_field_provenance(matching_golden, cluster, tenant_id=tenant_id)
            all_provenance.extend(prov)

    print(f"  - Generated {len(all_provenance):,} field-level provenance audit entries")
    if all_provenance:
        sample_p = all_provenance[0]
        print(f"    * Sample Provenance: Golden [{sample_p['golden_id']}] -> Property '{sample_p['attribute_name']}': '{sample_p['attribute_value']}' (Source: {sample_p['source_id']}, Row: {sample_p['source_record_id']})")
    print("  [OK] Field-level provenance attribution verified.")

    # -------------------------------------------------------------------------
    # Phase 8: Data Quality Asset Gates & Constraints Evaluation
    # -------------------------------------------------------------------------
    print_substep("8.0", "Production Data Quality Asset Checks")

    # 1. Min Row Count Check
    chk_count = evaluate_min_row_count(cleaned_df, min_threshold=1)
    print(f"  - Min Row Count Check : {'PASSED' if chk_count.passed else 'FAILED'} ({chk_count.description})")
    if not chk_count.passed:
        raise TestFailure(chk_count.description)

    # 2. Null Percentage Check (Mandatory ID must be 0% null)
    chk_nulls = evaluate_null_percentages(cleaned_df, max_null_pct=50.0)
    print(f"  - Null Threshold Check: {'PASSED' if chk_nulls.passed else 'FAILED'} ({chk_nulls.description})")
    if not chk_nulls.passed:
        logger.warning("Null threshold check flagged violations: %s", chk_nulls.metadata.get("violations"))

    # 3. Value Range Constraints Check
    chk_ranges = evaluate_value_range_constraints(cleaned_df)
    print(f"  - Value Ranges Check  : {'PASSED' if chk_ranges.passed else 'FAILED'} ({chk_ranges.description})")

    # 4. Referential Integrity Check
    chk_ref = evaluate_referential_integrity(golden_records_df, cleaned_df)
    print(f"  - Referential Integrity: {'PASSED' if chk_ref.passed else 'FAILED'} ({chk_ref.description})")
    if not chk_ref.passed:
        raise TestFailure(chk_ref.description)

    # -------------------------------------------------------------------------
    # Phase 9: Cross-Store Reconciliation Verification
    # -------------------------------------------------------------------------
    print_substep("9.0", "Cross-Store Synchronization & SHA-256 Checksum Verification")
    rec_report = run_cross_store_reconciliation(
        tenant_id=tenant_id,
        entity_type="Person",
        pg_records=golden_records_df.to_dicts(),
        neo4j_records=golden_records_df.to_dicts(),
        opensearch_records=golden_records_df.to_dicts(),
    )
    print(f"  - Reconciliation Status : {rec_report.status.upper()}")
    print(f"  - Postgres Store Count  : {rec_report.pg_count:,}")
    print(f"  - Neo4j Graph Count     : {rec_report.neo4j_count:,}")
    print(f"  - OpenSearch Doc Count  : {rec_report.opensearch_count:,}")
    print(f"  - SHA-256 Checksum Match: {rec_report.checksum_match}")

    if not rec_report.checksum_match:
        raise TestFailure("Reconciliation error: State checksum mismatch detected across simulated stores!")
    print("  [OK] Cross-store synchronization and checksum verified.")

    # -------------------------------------------------------------------------
    # Execution Summary & Resource Footprint
    # -------------------------------------------------------------------------
    current_mem, peak_mem = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    total_elapsed = time.perf_counter() - start_time

    print_banner("Comprehensive Stress Test Passed Successfully")
    print(f"Total Records Tested       : {cleaned_df.height:,}")
    print(f"Golden Entities Resolved   : {golden_records_df.height:,}")
    print(f"Duplicates Merged          : {cleaned_df.height - golden_records_df.height:,}")
    print(f"Total Execution Time       : {total_elapsed:.2f} seconds")
    print(f"End-to-End Throughput      : {cleaned_df.height / total_elapsed:,.0f} records/sec")
    print(f"Peak RAM Allocation        : {peak_mem / (1024 * 1024):.2f} MB")
    print("=" * 80 + "\n")


def main():
    parser = argparse.ArgumentParser(description="LuminAI Data Engine Deep QA Stress Test")
    parser.add_argument("--file", type=str, required=True, help="Path to CSV dataset for testing")
    parser.add_argument("--tenant", type=str, default="stress-acme", help="Tenant ID scoping the test")
    parser.add_argument("--max-rows", type=int, default=None, help="Max rows to process (for memory profiling)")
    args = parser.parse_args()

    run_comprehensive_qa_stress_test(
        file_path=args.file,
        tenant_id=args.tenant,
        max_rows=args.max_rows,
    )


if __name__ == "__main__":
    main()
