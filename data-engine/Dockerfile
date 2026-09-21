# ==============================================================================
# Multi-Stage Production Dockerfile for LuminAI Data Engine
# Hardened: Unprivileged non-root user (UID 10001), healthcheck, multi-stage build
# ==============================================================================

# --- Stage 1: Build virtual environment & dependencies ---
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

WORKDIR /app

# Install native compilation dependencies required by C-extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Optimize uv performance & deterministic virtualenv placement
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

# Install dependencies first (layer caching)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Copy application source and complete project sync
COPY . .
RUN uv sync --frozen --no-dev


# --- Stage 2: Minimal hardened runtime image ---
FROM python:3.12-slim-bookworm AS runner

WORKDIR /app

# Create dedicated non-root user and group (UID/GID 10001)
RUN groupadd -g 10001 nonroot && \
    useradd -u 10001 -g nonroot -s /bin/bash -m nonroot

# Copy virtualenv and application artifacts with nonroot ownership
COPY --from=builder --chown=nonroot:nonroot /app /app

# Configure execution environment
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

# Switch to unprivileged execution user
USER nonroot:nonroot

EXPOSE 8000

# Periodic container healthcheck against /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request, os; port = os.environ.get('PORT', '8000'); urllib.request.urlopen(f'http://localhost:{port}/health')" || exit 1

# Start FastAPI application
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]