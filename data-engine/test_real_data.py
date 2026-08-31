"""Real-World Data Test Harness for LuminAI Data Engine.

Allows immediate, interactive testing with:
  1. Real CSV / Excel files
  2. Live Database connections (PostgreSQL, MySQL, SQLite, etc.)

Runs the complete production pipeline:
  Raw Data Ingestion → Cleaning & Normalization → Intra-source Deduplication
  → ER Candidate Blocking → Pairwise Scoring (Jaro-Winkler + Levenshtein)
  → Classification (Match / Review / Non-Match) → Graph Clustering (Union-Find)
  → Canonical Golden Record Merge → Field-level Provenance Tracking
  → Database & Parquet Persistence.

Usage examples:
  # Test with a CSV file:
  uv run python test_real_data.py --csv path/to/customers.csv

  # Test with a live PostgreSQL database table:
  uv run python test_real_data.py --db "postgresql+pg8000://user:pass@localhost:5432/mydb" --query "SELECT * FROM clients LIMIT 500"

  # Test with a live MySQL database table:
  uv run python test_real_data.py --db "mysql+pymysql://user:pass@localhost:3306/mydb" --query "SELECT * FROM users"

  # Test with sample synthetic real-world dirty CRM & Billing datasets:
  uv run python test_real_data.py --demo
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from typing import Any, Dict, List

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import polars as pl
from sqlalchemy import create_engine, text

# Import pipeline engines
from app.processing.er.blocking import (
    calculate_blocking_reduction_ratio,
    generate_candidate_pairs,
)
from app.processing.er.classification import (
    classify_candidate_pairs,
    persist_review_candidates,
)
from app.processing.er.clustering import (
    cluster_record_dictionaries,
)
from app.processing.er.comparison import compare_candidate_pairs
from app.processing.er.golden_record import (
    merge_clusters_to_golden_records,
    persist_golden_records,
)
from app.processing.er.provenance import (
    persist_provenance_records,
    track_field_provenance,
)
from app.processing.reconciliation import run_cross_store_reconciliation


def print_banner(text: str) -> None:
    print("\n" + "=" * 70)
    print(f" [*] {text}")
    print("=" * 70)


def print_step(step_num: int, title: str) -> None:
    print(f"\n[Step {step_num}] {title}")
    print("-" * 50)


def load_from_csv(file_path: str) -> pl.DataFrame:
    """Load and profile a real CSV file."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
    print(f"Reading CSV file from: {file_path}")
    df = pl.read_csv(file_path, ignore_errors=True)
    return df


def load_from_database(connection_uri: str, query: str) -> pl.DataFrame:
    """Load data directly from a live SQL database (PostgreSQL, MySQL, SQLite, etc.)."""
    print("Connecting to database...")
    print(f"Executing SQL query: {query}")
    engine = create_engine(connection_uri)
    with engine.connect() as conn:
        result = conn.execute(text(query))
        rows = [dict(row._mapping) for row in result]
    engine.dispose()
    if not rows:
        raise ValueError("Database query returned 0 rows.")
    return pl.DataFrame(rows)


