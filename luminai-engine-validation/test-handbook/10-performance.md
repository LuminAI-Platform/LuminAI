# Manual Test Handbook — 10: Progressive Performance & Scalability Benchmarks

Run **only after functional correctness tests pass**, starting with `small` (`10k`) before advancing to `medium` (`100k`), `large` (`500k`), and opt-in `very-large` (`1M`) / `extreme` (`2M–5M`).

---

## Hardware & Safety Baseline

Record local environment alongside every timing run:
- Physical RAM: ~7.88 GiB (free RAM often ~900 MB–1.5 GB — avoid stacking concurrent Python benchmarks or Docker containers simultaneously).
- Free Disk: ~12.88 GB.
- Logical CPU Cores: 4.
- **Warning**: HTTP endpoints accepting JSON `records` arrays hit Pydantic memory + 30s analytics timeout above ~50k–100k rows. Benchmark **file/Polars/DuckDB Python entrypoints** directly for `large` (`500k+`) tiers!

---

## Benchmark Matrix Protocol

### Benchmark P1: File Parsing & Preflight Schema Validation Scaling
Measure throughput (`rows/sec`), duration, and peak RSS (`psutil` / `tracemalloc`) across tiers (`domain_a_customers.csv` vs `domain_a_customers.parquet`):
```powershell
cd data-engine
.\.venv\Scripts\python.exe -c "
import os, time, psutil, polars as pl
from pathlib import Path
from app.processing.schema_detector.detector import SchemaDetector

proc = psutil.Process(os.getpid())
det = SchemaDetector()
for tier in ['small']:  # add 'medium', 'large' as generated
    for fn in ['domain_a_customers.csv', 'domain_a_customers.parquet']:
        p = Path(f'../luminai-engine-validation/datasets/{tier}/{fn}')
        if not p.exists():
            continue
        rss_before = proc.memory_info().rss / (1024**2)
        t0 = time.perf_counter()
        rep = det.validate_file_bytes(p.read_bytes(), fn, reject_on_violation=False)
        dt = time.perf_counter() - t0
        rss_after = proc.memory_info().rss / (1024**2)
        print(f'{tier}/{fn}: rows={rep.total_rows} time={dt:.2f}s rate={rep.total_rows/dt:,.0f} rows/s rss_delta={rss_after-rss_before:+.1f}MB')
"
```

### Benchmark P2: `DataProfiler` + `EdaEngine` vs Pure Polars Baseline
Compare duration & RSS growth across `domain_b_ledger.parquet` (`10k`, `100k`, `500k`) and note Python list-extraction cost vs native Polars vectorization.

### Benchmark P3: Deduplication & `DatasetCleaner` Sliding-Window Scaling (`>200` Block Size Test)
1. Measure `MultiStageEntityResolver` / `DatasetCleaner.process_dataframe` on `1k`, `10k`, `50k` rows of `domain_a_customers.parquet`.
2. Explicitly verify that large shared blocking keys (e.g., all rows with same `city="Accra"`) scale near-linearly (`window=20`) instead of hanging on $O(N^2)$ pair loops!
3. Also measure memory retention of `DatasetCleaner`'s `LineageTracker` and report whether memory frees after `gc.collect()`.

### Benchmark P4: `er_pipeline` Pair Scoring & Golden Indexing
Measure `er/blocking.py` + `er/comparison.py` chunked multiprocessing + `golden_ops.py` indexing (`O(C + G)`) across `10k` vs `50k` records in `domain_a_customers` + `domain_a_customers_crm_b`.

---

## Bottleneck Diagnosis Categories

When recording slowdowns in `test-results/execution-log.md`, classify the exact root cause:
- **File I/O vs Eager Buffer Copy** (e.g., `p.read_bytes()` duplicating buffer)
- **Polars → Python Dict Deserialization** (`df.to_dicts()` ~10x RAM amplification in `DatasetCleaner` and `MachineLearningEngine`)
- **Row-Wise Python Loops vs Vectorization** (`DataProfiler` value loops vs Polars expressions)
- **Memory Retention After Execution** (non-released RSS / DuckDB connection / lineage buffers)
- **Algorithmic Scaling** (e.g., sorting/blocking cardinality)
