# LuminAI Python Data Engine — Independent Validation Workspace

This workspace is strictly isolated from the production `data-engine/` codebase and the existing `luminai-testing/` UI/E2E folder. Its purpose is to enable step-by-step, mathematically verified manual testing of every implemented capability in the LuminAI Python Data Engine (`data-engine/`).

---

## Core Validation Rules

1. **Zero engine assumptions**: A `200 OK` response or completed pipeline run does not prove mathematical, logical, or persistence correctness.
2. **Independent ground truth**: All expected row counts, statistics, correlations, cleaning deltas, ER match clusters, ML behavior, and corruption manifests in `reference-data/` are computed by standalone code (`dataset-generator/reference_calculator.py`) that never imports `data-engine/app/*`.
3. **Human-directed execution**: Neither the dataset generator nor the manual validation steps execute automatically. You choose which dataset tier to generate and execute one validation test at a time.
4. **No silent edits**: Any bug or discrepancy found during manual validation is logged under `test-results/bug-reports/` with reproduction steps and root-cause analysis before any code changes are proposed.

---

## Workspace Layout

```
luminai-engine-validation/
├── README.md
├── discovery/                     # Post-remediation architecture, verified feature inventory & dependencies
├── dataset-generator/             # Standalone chunked synthetic generator + independent reference calculator
├── datasets/                      # Generated messy enterprise datasets by tier (small..extreme)
├── reference-data/                # Clean truth, corruption manifests, expected behavior, independent calculations
├── test-handbook/                 # Step-by-step manual validation procedures covering all feature areas
├── test-results/                  # Execution logs, per-feature status matrix & bug reports
└── progress/                      # Stage-by-stage manual validation tracker
```

---

## Local Hardware & Tier Guidance

Measured baseline on this workstation:
- **RAM**: ~7.88 GiB physical (~922 MB free during baseline inspection)
- **Disk**: ~9.33 GB free on system drive (workspace resides under OneDrive sync)
- **CPU**: 4 logical cores

| Tier | Primary Table Rows (`N`) | Approx. Combined Rows (A–G) | Formats Emitted | Est. Disk (All Files + Ref) | Est. Peak Gen RAM | Local Recommendation |
|---|---:|---:|---|---:|---:|---|
| `small` | 10,000 | ~72,000 | CSV, TSV, CSV-cp1252, BOM+`;`, JSON, NDJSON, Parquet, XLSX | ~28 MB | ~74 MB | **Recommended first** |
| `medium` | 100,000 | ~720,000 | All formats (CSV/JSON/Parquet full; XLSX 10k sample) | ~280 MB | ~200 MB | Safe with streaming chunks |
| `large` | 500,000 | ~3,600,000 | CSV, NDJSON, Parquet (capped 10k JSON-array/XLSX samples) | ~1.19 GB | ~410 MB | Safe; watch OneDrive sync & HTTP body limits |
| `very-large` | 1,000,000 | ~6,000,000 | Streaming CSV, NDJSON, Parquet | ~2.38 GB | ~410 MB | Prefer single-domain or `--output-root` outside OneDrive |
| `extreme` | 2,000,000–5,000,000 | ~12M–30M | Streaming CSV, Parquet only | ~4.76 GB–11.9 GB | ~410 MB | **Caution**: Exceeds safe share of 9.33 GB free disk; run single-domain (`--domains D`) or external drive |

Run `--estimate-only` before generating any large tier:
```powershell
data-engine\.venv\Scripts\python.exe luminai-engine-validation\dataset-generator\generate_datasets.py --tier small --estimate-only
```

---

## Suggested Validation Sequence

1. Generate your chosen initial tier (recommended: `small`, optionally `medium`) using the command shown after reviewing estimates.
2. Follow `progress/testing-progress.md` and `test-handbook/01-ingestion.md` through `11-security-and-robustness.md` **one test at a time**.
3. Compare actual outputs against `reference-data/expected-results/<tier>/` and `reference-data/reference-calculations/<tier>/`, then log findings in `test-results/execution-log.md` and `test-results/feature-status.md`.
