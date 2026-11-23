# LuminAI Synthetic Data Generation Report

## 1. Generation Summary

- **Enterprise Domain**: Afrilink Logistics & Retail Ltd. (Accra & Regional Hubs, Ghana)
- **Deterministic Seed**: `SEED = 42` (100% reproducible across all formats)
- **Total Files Generated**: 26 files across 4 tiers
- **Total Physical Size**: 25.87 MB (compact, memory-friendly, and well within disk quotas)
- **Generation Engine**: Independent Python 3.12 / Polars / PyArrow / OpenPyXL / DefusedXML generator
- **Validation Status**: PASSED (26/26 files verified with deterministic checksums and schemas)

---

## 2. Dataset Inventory by Sizing Tier

### 2.1 Small Tier (Functional UI & Rapid Interactive Verification)
Designed for quick interactive browser testing, rapid visual previews, and modal validation:

| Filename | Format | Rows | Columns | Exact Duplicates | Deliberate Anomalies Included |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `customers_small.csv` | CSV | 2,010 | 11 | 10 | 5% whitespace, 4% erratic casing, 6% missing email, 2% outlier credit |
| `transactions_small.csv` | CSV | 5,000 | 9 | 0 | 3% negative amounts, 1.5% extreme outliers (>500k), 86 orphan customers |
| `orders_small.tsv` | TSV (Tab) | 3,000 | 11 | 0 | Multi-currency items, discount rates, fulfillment statuses |
| `products_small.json` | JSON | 15 | 6 | 0 | Logistics SKUs, cost prices, selling margins |
| `inventory_small.jsonl` | JSON Lines | 60 | 5 | 0 | Multi-warehouse stock levels across Accra, Kumasi, Takoradi, Tamale |
| `employees_small.xlsx` | Excel (XLSX) | 250 | 8 | 0 | Multi-department staffing, Ghanaian salaries, hierarchy with manager_id |
| `suppliers_small.xml` | XML | 150 | 6 | 0 | African & international freight suppliers, ratings, payment terms |

### 2.2 Medium Tier (Analytics, Machine Learning & Entity Resolution)
Designed for DuckDB SQL analytics, Scikit-learn model training, and heavy profiling:

| Filename | Format | Rows | Columns | Purpose in Testing |
| :--- | :--- | :--- | :--- | :--- |
| `customers_medium.csv` | CSV | 25,010 | 11 | Entity resolution scale test, demographic profiling |
| `transactions_medium.parquet` | Parquet | 50,000 | 9 | Snappy compressed columnar reader, high throughput filtering |
| `orders_medium.csv` | CSV | 35,000 | 11 | Multi-table joins in SQL Studio and Pipeline Builder |
| `support_tickets_medium.jsonl` | JSON Lines | 15,000 | 8 | NLP / categorization, SLA analysis, resolution time modeling |
| `marketing_campaigns_medium.csv` | CSV | 1,000 | 8 | ROI calculations, conversion regression modeling |

### 2.3 Large / Stress Tier (System Boundaries & Concurrency)
Designed to test table virtualization, pagination, and multi-file processing:

| Filename | Format | Rows | Description |
| :--- | :--- | :--- | :--- |
| `transactions_stress_part1.csv` | CSV | 50,000 | Multi-part partitioned transactions dataset (Part 1) |
| `transactions_stress_part2.csv` | CSV | 50,000 | Multi-part partitioned transactions dataset (Part 2) |
| `operational_events_stress.parquet` | Parquet | 100,000 | High-frequency IoT container & terminal gate sensor telemetry |

### 2.4 Edge-Case, Boundary & Malformed Tier

| Filename | Format | Tested Edge-Case |
| :--- | :--- | :--- |
| `identifiers_leading_zeros.csv` | CSV | Leading zeros preservation (`00001234`) without numerical truncation |
| `extreme_values_outliers.csv` | CSV | Massive positive outliers, negative values, zero ratios, XSS tags |
| `quoted_newlines_unicode.csv` | CSV | RFC 4180 embedded newlines, Twi characters (Ɛ, Ɔ), French accents, emojis |
| `fuzzy_duplicates_er.csv` | CSV | Controlled pairs for Jaro-Winkler Entity Resolution and deduplication |
| `schema_evolution_v1.csv` | CSV | Baseline schema (3 columns: customer_id, name, email) |
| `schema_evolution_v2.csv` | CSV | Backward-compatible schema with added columns (`loyalty_tier`, `signup_date`) |
| `schema_evolution_v3.csv` | CSV | Evolved schema with altered data types and additional fields |
| `empty_file.csv` | CSV | 0-byte file upload resilience test |
| `header_only.csv` | CSV | Header present, 0 data rows resilience test |
| `malformed_jagged.csv` | CSV | Unclosed quotation marks, uneven column counts per line |
| `malformed_syntax.json` | JSON | Invalid JSON syntax (trailing comma, unclosed bracket) |
