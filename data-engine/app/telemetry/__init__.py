"""Telemetry and Observability subsystem for LuminAI Data Engine."""

from app.telemetry.metrics import (
    luminai_er_candidate_pairs_total,
    luminai_er_classifications_total,
    luminai_er_clusters_total,
    luminai_er_golden_records_total,
    luminai_er_match_rate,
    luminai_kafka_messages_consumed_total,
    luminai_kafka_messages_produced_total,
    luminai_pipeline_duration_seconds,
    luminai_records_processed_total,
    record_er_metrics,
    record_pipeline_duration,
    record_records_processed,
)
from app.telemetry.tracing import (
    get_in_memory_exporter,
    get_tracer,
    init_telemetry,
    shutdown_telemetry,
    trace_span,
)

__all__ = [
    "luminai_records_processed_total",
    "luminai_pipeline_duration_seconds",
    "luminai_er_candidate_pairs_total",
    "luminai_er_classifications_total",
    "luminai_er_match_rate",
    "luminai_er_clusters_total",
    "luminai_er_golden_records_total",
    "luminai_kafka_messages_consumed_total",
    "luminai_kafka_messages_produced_total",
    "record_records_processed",
    "record_pipeline_duration",
    "record_er_metrics",
    "init_telemetry",
    "shutdown_telemetry",
    "get_tracer",
    "get_in_memory_exporter",
    "trace_span",
]
