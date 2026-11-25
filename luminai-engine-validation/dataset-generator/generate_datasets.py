r"""
Configurable Multi-Tier Enterprise Dataset & Ground-Truth Generator for LuminAI Data Engine.

Strictly standalone — never imports any module from `data-engine/app/`.
Do NOT invoke automatically; always inspect `--estimate-only` first on larger tiers.

Usage examples:
  data-engine\.venv\Scripts\python.exe luminai-engine-validation\dataset-generator\generate_datasets.py --tier small --estimate-only
  data-engine\.venv\Scripts\python.exe luminai-engine-validation\dataset-generator\generate_datasets.py --tier small
  data-engine\.venv\Scripts\python.exe luminai-engine-validation\dataset-generator\generate_datasets.py --tier medium --chunk-size 50000
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
import time
from pathlib import Path
from typing import Any, Dict, List

# Allow direct CLI execution without requiring package install
sys.path.insert(0, str(Path(__file__).resolve().parent))

from domains_a_to_d import generate_domain_a, generate_domain_b, generate_domain_c, generate_domain_d  # noqa: E402
from domains_e_to_s import generate_domain_e, generate_domain_f, generate_domain_g, generate_domain_s  # noqa: E402

TIER_BASE_ROWS: Dict[str, int] = {
    "small": 10_000,
    "medium": 100_000,
    "large": 500_000,
    "very-large": 1_000_000,
    "extreme": 2_000_000,
}

# Approximate combined disk (MB) & peak generator RAM (MB) per 10k base rows across all formats & ref
ESTIMATED_MB_PER_10K_BASE: float = 28.0


def estimate_footprint(tier: str, n_rows: int, selected_domains: List[str]) -> Dict[str, Any]:
    scale = n_rows / 10_000.0
    domain_factor = len(selected_domains) / 8.0
    # Extreme skips CSV duplicates where appropriate, roughly 0.9x linear scale above 500k
    efficiency = 0.85 if n_rows >= 500_000 else 1.0
    est_disk_mb = round(ESTIMATED_MB_PER_10K_BASE * scale * domain_factor * efficiency, 1)
    est_peak_ram_mb = min(480.0, round(60.0 + min(n_rows, 250_000) * 0.0014, 1))
    est_combined_rows = int(n_rows * (7.2 if n_rows <= 500_000 else 6.0) * domain_factor)

    free_gb = None
    try:
        usage = shutil.disk_usage(Path(__file__).resolve().parent)
        free_gb = round(usage.free / (1024**3), 2)
    except OSError:
        pass

    return {
        "tier": tier,
        "base_rows_per_domain": n_rows,
        "selected_domains": selected_domains,
        "approx_combined_rows_all_files": est_combined_rows,
        "estimated_disk_mb": est_disk_mb,
        "estimated_disk_gb": round(est_disk_mb / 1024.0, 2),
        "estimated_peak_generator_ram_mb": est_peak_ram_mb,
        "local_free_disk_gb": free_gb,
        "warning": (
            "CRITICAL: Estimated disk usage approaches or exceeds local free space! Use --domains D or --output-root on an external drive."
            if (free_gb is not None and (est_disk_mb / 1024.0) > (free_gb * 0.65))
            else None
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="LuminAI Validation Dataset & Reference Ground-Truth Generator")
    parser.add_argument("--tier", choices=list(TIER_BASE_ROWS.keys()), default="small")
    parser.add_argument(
        "--extreme-rows",
        type=int,
        default=2_000_000,
        help="Row count when --tier extreme is selected (2,000,000 to 5,000,000).",
    )
    parser.add_argument(
        "--domains",
        default="all",
        help="Comma-separated domain letters from A,B,C,D,E,F,G,S or 'all'.",
    )
    parser.add_argument("--chunk-size", type=int, default=50_000, help="Streaming write batch size.")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--output-root",
        type=Path,
        default=Path(__file__).resolve().parent.parent,
        help="Validation workspace root containing datasets/ and reference-data/.",
    )
    parser.add_argument("--estimate-only", action="store_true", help="Print disk/RAM estimates and exit without writing.")
    args = parser.parse_args()

    n_rows = TIER_BASE_ROWS[args.tier]
    if args.tier == "extreme":
        n_rows = max(2_000_000, min(5_000_000, args.extreme_rows))

    all_domains = ["A", "B", "C", "D", "E", "F", "G", "S"]
    if args.domains.strip().lower() == "all":
        selected = all_domains
    else:
        selected = [d.strip().upper() for d in args.domains.split(",") if d.strip()]
        invalid = [d for d in selected if d not in all_domains]
        if invalid:
            print(f"Invalid domains: {invalid}. Valid options: {all_domains}", file=sys.stderr)
            return 2

    est = estimate_footprint(args.tier, n_rows, selected)
    print(json.dumps({"footprint_estimate": est}, indent=2))
    if args.estimate_only:
        return 0

    datasets_dir = args.output_root / "datasets"
    ref_dir = args.output_root / "reference-data"
    for sub in ("clean-data", "corruption-manifests", "expected-results", "reference-calculations"):
        (ref_dir / sub / args.tier).mkdir(parents=True, exist_ok=True)
    (datasets_dir / args.tier).mkdir(parents=True, exist_ok=True)

    full_json_cap = None if n_rows <= 10_000 else 10_000
    xlsx_cap = 10_000

    t0 = time.perf_counter()
    results: Dict[str, Any] = {}

    if "A" in selected:
        results["A"] = generate_domain_a(args.tier, n_rows, args.seed, args.chunk_size, datasets_dir, ref_dir, full_json_cap, xlsx_cap)
    if "B" in selected:
        results["B"] = generate_domain_b(args.tier, n_rows, args.seed, args.chunk_size, datasets_dir, ref_dir, full_json_cap)
    if "C" in selected:
        results["C"] = generate_domain_c(args.tier, n_rows, args.seed, args.chunk_size, datasets_dir, ref_dir)
    if "D" in selected:
        results["D"] = generate_domain_d(args.tier, n_rows, args.seed, args.chunk_size, datasets_dir, ref_dir)
    if "E" in selected:
        results["E"] = generate_domain_e(args.tier, n_rows, args.seed, args.chunk_size, datasets_dir, ref_dir)
    if "F" in selected:
        results["F"] = generate_domain_f(args.tier, n_rows, args.seed, args.chunk_size, datasets_dir)
    if "G" in selected:
        results["G"] = generate_domain_g(args.tier, n_rows, args.seed, args.chunk_size, datasets_dir)
    if "S" in selected:
        results["S"] = generate_domain_s(args.tier, datasets_dir)

    summary_expected: Dict[str, Any] = {
        "tier": args.tier,
        "seed": args.seed,
        "base_rows_per_domain": n_rows,
        "generation_seconds": round(time.perf_counter() - t0, 2),
        "domains": {},
    }

    for dom, payload in results.items():
        if "manifest" in payload:
            (ref_dir / "corruption-manifests" / args.tier / f"manifest_domain_{dom.lower()}.json").write_text(
                json.dumps(payload["manifest"], indent=2), encoding="utf-8"
            )
        if "reference_stats" in payload:
            (ref_dir / "reference-calculations" / args.tier / f"stats_domain_{dom.lower()}.json").write_text(
                json.dumps(payload["reference_stats"], indent=2), encoding="utf-8"
            )
        if "expected" in payload:
            (ref_dir / "expected-results" / args.tier / f"expected_domain_{dom.lower()}.json").write_text(
                json.dumps(payload["expected"], indent=2), encoding="utf-8"
            )
            summary_expected["domains"][dom] = payload["expected"]

    (ref_dir / "expected-results" / args.tier / "master_summary.json").write_text(
        json.dumps(summary_expected, indent=2), encoding="utf-8"
    )
    print(f"Completed tier '{args.tier}' ({selected}) in {summary_expected['generation_seconds']}s -> {datasets_dir / args.tier}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
