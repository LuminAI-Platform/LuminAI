# LuminAI Performance & Stress Testing Guide

## 1. Benchmarking Targets

| Operation | Metric Target | Acceptable Threshold | Stress Failure Indicator |
| :--- | :--- | :--- | :--- |
| **Small CSV Ingestion (2,000 rows)** | Latency < 1.0s | Latency < 2.5s | Request timeout (>10s) or memory spike |
| **Large Parquet Ingestion (100,000 rows)** | Latency < 3.0s | Latency < 6.0s | Worker OOM crash |
| **DuckDB Aggregation Query (100,000 rows)** | Query Time < 150ms | Query Time < 500ms | Query execution > 2.0s |
| **UI Table Scrolling (100,000 rows)** | 60 FPS (Virtual DOM) | 45 FPS | Browser tab crash / memory > 600 MB |
| **Relational Decomposition (3,000 rows)** | Sync Time < 4.0s | Sync Time < 8.0s | Neo4j deadlock or batch timeout |
| **ML Model Training (Random Forest 25k)** | Training Time < 15s | Training Time < 30s | Worker freeze / CPU saturation |

---

## 2. Browser Performance & Memory Verification

### Step-by-Step Procedure:
1. Open Google Chrome DevTools (`F12`). Switch to the **Performance** or **Memory** tab.
2. In another tab, open Chrome Task Manager (`Shift+Esc`).
3. Note the baseline memory consumption of the LuminAI tab (typically 80–120 MB).
4. Navigate to `/datasets` and open `operational_events_stress.parquet` (100,000 rows).
5. Perform continuous rapid vertical scrolling through the preview table for 30 seconds.
6. Verify memory footprint in Chrome Task Manager:
   - **PASS**: Memory stabilizes under 350 MB due to virtual table windowing (`react-virtual` / `@tanstack/react-virtual`).
   - **FAIL**: Memory continuously climbs past 800 MB, causing garbage collection pauses and browser lag.

---

## 3. Concurrency & Queue Latency

### Step-by-Step Procedure:
1. Open two browser sessions side-by-side.
2. In Session 1, launch a long-running ML Model Training job on `customers_medium.csv`.
3. In Session 2, simultaneously execute an analytical query in SQL Studio (`/analytics/sql`).
4. Verify that the SQL query executes instantaneously in DuckDB without being blocked by the background ML training worker.
5. In Session 2, navigate to `/connections/pipelines` to observe live SSE streaming logs.
6. Confirm that SSE pings arrive every 15 seconds without disconnections.
