# LuminAI Production-Grade Synthetic Testing Suite & Manual QA Environment

Welcome to the **LuminAI** Testing and Validation Environment.
This repository directory contains a self-contained, enterprise-scale synthetic data generation framework, deterministic ground-truth manifests, and an interactive manual end-to-end testing suite for auditing the complete LuminAI platform.

---

## 📁 Directory Structure

```
luminai-testing/
├── README.md                              <- This master documentation index
├── manual-testing-tracker.md              <- Interactive test execution tracker & defect log
├── datasets/                              <- 26 synthetic datasets across 4 tiers
│   ├── small/                             <- Functional UI & rapid verification (CSV, TSV, JSON, JSONL, XLSX, XML)
│   ├── medium/                            <- Full enterprise scale (CSV, Parquet, JSONL, 25k-50k rows)
│   ├── large/                             <- Partitioned CSVs & 100k-row Parquet stress tests
│   └── edge-cases/                        <- Leading zeros, extreme outliers, quoted newlines, fuzzy ER pairs, malformed
├── ground-truth/                          <- Independent, deterministic verification manifests
│   ├── manifest.json                      <- Master ground-truth index (row counts, anomalies, relational links)
│   └── profiling/                         <- Per-dataset statistical JSON profiles (min, max, quantiles, nulls, outliers)
├── documentation/                         <- Comprehensive engineering documentation
│   ├── manual-testing-guide.md            <- Step-by-step 18-stage testing guide with test case IDs
│   ├── feature-inventory.md               <- 25 capability areas & complete endpoint contract inventory
│   ├── architecture-discovery.md          <- System components, communication topologies, and storage tiers
│   ├── security-testing-guide.md          <- Safe XSS, formula injection, path traversal, and multi-tenant test probes
│   ├── performance-testing-guide.md       <- Latency, throughput, and Chrome DevTools memory benchmarks
│   ├── known-limitations.md               <- Architectural boundaries and deployment notices
│   └── discovered_architecture.json       <- Raw automated AST discovery metadata
├── generators/                            <- Deterministic generator & validation scripts
│   ├── generate_datasets.py               <- Multi-format synthetic enterprise data generator
│   ├── generate_ground_truth.py           <- Independent Polars/DuckDB statistical profiler
│   ├── validate_generated_data.py         <- Automated checksum and data integrity validator
│   └── discover_features.py               <- Codebase crawler & endpoint extractor
└── reports/                               <- Verification summaries
    ├── generation-report.md               <- Generation statistics & dataset inventory
    └── dataset-quality-report.md          <- Detailed anomaly injection matrix & ground-truth baselines
```

---

## 🚀 Quickstart for Testers

### 1. The Fictional Enterprise: Afrilink Logistics & Retail Ltd.
All synthetic datasets reflect a realistic West African logistics and retail enterprise headquartered in Accra, Ghana, with regional distribution centers in Kumasi, Takoradi, Tamale, and Tema, and cross-border trade corridors in Lagos, Abidjan, and Nairobi.
- **Currencies**: GHS (Ghanaian Cedi), USD, EUR, NGN, KES.
- **Payment Methods**: MTN Mobile Money, Telecel Cash, AT Money, Visa, Mastercard, Bank Wire.
- **National IDs**: Ghana Card format `GHA-xxxxxxxx-x`.

### 2. How to Conduct the Manual Tests
1. Open the [Manual Testing Guide](file:///c:/Users/HP%20ELITEBOOK/OneDrive/Desktop/LuminAI/LuminAI/luminai-testing/documentation/manual-testing-guide.md).
2. Follow each test case sequentially from **Stage 1 (Environment Check)** through **Stage 18 (Stress & Concurrency)**.
3. Upload datasets directly from the `luminai-testing/datasets/` folder through the LuminAI web UI.
4. Compare on-screen outputs, profile cards, and cleaning results with the ground-truth baseline in `luminai-testing/ground-truth/manifest.json`.
5. Record your observations and mark tests `PASS` or `FAIL` in the [Manual Testing Tracker](file:///c:/Users/HP%20ELITEBOOK/OneDrive/Desktop/LuminAI/LuminAI/luminai-testing/manual-testing-tracker.md).

---

## 🛠️ Regenerating Data or Validating Baselines

To regenerate the datasets or recompute the independent ground-truth statistics:

```bash
# 1. Regenerate all synthetic datasets (Small, Medium, Large, Edge-cases)
uv run --directory data-engine --with openpyxl python ../luminai-testing/generators/generate_datasets.py

# 2. Recompute independent ground-truth profiles via Polars & DuckDB
uv run --directory data-engine python ../luminai-testing/generators/generate_ground_truth.py

# 3. Validate integrity and manifest consistency
uv run --directory data-engine python ../luminai-testing/generators/validate_generated_data.py
```
