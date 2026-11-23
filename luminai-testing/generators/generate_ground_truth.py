#!/usr/bin/env python3
"""
LuminAI Independent Ground-Truth Generator
=========================================
Computes deterministic ground-truth statistical profiles, quality scores,
and relationship counts for all generated synthetic datasets using Polars & DuckDB.
Does NOT invoke or rely on any LuminAI internal service or API.

Outputs:
- luminai-testing/ground-truth/manifest.json
- luminai-testing/ground-truth/profiling/*.json
"""

import os
import sys
import json
from pathlib import Path
import polars as pl
import duckdb

ROOT_DIR = Path(__file__).resolve().parent.parent
DATASETS_DIR = ROOT_DIR / "datasets"
GT_DIR = ROOT_DIR / "ground-truth"
PROFILING_DIR = GT_DIR / "profiling"

GT_DIR.mkdir(parents=True, exist_ok=True)
PROFILING_DIR.mkdir(parents=True, exist_ok=True)

def profile_dataframe(df: pl.DataFrame, dataset_name: str) -> dict:
    """Computes comprehensive ground-truth statistics for a Polars DataFrame."""
    total_rows = len(df)
    total_cols = len(df.columns)
    
    # Exact duplicate rows
    exact_duplicates = total_rows - len(df.unique())
    
    columns_profile = {}
    
    for col in df.columns:
        series = df[col]
        dtype_str = str(series.dtype)
        
        # Null count (including empty strings and sentinel nulls if string)
        null_count = series.null_count()
        empty_string_count = 0
        sentinel_null_count = 0
        
        if series.dtype == pl.Utf8 or series.dtype == pl.String:
            # Count empty or sentinel strings
            empty_string_count = int((series.str.strip_chars() == "").sum() or 0)
            sentinel_null_count = int(series.is_in(["N/A", "null", "NULL", "UNKNOWN", "None"]).sum() or 0)
            
        effective_missing = null_count + empty_string_count + sentinel_null_count
        missing_pct = round((effective_missing / total_rows) * 100, 2) if total_rows > 0 else 0.0
        
        distinct_count = series.n_unique()
        
        col_stats = {
            "name": col,
            "data_type": dtype_str,
            "null_count": null_count,
            "empty_string_count": empty_string_count,
            "sentinel_null_count": sentinel_null_count,
            "total_effective_missing": effective_missing,
            "missing_percentage": missing_pct,
            "distinct_count": distinct_count,
        }
        
        # Numeric statistics
        if series.dtype in [pl.Int8, pl.Int16, pl.Int32, pl.Int64, pl.UInt8, pl.UInt16, pl.UInt32, pl.UInt64, pl.Float32, pl.Float64]:
            non_null = series.drop_nulls()
            if len(non_null) > 0:
                q1 = float(non_null.quantile(0.25))
                q2 = float(non_null.quantile(0.50)) # median
                q3 = float(non_null.quantile(0.75))
                iqr = q3 - q1
                lower_bound = q1 - 1.5 * iqr
                upper_bound = q3 + 1.5 * iqr
                
                outliers = int(((non_null < lower_bound) | (non_null > upper_bound)).sum() or 0)
                
                col_stats["numeric_metrics"] = {
                    "min": float(non_null.min()),
                    "max": float(non_null.max()),
                    "mean": round(float(non_null.mean()), 4),
                    "median": round(q2, 4),
                    "std": round(float(non_null.std()), 4) if len(non_null) > 1 else 0.0,
                    "q1": round(q1, 4),
                    "q3": round(q3, 4),
                    "iqr": round(iqr, 4),
                    "outlier_count_iqr": outliers
                }
        
        columns_profile[col] = col_stats
        
    return {
        "dataset_name": dataset_name,
        "row_count": total_rows,
        "column_count": total_cols,
        "exact_duplicates": exact_duplicates,
        "columns": columns_profile
    }

