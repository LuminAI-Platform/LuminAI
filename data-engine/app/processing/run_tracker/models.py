"""Data models and type definitions for pipeline run tracking."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Literal, Optional

RunStatusType = Literal["queued", "running", "completed", "failed"]


@dataclass
class RunRecord:
    """Represents the execution state and progress of a pipeline run."""

    run_id: str
    pipeline_name: str
    tenant_id: str
    source_id: str
    status: RunStatusType = "queued"
    progress_pct: int = 0
    current_step: Optional[str] = None
    steps_completed: List[str] = field(default_factory=list)
    total_steps: int = 5
    message: str = "Pipeline queued."
    error: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    dagster_run_id: Optional[str] = None
    logs: List[str] = field(default_factory=list)
    retry_count: int = 0
    failed_step: Optional[str] = None
    error_history: List[Dict[str, Any]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert RunRecord to a dictionary representation."""
        return asdict(self)