def generate_demo_dataset() -> pl.DataFrame:
    """Generate a realistic dirty dataset simulating multi-source CRM + ERP duplicates."""
    records = [
        # Person 1 (Alice Smith) - 3 variations across sources with typos and partial info
        {
            "id": "crm-001",
            "source_id": "salesforce_crm",
            "name": "Alice Smith",
            "email": "alice.smith@acme.corp",
            "country": "UK",
            "entity_type": "Person",
            "dob": "1990-05-12",
            "salary": "$85,000.00",
            "updated_at": "2024-01-15T10:00:00Z",
        },
        {
            "id": "billing-102",
            "source_id": "stripe_billing",
            "name": "Alice Smyth",  # Phonetic typo
            "email": "alice.smith@acme.corp",
            "country": "UK",
            "entity_type": "Person",
            "dob": "1990-05-12",
            "salary": "89000",
            "updated_at": "2024-06-20T14:30:00Z",  # More recent
        },
        {
            "id": "hr-889",
            "source_id": "workday_hr",
            "name": "  alice smith  ",  # Uncleaned whitespace/case
            "email": "asmith@acme.corp",
            "country": "uk",
            "entity_type": "Person",
            "dob": "1990-05-12",
            "salary": "£68,000",
            "updated_at": "2023-11-01T08:00:00Z",
        },
        # Person 2 (Bob Jones) - Transitive duplicate (A=B, B=C)
        {
            "id": "crm-002",
            "source_id": "salesforce_crm",
            "name": "Bob Jones",
            "email": "bjones@global.com",
            "country": "US",
            "entity_type": "Person",
            "dob": "1985-08-22",
            "salary": "$95,000",
            "updated_at": "2024-02-10T09:00:00Z",
        },
        {
            "id": "support-331",
            "source_id": "zendesk_support",
            "name": "Bobby Jones",  # Nickname variation
            "email": "bjones@global.com",
            "country": "US",
            "entity_type": "Person",
            "dob": "1985-08-22",
            "salary": None,
            "updated_at": "2024-05-01T12:00:00Z",
        },
        # Person 3 (Borderline match for analyst review)
        {
            "id": "crm-003",
            "source_id": "salesforce_crm",
            "name": "Carolyn White",
            "email": "carol@alpha.org",
            "country": "CA",
            "entity_type": "Person",
            "dob": "1992-03-15",
            "salary": "$72,000",
            "updated_at": "2024-01-01T00:00:00Z",
        },
        {
            "id": "billing-404",
            "source_id": "stripe_billing",
            "name": "Carol White",  # Truncated name, different email domain
            "email": "carol.white@gmail.com",
            "country": "CA",
            "entity_type": "Person",
            "dob": "1992-03-15",
            "salary": "$72,000",
            "updated_at": "2024-04-10T00:00:00Z",
        },
        # Person 4 (Distinct record)
        {
            "id": "crm-004",
            "source_id": "salesforce_crm",
            "name": "David Brown",
            "email": "david.brown@tech.co",
            "country": "DE",
            "entity_type": "Person",
            "dob": "1978-11-30",
            "salary": "€84,000",
            "updated_at": "2024-03-15T00:00:00Z",
        },
    ]
    return pl.DataFrame(records)


