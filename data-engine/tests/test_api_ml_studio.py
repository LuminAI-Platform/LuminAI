"""Unit and integration tests for ML Studio API endpoints."""

from fastapi.testclient import TestClient
import pytest

from app.main import app

client = TestClient(app)


@pytest.fixture
def classification_records():
    """Generates synthetic dataset for binary classification."""
    records = []
    for i in range(50):
        # Class 0: low age, low income
        records.append({
            "age": 20 + (i % 10),
            "income": 25000 + (i * 200),
            "credit_score": 580 + (i * 2),
            "churn": 0,
        })
        # Class 1: high age, high income
        records.append({
            "age": 45 + (i % 15),
            "income": 75000 + (i * 400),
            "credit_score": 720 + (i * 2),
            "churn": 1,
        })
    return records


@pytest.fixture
def regression_records():
    """Generates synthetic dataset for continuous regression."""
    records = []
    for i in range(50):
        records.append({
            "square_feet": 800 + (i * 50),
            "bedrooms": 1 + (i % 4),
            "price": 150000 + (i * 8500),
        })
    return records


def test_train_classification_model(classification_records):
    """Classification model training generates valid metrics and experiment run."""
    response = client.post(
        "/analytics/ml/train",
        json={
            "tenant_id": "test_tenant",
            "model_name": "Customer Churn Predictor",
            "dataset_name": "customer_features",
            "dataset_version": 1,
            "target_column": "churn",
            "records": classification_records,
            "algorithm": "Random Forest",
            "task_type": "CLASSIFICATION",
            "test_size": 0.25,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "metrics" in data
    assert "accuracy" in data["metrics"]
    assert "f1_score" in data["metrics"]
    assert data["metrics"]["accuracy"] >= 0.70
    assert "feature_importances" in data
    assert len(data["feature_importances"]) == 3
    assert "confusion_matrix" in data
    assert "run_id" in data


def test_train_regression_model(regression_records):
    """Regression model training calculates R2, RMSE, and MAE."""
    response = client.post(
        "/analytics/ml/train",
        json={
            "tenant_id": "test_tenant",
            "model_name": "House Price Estimator",
            "dataset_name": "housing_data",
            "dataset_version": 2,
            "target_column": "price",
            "records": regression_records,
            "algorithm": "Linear Regression",
            "task_type": "REGRESSION",
            "test_size": 0.2,
        },
    )
    assert response.status_code == 200
    data = response.json()
    metrics = data["metrics"]
    assert "r2_score" in metrics
    assert "rmse" in metrics
    assert "mae" in metrics
    assert metrics["r2_score"] > 0.80


def test_experiment_tracking_and_registry(classification_records):
    """Tracks experiment run and promotes it to the Model Registry."""
    train_res = client.post(
        "/analytics/ml/train",
        json={
            "tenant_id": "reg_tenant",
            "model_name": "Churn Model v1",
            "target_column": "churn",
            "records": classification_records,
            "algorithm": "Logistic Regression",
            "task_type": "CLASSIFICATION",
        },
    )
    assert train_res.status_code == 200
    run_id = train_res.json()["run_id"]

    # 1. Retrieve experiments leaderboard
    exp_res = client.get("/analytics/ml/experiments?tenant_id=reg_tenant")
    assert exp_res.status_code == 200
    experiments = exp_res.json()
    assert any(e["run_id"] == run_id for e in experiments)

    # 2. Promote to Model Registry
    reg_res = client.post(
        "/analytics/ml/models/register",
        json={
            "tenant_id": "reg_tenant",
            "run_id": run_id,
            "name": "Production Customer Churn Classifier",
            "status": "CHAMPION",
            "description": "Baseline logistic regression model for churn.",
        },
    )
    assert reg_res.status_code == 200
    reg_data = reg_res.json()
    assert reg_data["name"] == "Production Customer Churn Classifier"
    assert reg_data["status"] == "CHAMPION"
    assert reg_data["version"] == 1

    # 3. List registered models
    models_res = client.get("/analytics/ml/models?tenant_id=reg_tenant")
    assert models_res.status_code == 200
    models = models_res.json()
    assert any(m["name"] == "Production Customer Churn Classifier" for m in models)


def test_train_model_invalid_target(classification_records):
    """Fails gracefully with 400 when target column is missing."""
    response = client.post(
        "/analytics/ml/train",
        json={
            "tenant_id": "test_tenant",
            "model_name": "Failed Model",
            "target_column": "non_existent_column",
            "records": classification_records,
            "algorithm": "Random Forest",
        },
    )
    assert response.status_code == 400
    assert "Target column 'non_existent_column' does not exist" in response.json()["detail"]
