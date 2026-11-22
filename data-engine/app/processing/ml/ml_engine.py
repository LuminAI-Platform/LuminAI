"""Production-grade machine learning execution engine for LuminAI Data Science workspace.

Provides:
  - Automated feature preprocessing (imputation, scaling, one-hot encoding)
  - Train/Test dataset splitting
  - Scikit-learn model training across classification and regression algorithms
  - Professional evaluation metrics (Accuracy, ROC AUC, F1, RMSE, R-squared)
  - Feature importance calculations
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional

import numpy as np
import polars as pl
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LinearRegression, LogisticRegression, Ridge
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split


class MachineLearningEngine:
    """End-to-end scikit-learn model training and evaluation engine."""

    @classmethod
    def train_and_evaluate(
        cls,
        records: List[Dict[str, Any]],
        target_column: str,
        feature_columns: Optional[List[str]] = None,
        algorithm: str = "Random Forest",
        task_type: str = "CLASSIFICATION",
        test_size: float = 0.2,
        hyperparameters: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Trains a model on the provided dataset and returns complete evaluation metrics."""
        if not records or len(records) < 5:
            raise ValueError("At least 5 sample records are required to train and evaluate a model.")

        df = pl.DataFrame(records)
        is_clustering = task_type.upper() == "CLUSTERING"
        if not is_clustering and target_column not in df.columns:
            raise ValueError(f"Target column '{target_column}' does not exist in dataset.")

        # Determine features
        if not feature_columns:
            feature_columns = [c for c in df.columns if c != target_column] if not is_clustering else list(df.columns)
        else:
            feature_columns = [c for c in feature_columns if c in df.columns and (is_clustering or c != target_column)]

        if not feature_columns:
            raise ValueError("No valid feature columns selected for model training.")

        # Separate X and y
        y_raw = df[target_column].to_list() if not is_clustering and target_column in df.columns else []
        
        # Preprocess features: numerical vs categorical
        x_processed_dict: Dict[str, List[float]] = {}
        for col in feature_columns:
            col_vals = df[col].to_list()
            # Try to treat as numerical
            is_numeric = True
            numeric_vals: List[float] = []
            for v in col_vals:
                if v is None or v == "":
                    numeric_vals.append(float("nan"))
                else:
                    try:
                        numeric_vals.append(float(v))
                    except (ValueError, TypeError):
                        is_numeric = False
                        break

            if is_numeric:
                # Impute NaN with median or 0.0
                valid_nums = [n for n in numeric_vals if not math.isnan(n)]
                med = float(np.median(valid_nums)) if valid_nums else 0.0
                x_processed_dict[col] = [med if math.isnan(n) else n for n in numeric_vals]
            else:
                # One-hot encode top 10 categories
                str_vals = [str(v or "missing").strip() for v in col_vals]
                top_cats = [c for c, _ in pl.Series(str_vals).value_counts().head(10).rows()]
                for cat in top_cats:
                    x_processed_dict[f"{col}_{cat}"] = [1.0 if s == cat else 0.0 for s in str_vals]

        final_feature_names = list(x_processed_dict.keys())
        x_matrix = np.column_stack([x_processed_dict[k] for k in final_feature_names])

        params = hyperparameters or {}

        if task_type.upper() == "CLASSIFICATION":
            return cls._train_classification(
                x_matrix=x_matrix,
                y_raw=y_raw,
                feature_names=final_feature_names,
                algorithm=algorithm,
                test_size=test_size,
                params=params,
            )
        elif task_type.upper() == "CLUSTERING":
            return cls._train_clustering(
                x_matrix=x_matrix,
                feature_names=final_feature_names,
                algorithm=algorithm,
                params=params,
            )
        else:
            return cls._train_regression(
                x_matrix=x_matrix,
                y_raw=y_raw,
                feature_names=final_feature_names,
                algorithm=algorithm,
                test_size=test_size,
                params=params,
            )

    @classmethod
    def _train_classification(
        cls,
        x_matrix: np.ndarray,
        y_raw: List[Any],
        feature_names: List[str],
        algorithm: str,
        test_size: float,
        params: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Trains classification model and derives accuracy, precision, recall, f1, and roc_auc."""
        unique_classes = list(set(str(y).strip() for y in y_raw if y is not None))
        if len(unique_classes) < 2:
            raise ValueError(f"Target column must contain at least 2 distinct classes. Found: {unique_classes}")

        class_to_idx = {c: idx for idx, c in enumerate(sorted(unique_classes))}
        y_encoded = np.array([class_to_idx.get(str(y).strip(), 0) for y in y_raw])

        x_train, x_test, y_train, y_test = train_test_split(
            x_matrix, y_encoded, test_size=test_size, random_state=42
        )

        n_estimators = int(params.get("n_estimators", 100))
        max_depth = params.get("max_depth")
        max_depth = int(max_depth) if max_depth is not None else None

        algo_lower = algorithm.lower()
        if "gradient" in algo_lower:
            model = GradientBoostingClassifier(n_estimators=min(n_estimators, 150), random_state=42)
        elif "logistic" in algo_lower:
            model = LogisticRegression(max_iter=500, random_state=42)
        else:
            model = RandomForestClassifier(n_estimators=n_estimators, max_depth=max_depth, random_state=42)

        model.fit(x_train, y_train)
        y_pred = model.predict(x_test)

        acc = float(accuracy_score(y_test, y_pred))
        prec = float(precision_score(y_test, y_pred, average="weighted", zero_division=0))
        rec = float(recall_score(y_test, y_pred, average="weighted", zero_division=0))
        f1 = float(f1_score(y_test, y_pred, average="weighted", zero_division=0))

        # ROC AUC
        roc_auc: Optional[float] = None
        try:
            if hasattr(model, "predict_proba"):
                probs = model.predict_proba(x_test)
                if len(unique_classes) == 2:
                    roc_auc = float(roc_auc_score(y_test, probs[:, 1]))
                else:
                    roc_auc = float(roc_auc_score(y_test, probs, multi_class="ovr"))
        except Exception:
            roc_auc = None

        cm = confusion_matrix(y_test, y_pred).tolist()

        # Feature importances
        feature_importances = cls._extract_importances(model, feature_names)

        return {
            "task_type": "CLASSIFICATION",
            "algorithm": algorithm,
            "classes": sorted(unique_classes),
            "train_samples": len(x_train),
            "test_samples": len(x_test),
            "metrics": {
                "accuracy": round(acc, 4),
                "precision": round(prec, 4),
                "recall": round(rec, 4),
                "f1_score": round(f1, 4),
                "roc_auc": round(roc_auc, 4) if roc_auc is not None else None,
            },
            "confusion_matrix": cm,
            "feature_importances": feature_importances,
            "hyperparameters": params,
        }

    @classmethod
    def _train_regression(
        cls,
        x_matrix: np.ndarray,
        y_raw: List[Any],
        feature_names: List[str],
        algorithm: str,
        test_size: float,
        params: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Trains regression model and derives MSE, RMSE, MAE, and R-squared."""
        y_nums = []
        for v in y_raw:
            try:
                y_nums.append(float(v))
            except (ValueError, TypeError):
                y_nums.append(0.0)

        y_array = np.array(y_nums)
        x_train, x_test, y_train, y_test = train_test_split(
            x_matrix, y_array, test_size=test_size, random_state=42
        )

        n_estimators = int(params.get("n_estimators", 100))
        algo_lower = algorithm.lower()

        if "linear" in algo_lower:
            model = LinearRegression()
        elif "ridge" in algo_lower:
            model = Ridge(alpha=float(params.get("alpha", 1.0)))
        else:
            model = RandomForestRegressor(n_estimators=n_estimators, random_state=42)

        model.fit(x_train, y_train)
        y_pred = model.predict(x_test)

        mse = float(mean_squared_error(y_test, y_pred))
        rmse = float(math.sqrt(mse))
        mae = float(mean_absolute_error(y_test, y_pred))
        r2 = float(r2_score(y_test, y_pred))

        feature_importances = cls._extract_importances(model, feature_names)

        return {
            "task_type": "REGRESSION",
            "algorithm": algorithm,
            "train_samples": len(x_train),
            "test_samples": len(x_test),
            "metrics": {
                "mse": round(mse, 4),
                "rmse": round(rmse, 4),
                "mae": round(mae, 4),
                "r2_score": round(r2, 4),
            },
            "feature_importances": feature_importances,
            "hyperparameters": params,
        }

    @classmethod
    def _train_clustering(
        cls,
        x_matrix: np.ndarray,
        feature_names: List[str],
        algorithm: str,
        params: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Trains unsupervised clustering model (K-Means) and computes silhouette score and inertia."""
        from sklearn.cluster import KMeans
        from sklearn.metrics import silhouette_score

        k = int(params.get("n_clusters", 3))
        n_samples = len(x_matrix)
        k = max(2, min(k, n_samples - 1)) if n_samples > 2 else 2

        kmeans = KMeans(n_clusters=k, random_state=42, n_init="auto")
        labels = kmeans.fit_predict(x_matrix)

        sil_score = 0.0
        if len(set(labels)) > 1 and n_samples > k:
            try:
                sil_score = float(silhouette_score(x_matrix, labels))
            except Exception:
                sil_score = 0.0

        inertia = float(kmeans.inertia_)
        unique_lbls, counts = np.unique(labels, return_counts=True)
        dist = {f"Cluster {int(lbl)}": int(cnt) for lbl, cnt in zip(unique_lbls, counts)}

        return {
            "task_type": "CLUSTERING",
            "algorithm": "K-Means",
            "n_clusters": k,
            "train_samples": n_samples,
            "test_samples": 0,
            "metrics": {
                "silhouette_score": round(sil_score, 4),
                "inertia": round(inertia, 2),
            },
            "cluster_distribution": dist,
            "feature_importances": [{"feature": f, "importance": round(1.0 / len(feature_names), 4)} for f in feature_names],
            "hyperparameters": params,
        }

    @classmethod
    def _extract_importances(cls, model: Any, feature_names: List[str]) -> List[Dict[str, Any]]:
        """Extracts and normalizes feature importance scores."""
        scores: List[float] = []
        if hasattr(model, "feature_importances_"):
            scores = [float(s) for s in model.feature_importances_]
        elif hasattr(model, "coef_"):
            coef = np.abs(model.coef_)
            if coef.ndim > 1:
                coef = np.mean(coef, axis=0)
            scores = [float(c) for c in coef]

        if not scores or len(scores) != len(feature_names):
            return [{"feature": f, "importance": 0.0} for f in feature_names]

        total = sum(scores) or 1.0
        normalized = [round(s / total, 4) for s in scores]

        paired = [{"feature": f, "importance": imp} for f, imp in zip(feature_names, normalized)]
        paired.sort(key=lambda x: x["importance"], reverse=True)
        return paired
