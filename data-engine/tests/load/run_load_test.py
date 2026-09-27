"""Standalone load test and performance benchmarking runner for LuminAI Data Engine.

Can run in two modes:
1. Direct in-process benchmark using FastAPI TestClient (no server setup needed):
       uv run python tests/load/run_load_test.py --concurrency 5 --requests 50
2. Headless Locust runner against a live server:
       uv run python tests/load/run_load_test.py --locust --users 10 --duration 10s --host http://localhost:8001
"""

import argparse
import asyncio
import os
import subprocess
import sys
import time
from statistics import mean, median
from typing import Dict, List, Optional

# Ensure data-engine root is in path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
TESTS_DIR = os.path.dirname(CURRENT_DIR)
DATA_ENGINE_DIR = os.path.dirname(TESTS_DIR)
if DATA_ENGINE_DIR not in sys.path:
    sys.path.insert(0, DATA_ENGINE_DIR)


def calculate_percentiles(latencies_ms: List[float]) -> Dict[str, float]:
    """Calculate p50, p90, p95, p99, min, max, avg latencies."""
    if not latencies_ms:
        return {
            "min": 0.0,
            "p50": 0.0,
            "p90": 0.0,
            "p95": 0.0,
            "p99": 0.0,
            "max": 0.0,
            "mean": 0.0,
        }
    sorted_lats = sorted(latencies_ms)
    n = len(sorted_lats)

    def p(pct: float) -> float:
        idx = min(int(n * pct), n - 1)
        return sorted_lats[idx]

    return {
        "min": round(sorted_lats[0], 2),
        "p50": round(median(sorted_lats), 2),
        "p90": round(p(0.90), 2),
        "p95": round(p(0.95), 2),
        "p99": round(p(0.99), 2),
        "max": round(sorted_lats[-1], 2),
        "mean": round(mean(sorted_lats), 2),
    }


async def benchmark_async(
    total_requests: int = 50,
    concurrency: int = 5,
    api_key: str = "test-api-key-12345",
) -> int:
    """Benchmark FastAPI application asynchronously using httpx.AsyncClient with ASGITransport."""
    import httpx
    from app.main import app

    headers = {
        "X-API-Key": api_key,
        "X-Tenant-ID": "test-tenant",
        "Content-Type": "application/json",
    }

    endpoints = [
        ("GET", "/health", None),
        ("GET", "/analytics/dashboard/pipeline-stats", None),
        ("GET", "/analytics/dashboard/data-quality", None),
        ("GET", "/analytics/dashboard/entity-stats", None),
        (
            "POST",
            "/analytics/query",
            {
                "tenant_id": "test-tenant",
                "entity_type": "Person",
                "aggregations": ["count"],
            },
        ),
        ("GET", "/analytics/reconciliation", None),
    ]

    latencies_by_endpoint: Dict[str, List[float]] = {ep[1]: [] for ep in endpoints}
    errors_by_endpoint: Dict[str, int] = {ep[1]: 0 for ep in endpoints}

    semaphore = asyncio.Semaphore(concurrency)
    transport = httpx.ASGITransport(app=app)

    print("\n=======================================================")
    print("[*] Starting Data Engine In-Process Load Benchmark")
    print(f"   Concurrency: {concurrency} workers")
    print(f"   Total requests per endpoint: {total_requests}")
    print("=======================================================\n")

    start_total = time.perf_counter()

    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        async def make_request(method: str, path: str, json_body: Optional[dict]):
            async with semaphore:
                t0 = time.perf_counter()
                try:
                    if method == "GET":
                        resp = await client.get(path, headers=headers)
                    else:
                        resp = await client.post(path, json=json_body, headers=headers)
                    elapsed_ms = (time.perf_counter() - t0) * 1000
                    latencies_by_endpoint[path].append(elapsed_ms)
                    if resp.status_code >= 400:
                        errors_by_endpoint[path] += 1
                except Exception as exc:
                    elapsed_ms = (time.perf_counter() - t0) * 1000
                    latencies_by_endpoint[path].append(elapsed_ms)
                    errors_by_endpoint[path] += 1
                    print(f"Request failed for {path}: {exc}")

        tasks = []
        for method, path, body in endpoints:
            for _ in range(total_requests):
                tasks.append(make_request(method, path, body))

        await asyncio.gather(*tasks)

    duration_sec = time.perf_counter() - start_total
    all_latencies = [lat for lats in latencies_by_endpoint.values() for lat in lats]
    total_reqs = len(all_latencies)
    total_errs = sum(errors_by_endpoint.values())
    overall_rps = round(total_reqs / duration_sec, 2) if duration_sec > 0 else 0.0

    print("[*] BENCHMARK RESULTS SUMMARY")
    print("-----------------------------------------------------------------------------------------------------")
    print(
        f"{'Endpoint':<35} | {'Reqs':<6} | {'Errs':<5} | {'Min (ms)':<8} | {'p50 (ms)':<8} | {'p95 (ms)':<8} | {'p99 (ms)':<8} | {'Max (ms)':<8}"
    )
    print("-----------------------------------------------------------------------------------------------------")

    for path, lats in latencies_by_endpoint.items():
        stats = calculate_percentiles(lats)
        errs = errors_by_endpoint[path]
        print(
            f"{path:<35} | {len(lats):<6} | {errs:<5} | {stats['min']:<8.2f} | {stats['p50']:<8.2f} | {stats['p95']:<8.2f} | {stats['p99']:<8.2f} | {stats['max']:<8.2f}"
        )

    overall_stats = calculate_percentiles(all_latencies)
    print("-----------------------------------------------------------------------------------------------------")
    print(
        f"{'OVERALL':<35} | {total_reqs:<6} | {total_errs:<5} | {overall_stats['min']:<8.2f} | {overall_stats['p50']:<8.2f} | {overall_stats['p95']:<8.2f} | {overall_stats['p99']:<8.2f} | {overall_stats['max']:<8.2f}"
    )
    print(f"\n[OK] Total Duration: {duration_sec:.2f}s | Throughput: {overall_rps} req/sec | Error Rate: {total_errs / total_reqs * 100:.1f}%\n")

    return 0 if total_errs == 0 else 1


