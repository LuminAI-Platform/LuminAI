"""Programmatic trigger for Dagster pipeline runs."""

from __future__ import annotations

from dagster import materialize

from app.processing.trigger.cleaning_trigger import execute_cleaning_pipeline
from app.processing.trigger.edges_trigger import execute_generate_relational_edges
from app.processing.trigger.er_trigger import execute_er_pipeline
from app.processing.trigger.trigger_class import DagsterTrigger

__all__ = [
    "DagsterTrigger",
    "materialize",
    "execute_cleaning_pipeline",
    "execute_er_pipeline",
    "execute_generate_relational_edges",
]