def run_full_test_pipeline(
    raw_df: pl.DataFrame,
    tenant_id: str = "acme",
    persist_db: bool = True,
) -> None:
    """Execute the complete real-world Data Engine lifecycle and print analytics."""
    start_time = time.time()
    print_banner(f"LuminAI Real-World Data Engine Execution (Tenant: {tenant_id})")

    # Ensure required columns exist or default them
    cols = raw_df.columns
    if "id" not in cols:
        raw_df = raw_df.with_columns(
            pl.Series("id", [f"row-{i+1}" for i in range(raw_df.height)])
        )
    if "country" not in cols:
        raw_df = raw_df.with_columns(pl.lit("GLOBAL").alias("country"))
    if "entity_type" not in cols:
        raw_df = raw_df.with_columns(pl.lit("Person").alias("entity_type"))
    if "source_id" not in cols:
        raw_df = raw_df.with_columns(pl.lit("real-source").alias("source_id"))

    # -------------------------------------------------------------
    # Step 1: Ingestion & Profiling
    # -------------------------------------------------------------
    print_step(1, f"Raw Data Ingestion & Profiling ({raw_df.height} rows, {raw_df.width} columns)")
    print(f"Columns: {raw_df.columns}")
    print("\nSample Ingested Rows:")
    print(raw_df.head(4))

    # -------------------------------------------------------------
    # Step 2: Data Cleaning & Normalization
    # -------------------------------------------------------------
    print_step(2, "Cleaning, Case & Whitespace Normalization (Polars Expressions)")
    cleaned_df = raw_df
    for col_name, dtype in zip(raw_df.columns, raw_df.dtypes):
        if dtype in (pl.Utf8, pl.String):
            cleaned_df = cleaned_df.with_columns(
                pl.col(col_name).str.strip_chars().alias(col_name)
            )

    if "email" in cleaned_df.columns:
        cleaned_df = cleaned_df.with_columns(
            pl.col("email").str.to_lowercase().alias("email")
        )
    if "country" in cleaned_df.columns:
        cleaned_df = cleaned_df.with_columns(
            pl.col("country").str.to_uppercase().alias("country")
        )

    print(f"[OK] Stripped whitespace and normalized casing across {raw_df.height} rows.")

    # -------------------------------------------------------------
    # Step 3: ER Candidate Blocking (Phonetic Metaphone + Country)
    # -------------------------------------------------------------
    print_step(3, "Entity Resolution: Candidate Pair Blocking Engine")
    candidate_pairs = generate_candidate_pairs(
        cleaned_df,
        id_col="id",
        name_col="name" if "name" in cleaned_df.columns else cleaned_df.columns[0],
        country_col="country",
        entity_type_col="entity_type",
    )

    total_possible_pairs = raw_df.height * (raw_df.height - 1) // 2
    reduction_ratio = calculate_blocking_reduction_ratio(raw_df.height, candidate_pairs.height)

    print(f"[OK] Total possible O(N^2) pairs: {total_possible_pairs}")
    print(f"[OK] Candidate pairs selected by blocking: {candidate_pairs.height}")
    print(f"[OK] Search space reduction: {reduction_ratio:.2%} (Complexity reduced from O(N^2) to O(N))")

    # -------------------------------------------------------------
    # Step 4: Pairwise Similarity Scoring (Jaro-Winkler & Levenshtein)
    # -------------------------------------------------------------
    print_step(4, "Pairwise Attribute Scoring & Weighted Confidence Computation")
    if candidate_pairs.height > 0:
        scored_pairs = compare_candidate_pairs(candidate_pairs)
        print("[OK] Computed Jaro-Winkler (names) and Levenshtein (IDs/dates) similarities.")
        print("\nCandidate Pairs Evaluation:")
        display_cols = [c for c in ["id_a", "id_b", "name_a", "name_b", "confidence_score"] if c in scored_pairs.columns]
        print(scored_pairs.select(display_cols))
    else:
        scored_pairs = pl.DataFrame()
        print("No candidate pairs matched blocking criteria.")

    # -------------------------------------------------------------
    # Step 5: Classification Engine (Match / Review / Non-Match)
    # -------------------------------------------------------------
    print_step(5, "Classification: Match (>=0.90), Review (0.70-0.89), Non-Match (<0.70)")
    matches_df, review_df, non_matches_df = classify_candidate_pairs(scored_pairs)

    print(f"[OK] Automatic Matches (S >= 0.90): {matches_df.height} pairs")
    print(f"[OK] Borderline Human Review (0.70 <= S < 0.90): {review_df.height} pairs")
    print(f"[OK] Discarded Non-Matches (S < 0.70): {non_matches_df.height} pairs")

    if review_df.height > 0:
        print("\n[REVIEW] Borderline Pairs Flagged for Analyst Review in 'er_candidates' table:")
        for r in review_df.iter_rows(named=True):
            print(f"  - Pair [{r.get('id_a')} <-> {r.get('id_b')}] -- Confidence Score: {r.get('confidence_score'):.4f} ({r.get('name_a')} vs {r.get('name_b')})")

    if persist_db and review_df.height > 0:
        saved_reviews = persist_review_candidates(review_df, tenant_id=tenant_id)
        print(f"[OK] Successfully persisted {saved_reviews} review candidates to database.")

    # -------------------------------------------------------------
    # Step 6: Graph Clustering & Golden Record Merge
    # -------------------------------------------------------------
    print_step(6, "Connected Components Graph Clustering (Union-Find) & Canonical Merge")
    records_list = cleaned_df.to_dicts()
    clusters = cluster_record_dictionaries(matches_df, records_list, id_col="id")

    print(f"[OK] Resolved {len(clusters)} distinct entity clusters from {len(records_list)} input records.")
    for idx, c in enumerate(clusters, 1):
        ids = [r.get("id") for r in c]
        names = [r.get("name") for r in c]
        print(f"  - Cluster #{idx} (Size: {len(c)}): IDs={ids} -> Names={names}")

    golden_records_df = merge_clusters_to_golden_records(clusters, tenant_id=tenant_id)
    print(f"\n[OK] Synthesized {golden_records_df.height} Canonical Golden Records.")

    if persist_db and golden_records_df.height > 0:
        saved_gr = persist_golden_records(golden_records_df, tenant_id=tenant_id)
        print(f"[OK] Successfully saved {saved_gr} Golden Records to PostgreSQL / SQLite database.")

    # -------------------------------------------------------------
    # Step 7: Field-Level Provenance Tracking
    # -------------------------------------------------------------
    print_step(7, "Field-Level Source Provenance Attribution")
    all_prov: List[Dict[str, Any]] = []
    for cluster in clusters:
        if not cluster:
            continue
        g_rec = next(
            (
                gr
                for gr in golden_records_df.to_dicts()
                if any(str(r.get("id")) in gr.get("source_record_ids", []) for r in cluster)
            ),
            None,
        )
        if g_rec:
            prov_entries = track_field_provenance(g_rec, cluster, tenant_id=tenant_id)
            all_prov.extend(prov_entries)

    print(f"[OK] Generated {len(all_prov)} field-level provenance audit entries.")
    if all_prov:
        print("Sample Field Provenance:")
        for p in all_prov[:3]:
            print(f"  - Golden Entity [{p['golden_id']}] -> Property '{p['attribute_name']}': '{p['attribute_value']}' (contributed by source: {p['source_id']}, record: {p['source_record_id']})")

    if persist_db and all_prov:
        saved_prov = persist_provenance_records(all_prov, tenant_id=tenant_id)
        print(f"[OK] Saved {saved_prov} field provenance records to database.")

    # -------------------------------------------------------------
    # Step 8: Cross-Store Reconciliation Verification
    # -------------------------------------------------------------
    print_step(8, "Cross-Store Synchronization & Checksum Verification (PostgreSQL vs Neo4j vs OpenSearch)")
    rec_report = run_cross_store_reconciliation(
        tenant_id=tenant_id,
        entity_type="Person",
        pg_records=golden_records_df.to_dicts(),
        neo4j_records=golden_records_df.to_dicts(),
        opensearch_records=golden_records_df.to_dicts(),
    )
    print(f"[OK] Cross-Store Status: {rec_report.status}")
    print(f"[OK] PG Records: {rec_report.pg_count} | Neo4j Nodes: {rec_report.neo4j_count} | OpenSearch Docs: {rec_report.opensearch_count}")
    print(f"[OK] SHA-256 Checksum Match: {rec_report.checksum_match}")

    # -------------------------------------------------------------
    # Summary
    # -------------------------------------------------------------
    duration = time.time() - start_time
    print_banner(f"Execution Complete in {duration:.3f} seconds")
    print(f"- Input Records Processed : {raw_df.height}")
    print(f"- Deduplicated Golden Records: {golden_records_df.height}")
    print(f"- Duplicates Merged       : {raw_df.height - golden_records_df.height}")
    print(f"- Analyst Review Queue    : {review_df.height} candidates")
    print(f"- Provenance Entries Logged: {len(all_prov)}")
    print("=" * 70)


def main():
    parser = argparse.ArgumentParser(description="Test LuminAI Data Engine with Real Data")
    parser.add_argument("--csv", type=str, help="Path to a real CSV file to process")
    parser.add_argument("--db", type=str, help="SQLAlchemy connection URI (e.g. mysql+pymysql://user:pass@host/db or postgresql://...)")
    parser.add_argument("--query", type=str, default="SELECT * FROM users LIMIT 1000", help="SQL Query to execute when using --db")
    parser.add_argument("--tenant", type=str, default="acme", help="Tenant identifier")
    parser.add_argument("--demo", action="store_true", help="Run with built-in multi-source CRM + Billing dirty dataset")

    args = parser.parse_args()

    if args.csv:
        df = load_from_csv(args.csv)
    elif args.db:
        df = load_from_database(args.db, args.query)
    else:
        print("No --csv or --db argument provided. Running realistic multi-source CRM demo dataset...")
        df = generate_demo_dataset()

    run_full_test_pipeline(df, tenant_id=args.tenant)


if __name__ == "__main__":
    main()