def run_locust_cli(
    users: int = 10,
    spawn_rate: int = 2,
    duration: str = "10s",
    host: str = "http://localhost:8001",
) -> int:
    """Run Locust in headless CLI mode against a live Data Engine instance."""
    locustfile = os.path.join(CURRENT_DIR, "locustfile.py")
    cmd = [
        sys.executable,
        "-m",
        "locust",
        "-f",
        locustfile,
        "--headless",
        "-u",
        str(users),
        "-r",
        str(spawn_rate),
        "--run-time",
        duration,
        "--host",
        host,
    ]
    print(f"Executing: {' '.join(cmd)}")
    result = subprocess.run(cmd)
    return result.returncode


def main():
    parser = argparse.ArgumentParser(description="LuminAI Data Engine Load Test Runner")
    parser.add_argument("--locust", action="store_true", help="Run via headless Locust against live server")
    parser.add_argument("--users", type=int, default=10, help="Number of concurrent users (Locust mode)")
    parser.add_argument("--spawn-rate", type=int, default=2, help="User spawn rate per second (Locust mode)")
    parser.add_argument("--duration", type=str, default="15s", help="Test duration (e.g. 10s, 1m) (Locust mode)")
    parser.add_argument("--host", type=str, default="http://localhost:8001", help="Target host URL")
    parser.add_argument("--concurrency", type=int, default=5, help="Async concurrency (In-process mode)")
    parser.add_argument("--requests", type=int, default=20, help="Requests per endpoint (In-process mode)")

    args = parser.parse_args()

    if args.locust:
        sys.exit(run_locust_cli(users=args.users, spawn_rate=args.spawn_rate, duration=args.duration, host=args.host))
    else:
        exit_code = asyncio.run(benchmark_async(total_requests=args.requests, concurrency=args.concurrency))
        sys.exit(exit_code)


if __name__ == "__main__":
    main()
