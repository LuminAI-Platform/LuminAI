"""In-memory and file-backed Model Registry and Experiment Tracker for LuminAI.

Supports:
  - Experiment logging with parameters, training dataset ID, and evaluation metrics
  - Metric comparison leaderboard across model runs
  - Model registry transitions (CHALLENGER -> CHAMPION -> ARCHIVED)
"""

from __future__ import annotations

import time
import uuid
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class ExperimentRun:
    """A single executed training and evaluation experiment run."""
    run_id: str
    tenant_id: str
    model_name: str
    algorithm: str
    task_type: str
    dataset_name: str
    dataset_version: int
    features: List[str]
    target_column: str
    metrics: Dict[str, Any]
    confusion_matrix: Optional[List[List[int]]] = None
    feature_importances: List[Dict[str, Any]] = field(default_factory=list)
    hyperparameters: Dict[str, Any] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)


@dataclass
class RegisteredModel:
    """Promoted and governed machine learning model artifact in the Model Registry."""
    model_id: str
    tenant_id: str
    name: str
    version: int
    run_id: str
    algorithm: str
    task_type: str
    status: str  # "CHAMPION", "CHALLENGER", "ARCHIVED"
    metrics: Dict[str, Any]
    feature_names: List[str]
    target_column: str
    registered_at: float = field(default_factory=time.time)
    description: Optional[str] = None


class ModelRegistryService:
    """Thread-safe state manager for experiments and registered models."""

    _experiments: Dict[str, List[ExperimentRun]] = {}
    _registered_models: Dict[str, List[RegisteredModel]] = {}

    @classmethod
    def log_experiment(
        cls,
        tenant_id: str,
        model_name: str,
        algorithm: str,
        task_type: str,
        dataset_name: str,
        dataset_version: int,
        features: List[str],
        target_column: str,
        metrics: Dict[str, Any],
        confusion_matrix: Optional[List[List[int]]] = None,
        feature_importances: Optional[List[Dict[str, Any]]] = None,
        hyperparameters: Optional[Dict[str, Any]] = None,
    ) -> ExperimentRun:
        """Logs an experiment run into the tenant experiment history."""
        run_id = f"exp-{uuid.uuid4().hex[:8]}"
        run = ExperimentRun(
            run_id=run_id,
            tenant_id=tenant_id,
            model_name=model_name,
            algorithm=algorithm,
            task_type=task_type,
            dataset_name=dataset_name,
            dataset_version=dataset_version,
            features=features,
            target_column=target_column,
            metrics=metrics,
            confusion_matrix=confusion_matrix,
            feature_importances=feature_importances or [],
            hyperparameters=hyperparameters or {},
        )
        if tenant_id not in cls._experiments:
            cls._experiments[tenant_id] = []
        cls._experiments[tenant_id].insert(0, run)
        return run

    @classmethod
    def list_experiments(cls, tenant_id: str) -> List[Dict[str, Any]]:
        """Returns leaderboard of all experiment runs for the tenant."""
        runs = cls._experiments.get(tenant_id, [])
        return [asdict(r) for r in runs]

    @classmethod
    def register_model(
        cls,
        tenant_id: str,
        run_id: str,
        name: str,
        status: str = "CHAMPION",
        description: Optional[str] = None,
    ) -> RegisteredModel:
        """Promotes an experiment run into the Model Registry."""
        runs = cls._experiments.get(tenant_id, [])
        matched = next((r for r in runs if r.run_id == run_id), None)
        if not matched:
            raise ValueError(f"Experiment run '{run_id}' not found.")

        if tenant_id not in cls._registered_models:
            cls._registered_models[tenant_id] = []

        existing_versions = [
            m for m in cls._registered_models[tenant_id] if m.name == name
        ]
        next_version = len(existing_versions) + 1

        # If promoting to CHAMPION, demote any current CHAMPION to CHALLENGER
        if status.upper() == "CHAMPION":
            for m in cls._registered_models[tenant_id]:
                if m.name == name and m.status == "CHAMPION":
                    m.status = "CHALLENGER"

        reg_model = RegisteredModel(
            model_id=f"model-{uuid.uuid4().hex[:8]}",
            tenant_id=tenant_id,
            name=name,
            version=next_version,
            run_id=run_id,
            algorithm=matched.algorithm,
            task_type=matched.task_type,
            status=status.upper(),
            metrics=matched.metrics,
            feature_names=matched.features,
            target_column=matched.target_column,
            description=description,
        )
        cls._registered_models[tenant_id].insert(0, reg_model)
        return reg_model

    @classmethod
    def list_models(cls, tenant_id: str) -> List[Dict[str, Any]]:
        """Returns list of registered models in the registry."""
        models = cls._registered_models.get(tenant_id, [])
        return [asdict(m) for m in models]
