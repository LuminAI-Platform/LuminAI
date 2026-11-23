# LuminAI Known Limitations & Architectural Boundaries

## 1. Executive Summary

This document outlines known behavioral boundaries, architectural limits, and environmental considerations for testing teams. Understanding these limits prevents misclassifying intended design constraints as system bugs.

---

## 2. Technical Limitations & Boundaries

### 2.1 Supported Machine Learning Algorithms
- **Supported**: Random Forest Classifier/Regressor, Logistic Regression, Linear/Ridge Regression, KMeans Clustering (via `scikit-learn`).
- **Out of Scope / Unsupported**: Deep learning frameworks (PyTorch, TensorFlow, Hugging Face transformers) and distributed training (Ray, Spark MLlib).
- **Inference Scope**: Single-node CPU training with batch prediction. Real-time sub-millisecond low-latency inference streaming is planned for v2.

### 2.2 SQL Studio Engine (DuckDB Read-Only)
- **Supported Dialect**: Standard ANSI SQL with DuckDB scalar and analytical functions (window functions, CTEs, unnest, json_extract).
- **Forbidden Operations**: DDL/DML mutations (`DROP`, `DELETE`, `UPDATE`, `INSERT`, `ALTER`, `CREATE TABLE`). All non-SELECT queries are blocked by AST security parsing.
- **Cross-Database Federation**: Queries operate over datasets registered in MinIO or local memory. Direct cross-database joins querying external PostgreSQL tables alongside DuckDB Parquets within the same SQL statement must be executed via predefined pipeline ingestion.

### 2.3 Knowledge Graph Canvas Rendering (Cytoscape.js)
- **Rendering Limit**: The Cytoscape canvas performs smoothly up to **2,500 - 5,000 nodes and edges**.
- **High-Volume Graph Exploration**: Attempting to render > 10,000 nodes simultaneously without filters will cause browser rendering frame drops. Testers should utilize the **Hop Depth** limit (1 to 2 hops) and **Entity Type** filters to examine subgraphs.

### 2.4 Deployed Production Environment Note (Lightsail Deployment)
- **Issue**: On the live deployment (`https://luminai.luminex-logistics.com`), an earlier build had an unmemoized `tabState` object causing an infinite `loadConnectors` re-render loop (visible as a stuck skeleton table even when badge counts showed records).
- **Status**: The bug is fully fixed and committed in the codebase (`b994ad4`) on branches `main`, `dev`, and `deb`.
- **Action Required**: The frontend container must be rebuilt and redeployed on AWS Lightsail to reflect the fix on the live URL. When testing locally (`npm run dev`), the bug is already resolved.
