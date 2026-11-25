"""Production-grade machine learning execution engine for LuminAI Data Science workspace.

Provides:
  - Automated feature preprocessing (imputation, scaling, one-hot encoding)
  - Train/Test dataset splitting
  - Scikit-learn model training across classification and regression algorithms
  - Professional evaluation metrics (Accuracy, ROC AUC, F1, RMSE, R-squared)
  - Feature importance calculations
"""

from __future__ import annotations

from collections import Counter
import math
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
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
from sklearn.preprocessing import StandardScaler

from app.processing.engine.dataframe_utils import records_to_polars_df
from app.processing.engine.type_inference import TypeInferenceEngine


class MachineLearningEngine:
    """End-to-end scikit-learn model training, evaluation, and inference engine."""

    @staticmethod
    def _try_parse_float(val: Any) -> Optional[float]:
        if TypeInferenceEngine.is_null_value(val):
            return None
        try:
            f = float(val)
            return f if math.isfinite(f) else None
        except (ValueError, TypeError):
            return None

    @classmethod
    def _fit_preprocessor(
        cls,
        train_records: List[Dict[str, Any]],
        feature_columns: List[str],
    ) -> List[Dict[str, Any]]:
        """Fit imputation statistics and categorical encodings strictly on training rows."""
        specs: List[Dict[str, Any]] = []
        for col in feature_columns:
            col_vals = [r.get(col) for r in train_records]
            is_numeric = True
            numeric_vals: List[float] = []
            for v in col_vals:
                if TypeInferenceEngine.is_null_value(v):
                    numeric_vals.append(float("nan"))
                else:
                    parsed = cls._try_parse_float(v)
                    if parsed is None:
                        is_numeric = False
                        break
                    numeric_vals.append(parsed)

            valid_nums = [n for n in numeric_vals if not math.isnan(n)]
            if is_numeric and valid_nums:
                med = float(np.median(valid_nums))
                specs.append({"type": "numeric", "col": col, "median": med})
            else:
                str_vals = [
                    "missing" if TypeInferenceEngine.is_null_value(v) else str(v).strip()
                    for v in col_vals
                ]
                counts = Counter(str_vals)
                top_cats = [cat for cat, _ in counts.most_common(10)]
                specs.append({"type": "categorical", "col": col, "categories": top_cats})
        return specs

    @classmethod
    def _transform_features(
        cls,
        records: List[Dict[str, Any]],
        specs: List[Dict[str, Any]],
    ) -> Tuple[np.ndarray, List[str]]:
        """Transform records into a feature matrix using fitted training preprocessor specs."""
        cols_arrays: List[np.ndarray] = []
        feature_names: List[str] = []

        for spec in specs:
            col = spec["col"]
            col_vals = [r.get(col) for r in records]
            if spec["type"] == "numeric":
                med = float(spec["median"])
                arr = np.array(
                    [
                        med if (p := cls._try_parse_float(v)) is None else p
                        for v in col_vals
                    ],
                    dtype=float,
                )
                cols_arrays.append(arr)
                feature_names.append(col)
            else:
                str_vals = [
                    "missing" if TypeInferenceEngine.is_null_value(v) else str(v).strip()
                    for v in col_vals
                ]
                for cat in spec["categories"]:
                    arr = np.array([1.0 if s == cat else 0.0 for s in str_vals], dtype=float)
                    cols_arrays.append(arr)
                    feature_names.append(f"{col}_{cat}")

        if not cols_arrays:
            raise ValueError("No encoded features could be generated from selected columns.")
        return np.column_stack(cols_arrays), feature_names

    @classmethod
    def train_and_evaluate(
        cls,
        records: List[Dict[str, Any]],
        target_column: Optional[str] = None,
        feature_columns: Optional[List[str]] = None,
        algorithm: str = "Random Forest",
        task_type: str = "CLASSIFICATION",
        test_size: float = 0.2,
        hyperparameters: Optional[Dict[str, Any]] = None,
        include_artifact: bool = False,
    ) -> Dict[str, Any]:
        """Trains a model without train/test leakage and returns complete evaluation metrics."""
        if not records or len(records) < 5:
            raise ValueError("At least 5 sample records are required to train and evaluate a model.")

        df = records_to_polars_df(records)
        task_upper = task_type.upper().strip()
        is_clustering = task_upper == "CLUSTERING"
        if not is_clustering:
            if not target_column:
                raise ValueError("Target column is required for CLASSIFICATION and REGRESSION.")
            if target_column not in df.columns:
                raise ValueError(f"Target column '{target_column}' does not exist in dataset.")

        # Determine features
        if not feature_columns:
            feature_columns = (
                [c for c in df.columns if c != target_column]
                if not is_clustering
                else list(df.columns)
            )
        else:
            feature_columns = [
                c
                for c in feature_columns
                if c in df.columns and (is_clustering or c != target_column)
            ]

        if not feature_columns:
            raise ValueError("No valid feature columns selected for model training.")

        all_dicts = df.to_dicts()
        params = hyperparameters or {}

        if task_upper == "CLASSIFICATION":
            return cls._train_classification(
                records=all_dicts,
                target_column=target_column or "",
                feature_columns=feature_columns,
                algorithm=algorithm,
                test_size=test_size,
                params=params,
                include_artifact=include_artifact,
            )
        elif task_upper == "CLUSTERING":
            return cls._train_clustering(
                records=all_dicts,
                feature_columns=feature_columns,
                algorithm=algorithm,
                params=params,
                include_artifact=include_artifact,
            )
        else:
            return cls._train_regression(
                records=all_dicts,
                target_column=target_column or "",
                feature_columns=feature_columns,
                algorithm=algorithm,
                test_size=test_size,
                params=params,
                include_artifact=include_artifact,
            )

    @classmethod
    def _train_classification(
        cls,
        records: List[Dict[str, Any]],
        target_column: str,
        feature_columns: List[str],
        algorithm: str,
        test_size: float,
        params: Dict[str, Any],
        include_artifact: bool = False,
    ) -> Dict[str, Any]:
        """Trains classification model with clean target filtering, stratified split, and zero leakage."""
        valid_rows: List[Dict[str, Any]] = []
        valid_labels: List[str] = []
        for row in records:
            raw_t = row.get(target_column)
            if TypeInferenceEngine.is_null_value(raw_t):
                continue
            valid_rows.append(row)
            valid_labels.append(str(raw_t).strip())

        dropped_rows = len(records) - len(valid_rows)
        if len(valid_rows) < 5:
            raise ValueError(
                f"At least 5 rows with non-null target '{target_column}' are required (found {len(valid_rows)})."
            )

        unique_classes = sorted(set(valid_labels))
        if len(unique_classes) < 2:
            raise ValueError(
                f"Target column must contain at least 2 distinct classes. Found: {unique_classes}"
            )

        class_to_idx = {c: idx for idx, c in enumerate(unique_classes)}
        y_encoded = np.array([class_to_idx[lbl] for lbl in valid_labels])

        # Stratify when each class has >= 2 members and test split can contain every class
        class_counts = Counter(y_encoded.tolist())
        min_count = min(class_counts.values())
        n_test = int(math.ceil(len(valid_rows) * test_size))
        n_train = len(valid_rows) - n_test
        stratify_arr = (
            y_encoded
            if min_count >= 2 and n_test >= len(unique_classes) and n_train >= len(unique_classes)
            else None
        )

        train_rows, test_rows, y_train, y_test = train_test_split(
            valid_rows,
            y_encoded,
            test_size=test_size,
            random_state=42,
            stratify=stratify_arr,
        )

        # Fit preprocessing strictly on training split
        prep_spec = cls._fit_preprocessor(train_rows, feature_columns)
        x_train, final_feature_names = cls._transform_features(train_rows, prep_spec)
        x_test, _ = cls._transform_features(test_rows, prep_spec)

        n_estimators = int(params.get("n_estimators", 100))
        max_depth = params.get("max_depth")
        max_depth = int(max_depth) if max_depth is not None else None

        algo_lower = algorithm.lower()
        scaler: Optional[StandardScaler] = None
        if "logistic" in algo_lower:
            scaler = StandardScaler()
            x_train_fit = scaler.fit_transform(x_train)
            x_test_fit = scaler.transform(x_test)
            model = LogisticRegression(max_iter=500, random_state=42)
        elif "gradient" in algo_lower:
            x_train_fit, x_test_fit = x_train, x_test
            model = GradientBoostingClassifier(n_estimators=min(n_estimators, 150), random_state=42)
        else:
            x_train_fit, x_test_fit = x_train, x_test
            model = RandomForestClassifier(n_estimators=n_estimators, max_depth=max_depth, random_state=42)

        model.fit(x_train_fit, y_train)
        y_pred = model.predict(x_test_fit)

        acc = float(accuracy_score(y_test, y_pred))
        prec = float(precision_score(y_test, y_pred, average="weighted", zero_division=0))
        rec = float(recall_score(y_test, y_pred, average="weighted", zero_division=0))
        f1 = float(f1_score(y_test, y_pred, average="weighted", zero_division=0))

        # ROC AUC
        roc_auc: Optional[float] = None
        try:
            if hasattr(model, "predict_proba"):
                probs = model.predict_proba(x_test_fit)
                if len(unique_classes) == 2:
                    roc_auc = float(roc_auc_score(y_test, probs[:, 1]))
                else:
                    roc_auc = float(roc_auc_score(y_test, probs, multi_class="ovr"))
        except Exception:
            roc_auc = None

        cm = confusion_matrix(y_test, y_pred).tolist()
        feature_importances = cls._extract_importances(model, final_feature_names)

        result: Dict[str, Any] = {
            "task_type": "CLASSIFICATION",
            "algorithm": algorithm,
            "classes": unique_classes,
            "train_samples": len(x_train),
            "test_samples": len(x_test),
            "dropped_missing_target_rows": dropped_rows,
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
        if include_artifact:
            result["_artifact"] = {
                "model": model,
                "scaler": scaler,
                "preprocessor_spec": prep_spec,
                "feature_names": final_feature_names,
                "classes": unique_classes,
                "task_type": "CLASSIFICATION",
            }
        return result

    @classmethod
    def _train_regression(
        cls,
        records: List[Dict[str, Any]],
        target_column: str,
        feature_columns: List[str],
        algorithm: str,
        test_size: float,
        params: Dict[str, Any],
        include_artifact: bool = False,
    ) -> Dict[str, Any]:
        """Trains regression model without target 0-corruption or train/test leakage."""
        valid_rows: List[Dict[str, Any]] = []
        valid_targets: List[float] = []
        for row in records:
            parsed_y = cls._try_parse_float(row.get(target_column))
            if parsed_y is None:
                continue
            valid_rows.append(row)
            valid_targets.append(parsed_y)

        dropped_rows = len(records) - len(valid_rows)
        if len(valid_rows) < 5:
            raise ValueError(
                f"At least 5 rows with valid finite numeric target '{target_column}' are required (found {len(valid_rows)})."
            )

        y_array = np.array(valid_targets, dtype=float)
        train_rows, test_rows, y_train, y_test = train_test_split(
            valid_rows, y_array, test_size=test_size, random_state=42
        )

        # Fit preprocessing strictly on training split
        prep_spec = cls._fit_preprocessor(train_rows, feature_columns)
        x_train, final_feature_names = cls._transform_features(train_rows, prep_spec)
        x_test, _ = cls._transform_features(test_rows, prep_spec)

        n_estimators = int(params.get("n_estimators", 100))
        algo_lower = algorithm.lower()

        scaler: Optional[StandardScaler] = None
        if "linear" in algo_lower:
            scaler = StandardScaler()
            x_train_fit = scaler.fit_transform(x_train)
            x_test_fit = scaler.transform(x_test)
            model = LinearRegression()
        elif "ridge" in algo_lower:
            scaler = StandardScaler()
            x_train_fit = scaler.fit_transform(x_train)
            x_test_fit = scaler.transform(x_test)
            model = Ridge(alpha=float(params.get("alpha", 1.0)))
        else:
            x_train_fit, x_test_fit = x_train, x_test
            model = RandomForestRegressor(n_estimators=n_estimators, random_state=42)

        model.fit(x_train_fit, y_train)
        y_pred = model.predict(x_test_fit)

        mse = float(mean_squared_error(y_test, y_pred))
        rmse = float(math.sqrt(mse))
        mae = float(mean_absolute_error(y_test, y_pred))
        r2 = float(r2_score(y_test, y_pred))

        feature_importances = cls._extract_importances(model, final_feature_names)

        result: Dict[str, Any] = {
            "task_type": "REGRESSION",
            "algorithm": algorithm,
            "train_samples": len(x_train),
            "test_samples": len(x_test),
            "dropped_missing_target_rows": dropped_rows,
            "metrics": {
                "mse": round(mse, 4),
                "rmse": round(rmse, 4),
                "mae": round(mae, 4),
                "r2_score": round(r2, 4),
            },
            "feature_importances": feature_importances,
            "hyperparameters": params,
        }
        if include_artifact:
            result["_artifact"] = {
                "model": model,
                "scaler": scaler,
                "preprocessor_spec": prep_spec,
                "feature_names": final_feature_names,
                "classes": None,
                "task_type": "REGRESSION",
            }
        return result

    @classmethod
    def _train_clustering(
        cls,
        records: List[Dict[str, Any]],
        feature_columns: List[str],
        algorithm: str,
        params: Dict[str, Any],
        include_artifact: bool = False,
    ) -> Dict[str, Any]:
        """Trains scaled unsupervised clustering model (K-Means) and computes silhouette score and inertia."""
        from sklearn.cluster import KMeans
        from sklearn.metrics import silhouette_score

        prep_spec = cls._fit_preprocessor(records, feature_columns)
        x_matrix, final_feature_names = cls._transform_features(records, prep_spec)

        scaler = StandardScaler()
        x_scaled = scaler.fit_transform(x_matrix)

        k = int(params.get("n_clusters", 3))
        n_samples = len(x_scaled)
        k = max(2, min(k, n_samples - 1)) if n_samples > 2 else 2

        kmeans = KMeans(n_clusters=k, random_state=42, n_init="auto")
        labels = kmeans.fit_predict(x_scaled)

        sil_score = 0.0
        if len(set(labels)) > 1 and n_samples > k:
            try:
                sil_score = float(silhouette_score(x_scaled, labels))
            except Exception:
                sil_score = 0.0

        inertia = float(kmeans.inertia_)
        unique_lbls, counts = np.unique(labels, return_counts=True)
        dist = {f"Cluster {int(lbl)}": int(cnt) for lbl, cnt in zip(unique_lbls, counts)}

        result: Dict[str, Any] = {
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
            "feature_importances": [{"feature": f, "importance": round(1.0 / len(final_feature_names), 4)} for f in final_feature_names],
            "hyperparameters": params,
        }
        if include_artifact:
            result["_artifact"] = {
                "model": kmeans,
                "scaler": scaler,
                "preprocessor_spec": prep_spec,
                "feature_names": final_feature_names,
                "classes": None,
                "task_type": "CLUSTERING",
            }
        return result

    @classmethod
    def predict_from_artifact(
        cls,
        artifact: Dict[str, Any],
        records: List[Dict[str, Any]],
    ) -> List[Any]:
        """Generate predictions using a persisted artifact bundle."""
        if not records:
            return []
        x_matrix, _ = cls._transform_features(records, artifact["preprocessor_spec"])
        scaler = artifact.get("scaler")
        if scaler is not None:
            x_matrix = scaler.transform(x_matrix)
        preds = artifact["model"].predict(x_matrix)
        classes = artifact.get("classes")
        if artifact.get("task_type") == "CLASSIFICATION" and classes:
            return [classes[int(idx)] for idx in preds]
        return [int(p) if artifact.get("task_type") == "CLUSTERING" else float(p) for p in preds]

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
