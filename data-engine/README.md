# LuminAI Data Engine

The data ingestion, cleaning, and processing backend for the LuminAI platform.

## Architecture Overview

- **FastAPI**: Exposes endpoints for pipeline control, status checks, and analytics queries.
- **Kafka**: Listens for raw ingestion events (`ingest.raw`) and publishes processed events (`ingest.valid`).
- **Dagster**: Orchestrates data asset materializations.
- **Polars**: Executes high-performance data cleaning, normalisation, and deduplication.

## Setup and Running

### Prerequisites
- Python 3.12+
- `uv` (Fast Python package manager)

### Installation
```bash
uv sync
```

### Environment Configuration
Copy the template `.env` file:
```bash
copy .env.example .env
```

### Running Services
- **FastAPI Server**: `uv run uvicorn app.main:app --reload` (Swagger docs at `http://localhost:8000/docs`)
- **Dagster UI**: `uv run dagster dev -p 3001` (Dashboard at `http://localhost:3001`)

### Testing
```bash
uv run pytest
```