def main():
    print("=== LuminAI Independent Ground-Truth Generator ===")
    
    manifest = {
        "generator_version": "1.0.0",
        "generated_by": "Independent Polars/DuckDB Analyzer",
        "description": "Ground-truth baseline metrics for LuminAI synthetic datasets",
        "datasets": {}
    }
    
    # 1. Profile Small Datasets
    small_files = [
        ("customers_small.csv", DATASETS_DIR / "small" / "customers_small.csv", ","),
        ("transactions_small.csv", DATASETS_DIR / "small" / "transactions_small.csv", ","),
        ("orders_small.tsv", DATASETS_DIR / "small" / "orders_small.tsv", "\t"),
    ]
    
    for name, path, sep in small_files:
        if path.exists():
            print(f"[*] Analyzing {name}...")
            df = pl.read_csv(path, separator=sep, ignore_errors=True)
            profile = profile_dataframe(df, name)
            manifest["datasets"][name] = {
                "relative_path": f"datasets/small/{name}",
                "file_size_bytes": path.stat().st_size,
                "row_count": profile["row_count"],
                "column_count": profile["column_count"],
                "exact_duplicates": profile["exact_duplicates"],
                "profile_file": f"ground-truth/profiling/{name}.json"
            }
            with open(PROFILING_DIR / f"{name}.json", "w", encoding="utf-8") as f:
                json.dump(profile, f, indent=2)
                
    # 2. Products Small JSON
    prods_json = DATASETS_DIR / "small" / "products_small.json"
    if prods_json.exists():
        print("[*] Analyzing products_small.json...")
        df = pl.read_json(prods_json)
        profile = profile_dataframe(df, "products_small.json")
        manifest["datasets"]["products_small.json"] = {
            "relative_path": "datasets/small/products_small.json",
            "file_size_bytes": prods_json.stat().st_size,
            "row_count": profile["row_count"],
            "column_count": profile["column_count"],
            "exact_duplicates": profile["exact_duplicates"],
            "profile_file": "ground-truth/profiling/products_small.json.json"
        }
        with open(PROFILING_DIR / "products_small.json.json", "w", encoding="utf-8") as f:
            json.dump(profile, f, indent=2)

    # 3. Inventory Small JSONL
    inv_jsonl = DATASETS_DIR / "small" / "inventory_small.jsonl"
    if inv_jsonl.exists():
        print("[*] Analyzing inventory_small.jsonl...")
        df = pl.read_ndjson(inv_jsonl)
        profile = profile_dataframe(df, "inventory_small.jsonl")
        manifest["datasets"]["inventory_small.jsonl"] = {
            "relative_path": "datasets/small/inventory_small.jsonl",
            "file_size_bytes": inv_jsonl.stat().st_size,
            "row_count": profile["row_count"],
            "column_count": profile["column_count"],
            "exact_duplicates": profile["exact_duplicates"],
            "profile_file": "ground-truth/profiling/inventory_small.jsonl.json"
        }
        with open(PROFILING_DIR / "inventory_small.jsonl.json", "w", encoding="utf-8") as f:
            json.dump(profile, f, indent=2)

    # 4. Profile Medium Datasets
    cust_med = DATASETS_DIR / "medium" / "customers_medium.csv"
    if cust_med.exists():
        print("[*] Analyzing customers_medium.csv...")
        df = pl.read_csv(cust_med, ignore_errors=True)
        profile = profile_dataframe(df, "customers_medium.csv")
        manifest["datasets"]["customers_medium.csv"] = {
            "relative_path": "datasets/medium/customers_medium.csv",
            "file_size_bytes": cust_med.stat().st_size,
            "row_count": profile["row_count"],
            "column_count": profile["column_count"],
            "exact_duplicates": profile["exact_duplicates"],
            "profile_file": "ground-truth/profiling/customers_medium.csv.json"
        }
        with open(PROFILING_DIR / "customers_medium.csv.json", "w", encoding="utf-8") as f:
            json.dump(profile, f, indent=2)

    txn_med = DATASETS_DIR / "medium" / "transactions_medium.parquet"
    if txn_med.exists():
        print("[*] Analyzing transactions_medium.parquet...")
        df = pl.read_parquet(txn_med)
        profile = profile_dataframe(df, "transactions_medium.parquet")
        manifest["datasets"]["transactions_medium.parquet"] = {
            "relative_path": "datasets/medium/transactions_medium.parquet",
            "file_size_bytes": txn_med.stat().st_size,
            "row_count": profile["row_count"],
            "column_count": profile["column_count"],
            "exact_duplicates": profile["exact_duplicates"],
            "profile_file": "ground-truth/profiling/transactions_medium.parquet.json"
        }
        with open(PROFILING_DIR / "transactions_medium.parquet.json", "w", encoding="utf-8") as f:
            json.dump(profile, f, indent=2)

    orders_med = DATASETS_DIR / "medium" / "orders_medium.csv"
    if orders_med.exists():
        print("[*] Analyzing orders_medium.csv...")
        df = pl.read_csv(orders_med, ignore_errors=True)
        profile = profile_dataframe(df, "orders_medium.csv")
        manifest["datasets"]["orders_medium.csv"] = {
            "relative_path": "datasets/medium/orders_medium.csv",
            "file_size_bytes": orders_med.stat().st_size,
            "row_count": profile["row_count"],
            "column_count": profile["column_count"],
            "exact_duplicates": profile["exact_duplicates"],
            "profile_file": "ground-truth/profiling/orders_medium.csv.json"
        }
        with open(PROFILING_DIR / "orders_medium.csv.json", "w", encoding="utf-8") as f:
            json.dump(profile, f, indent=2)

    # 5. Profile Edge Case Datasets
    edge_files = [
        ("identifiers_leading_zeros.csv", DATASETS_DIR / "edge-cases" / "identifiers_leading_zeros.csv"),
        ("extreme_values_outliers.csv", DATASETS_DIR / "edge-cases" / "extreme_values_outliers.csv"),
        ("quoted_newlines_unicode.csv", DATASETS_DIR / "edge-cases" / "quoted_newlines_unicode.csv"),
        ("fuzzy_duplicates_er.csv", DATASETS_DIR / "edge-cases" / "fuzzy_duplicates_er.csv"),
        ("schema_evolution_v1.csv", DATASETS_DIR / "edge-cases" / "schema_evolution_v1.csv"),
        ("schema_evolution_v2.csv", DATASETS_DIR / "edge-cases" / "schema_evolution_v2.csv"),
        ("schema_evolution_v3.csv", DATASETS_DIR / "edge-cases" / "schema_evolution_v3.csv"),
    ]
    for name, path in edge_files:
        if path.exists():
            print(f"[*] Analyzing edge case {name}...")
            # For leading zeros, ensure we read as strings so we verify leading zeros
            df = pl.read_csv(path, infer_schema_length=0)
            profile = profile_dataframe(df, name)
            manifest["datasets"][name] = {
                "relative_path": f"datasets/edge-cases/{name}",
                "file_size_bytes": path.stat().st_size,
                "row_count": profile["row_count"],
                "column_count": profile["column_count"],
                "exact_duplicates": profile["exact_duplicates"],
                "profile_file": f"ground-truth/profiling/{name}.json"
            }
            with open(PROFILING_DIR / f"{name}.json", "w", encoding="utf-8") as f:
                json.dump(profile, f, indent=2)

    # 6. Relational Integrity Analysis (DuckDB)
    print("\n[*] Computing Cross-Dataset Relational Ground-Truth via DuckDB...")
    con = duckdb.connect()
    
    # Register small tables
    con.execute(f"CREATE TABLE customers AS SELECT * FROM read_csv_auto('{DATASETS_DIR}/small/customers_small.csv', ignore_errors=true)")
    con.execute(f"CREATE TABLE transactions AS SELECT * FROM read_csv_auto('{DATASETS_DIR}/small/transactions_small.csv', ignore_errors=true)")
    con.execute(f"CREATE TABLE orders AS SELECT * FROM read_csv_auto('{DATASETS_DIR}/small/orders_small.tsv', delim='\t', ignore_errors=true)")
    
    total_cust = con.execute("SELECT count(DISTINCT customer_id) FROM customers").fetchone()[0]
    total_txns = con.execute("SELECT count(*) FROM transactions").fetchone()[0]
    orphan_txns = con.execute("SELECT count(*) FROM transactions WHERE customer_id NOT IN (SELECT customer_id FROM customers)").fetchone()[0]
    
    total_orders = con.execute("SELECT count(*) FROM orders").fetchone()[0]
    matched_orders = con.execute("SELECT count(*) FROM orders WHERE customer_id IN (SELECT customer_id FROM customers)").fetchone()[0]
    
    manifest["relational_ground_truth"] = {
        "customers_small_distinct_ids": total_cust,
        "transactions_small_total": total_txns,
        "transactions_small_orphan_customers": orphan_txns,
        "orders_small_total": total_orders,
        "orders_small_matched_customers": matched_orders
    }
    
    # Save master manifest
    manifest_path = GT_DIR / "manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
        
    print(f"\n[+] Master Ground-Truth Manifest saved to: {manifest_path}")

if __name__ == "__main__":
    main()
