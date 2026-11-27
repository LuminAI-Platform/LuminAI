"""Data Science workspace API endpoints for ML model experimentation and Model Registry.

Endpoints:
  POST /analytics/ml/train       → Train and evaluate classification/regression model.
  GET  /analytics/ml/experiments → Retrieve experiment tracking leaderboard.
  POST /analytics/ml/models/register → Promote experiment to Model Registry.
  GET  /analytics/ml/models      → List registered models and versions.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.processing.ml.ml_engine import MachineLearningEngine
from app.processing.ml.ml_registry import ModelRegistryService
from app.security import AuthIdentity, get_current_identity, resolve_effective_tenant

router = APIRouter(prefix="/analytics/ml", tags=["data-science-ml"])


class TrainModelRequest(BaseModel):
    tenant_id: str = Field(default="acme", description="Tenant scoping the ML experiment.")
    model_name: str = Field(..., description="Descriptive name for the model experiment.")
    dataset_name: str = Field(default="dataset", description="Name of the training dataset.")
    dataset_version: int = Field(default=1, description="Snapshot version of the dataset.")
    target_column: Optional[str] = Field(
        default=None,
        description="Target label or numeric column to predict (optional for CLUSTERING).",
    )
    records: List[Dict[str, Any]] = Field(..., description="Training sample records.")
    feature_columns: Optional[List[str]] = Field(default=None, description="Feature columns to use.")
    algorithm: str = Field(default="Random Forest", description="Algorithm name.")
    task_type: str = Field(default="CLASSIFICATION", description="CLASSIFICATION, REGRESSION, or CLUSTERING.")
    test_size: float = Field(default=0.2, description="Test split fraction.")
    hyperparameters: Optional[Dict[str, Any]] = Field(default=None, description="Algorithm hyperparameters.")


class PredictModelRequest(BaseModel):
    run_id: str = Field(..., description="Experiment run ID whose trained artifact will be used.")
    records: List[Dict[str, Any]] = Field(..., description="Records to score.")


class RegisterModelRequest(BaseModel):
    tenant_id: str = Field(default="acme", description="Tenant ID.")
    run_id: str = Field(..., description="Experiment run ID to promote.")
    name: str = Field(..., description="Registered model name.")
    status: str = Field(default="CHAMPION", description="Model state: CHAMPION or CHALLENGER.")
    description: Optional[str] = Field(default=None, description="Model release notes or description.")


@router.post("/train", summary="Train and evaluate a machine learning model")
def train_model_endpoint(
    request: TrainModelRequest,
    identity: AuthIdentity = Depends(get_current_identity),
) -> Dict[str, Any]:
    """Trains a model on dataset records, computes validation metrics, persists artifact, and logs the experiment."""
    effective_tenant = resolve_effective_tenant(identity, request.tenant_id) or request.tenant_id
    try:
        outcome = MachineLearningEngine.train_and_evaluate(
            records=request.records,
            target_column=request.target_column,
            feature_columns=request.feature_columns,
            algorithm=request.algorithm,
            task_type=request.task_type,
            test_size=request.test_size,
            hyperparameters=request.hyperparameters,
            include_artifact=True,
        )
        artifact = outcome.pop("_artifact", None)

        # Log into experiment tracker
        logged_run = ModelRegistryService.log_experiment(
            tenant_id=effective_tenant,
            model_name=request.model_name,
            algorithm=request.algorithm,
            task_type=request.task_type,
            dataset_name=request.dataset_name,
            dataset_version=request.dataset_version,
            features=[f["feature"] for f in outcome["feature_importances"]],
            target_column=request.target_column or "",
            metrics=outcome["metrics"],
            confusion_matrix=outcome.get("confusion_matrix"),
            feature_importances=outcome.get("feature_importances"),
            hyperparameters=request.hyperparameters,
        )

        if artifact is not None:
            outcome["artifact_path"] = ModelRegistryService.save_artifact(
                logged_run.run_id, artifact
            )

        outcome["run_id"] = logged_run.run_id
        return outcome
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/predict", summary="Score records using a trained ML model artifact")
def predict_model_endpoint(request: PredictModelRequest) -> Dict[str, Any]:
    """Runs inference on new records using the persisted model & preprocessing pipeline."""
    artifact = ModelRegistryService.load_artifact(request.run_id)
    if artifact is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model artifact for run '{request.run_id}' not found.",
        )
    try:
        predictions = MachineLearningEngine.predict_from_artifact(artifact, request.records)
        return {"run_id": request.run_id, "predictions": predictions, "count": len(predictions)}
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/experiments", summary="List experiment tracking leaderboard")
def list_experiments_endpoint(
    tenant_id: Optional[str] = Query(default=None, description="Tenant identifier."),
    identity: AuthIdentity = Depends(get_current_identity),
) -> List[Dict[str, Any]]:
    """Returns all logged experiment runs for the tenant."""
    effective_tenant = resolve_effective_tenant(identity, tenant_id) or "acme"
    return ModelRegistryService.list_experiments(effective_tenant)


@router.post("/models/register", summary="Promote an experiment to the Model Registry")
def register_model_endpoint(
    request: RegisterModelRequest,
    identity: AuthIdentity = Depends(get_current_identity),
) -> Dict[str, Any]:
    """Promotes a trained experiment to the governed Model Registry."""
    effective_tenant = resolve_effective_tenant(identity, request.tenant_id) or request.tenant_id
    try:
        reg = ModelRegistryService.register_model(
            tenant_id=effective_tenant,
            run_id=request.run_id,
            name=request.name,
            status=request.status,
            description=request.description,
        )
        return {
            "model_id": reg.model_id,
            "name": reg.name,
            "version": reg.version,
            "status": reg.status,
            "metrics": reg.metrics,
        }
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/models", summary="List registered models in the registry")
def list_models_endpoint(
    tenant_id: Optional[str] = Query(default=None, description="Tenant identifier."),
    identity: AuthIdentity = Depends(get_current_identity),
) -> List[Dict[str, Any]]:
    """Returns registered models and active versions in the Model Registry."""
    effective_tenant = resolve_effective_tenant(identity, tenant_id) or "acme"
    return ModelRegistryService.list_models(effective_tenant)
