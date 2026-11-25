"""Configurable Data Cleaning Engine for LuminAI.

Implements Palantir Foundry-inspired dataset cleaning:
  - Configurable, multi-step reproducible cleaning recipes
  - Interactive Preview before execution (before vs after, affected records, quality deltas)
  - Full audit logging of applied operations
  - Non-destructive execution producing new working or curated datasets
"""

from __future__ import annotations

import time
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional, Tuple
import polars as pl

from app.processing.engine.cleaning_operations import (
    apply_deduplicate,
    apply_fill_missing,
    apply_handle_outliers,
    apply_remove_missing,
    apply_standardize_text,
)
from app.processing.engine.profiler import DataProfiler
from app.processing.engine.quality_framework import DataQualityFramework


@dataclass
class CleaningStepConfig:
    """Specification of an individual cleaning operation."""
    step_id: str
    operation: str  # "fill_missing", "remove_missing", "standardize_text", "deduplicate", "handle_outliers"
    column: Optional[str] = None
    parameters: Dict[str, Any] = field(default_factory=dict)
    description: Optional[str] = None


@dataclass
class OperationDiffSample:
    """Sample record difference resulting from a cleaning operation."""
    row_index: int
    column: str
    original_value: Any
    proposed_value: Any
    reason: str


@dataclass
class CleaningPreviewResult:
    """Interactive preview outcome for analyst inspection and approval."""
    operation: str
    affected_rows: int
    total_rows_before: int
    total_rows_after: int
    quality_score_before: float
    quality_score_after: float
    sample_diffs: List[OperationDiffSample]
    preview_rows: List[Dict[str, Any]]
    execution_time_ms: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "operation": self.operation,
            "affected_rows": self.affected_rows,
            "total_rows_before": self.total_rows_before,
            "total_rows_after": self.total_rows_after,
            "quality_score_before": self.quality_score_before,
            "quality_score_after": self.quality_score_after,
            "sample_diffs": [asdict(d) for d in self.sample_diffs],
            "preview_rows": self.preview_rows,
            "execution_time_ms": self.execution_time_ms,
        }


class CleaningEngine:
    """Orchestrates interactive preview and batch execution of cleaning recipes."""

    def __init__(self, tenant_id: str = "acme"):
        self.tenant_id = tenant_id
        self.profiler = DataProfiler()
        self.quality_framework = DataQualityFramework()

    def preview_step(
        self,
        df: pl.DataFrame,
        step: CleaningStepConfig,
        preview_limit: int = 50,
    ) -> CleaningPreviewResult:
        """Executes a single cleaning operation in-memory and returns accurate before/after diffs."""
        t0 = time.perf_counter()
        initial_h = df.height
        all_before = df.to_dicts()
        initial_sample = all_before[:preview_limit]
        q_before = (
            self.quality_framework.assess_dataset(initial_sample).dimension_scores.overall_score
            if initial_sample
            else 100.0
        )

        op = step.operation.lower().strip()
        row_id_col = "__luminai_preview_idx__"
        is_row_removing_non_dedup = op == "remove_missing" or (
            op == "handle_outliers" and str(step.parameters.get("action", "cap")).lower().strip() == "remove"
        )

        if is_row_removing_non_dedup and initial_h > 0:
            indexed_df = df.with_row_index(row_id_col)
            transformed_with_idx, affected_count = self._apply_single_step(indexed_df, step)
            kept_indices = set(transformed_with_idx[row_id_col].to_list())
            transformed_df = transformed_with_idx.drop(row_id_col)
        else:
            kept_indices = set()
            transformed_df, affected_count = self._apply_single_step(df, step)

        post_h = transformed_df.height
        post_dicts = transformed_df.head(preview_limit).to_dicts()
        q_after = (
            self.quality_framework.assess_dataset(post_dicts).dimension_scores.overall_score
            if post_dicts
            else 100.0
        )

        diffs: List[OperationDiffSample] = []
        col = step.column
        reason = step.description or f"Applied {step.operation}"

        if is_row_removing_non_dedup:
            target_cols = step.parameters.get("columns", [col] if col else []) if op == "remove_missing" else ([col] if col else [])
            display_col = ", ".join(c for c in target_cols if c) or (df.columns[0] if df.columns else "row")
            for idx, orig_r in enumerate(all_before):
                if idx not in kept_indices:
                    orig_val = orig_r.get(target_cols[0]) if len(target_cols) == 1 else {c: orig_r.get(c) for c in target_cols if c in orig_r}
                    diffs.append(
                        OperationDiffSample(
                            row_index=idx,
                            column=display_col,
                            original_value=orig_val,
                            proposed_value="<ROW_REMOVED>",
                            reason=reason,
                        )
                    )
                    if len(diffs) >= 10:
                        break
        elif op == "deduplicate":
            subset = [c for c in (step.parameters.get("subset") or []) if c in df.columns]
            keep_mode = str(step.parameters.get("keep", "first")).lower()
            cols_to_key = subset or df.columns
            seen_pos: Dict[tuple, int] = {}
            dropped_rows: List[Tuple[int, Dict[str, Any]]] = []
            for idx, orig_r in enumerate(all_before):
                key = tuple(orig_r.get(c) for c in cols_to_key)
                if key in seen_pos:
                    if keep_mode == "last":
                        dropped_rows.append((seen_pos[key], all_before[seen_pos[key]]))
                        seen_pos[key] = idx
                    else:
                        dropped_rows.append((idx, orig_r))
                else:
                    seen_pos[key] = idx
            display_col = ", ".join(subset) if subset else ", ".join(cols_to_key[:3])
            for idx, d_row in dropped_rows[:10]:
                orig_val = d_row.get(subset[0]) if len(subset) == 1 else {c: d_row.get(c) for c in (subset or cols_to_key[:3])}
                diffs.append(
                    OperationDiffSample(
                        row_index=idx,
                        column=display_col or "row",
                        original_value=orig_val,
                        proposed_value="<ROW_REMOVED_DUPLICATE>",
                        reason=reason,
                    )
                )
        elif col and col in df.columns:
            # Handle flag strategies writing to _is_missing_{col} or _is_outlier_{col}
            act = str(step.parameters.get("strategy" if op == "fill_missing" else "action", "")).lower().strip()
            target_col = (
                f"_is_missing_{col}"
                if op == "fill_missing" and act == "flag" and f"_is_missing_{col}" in transformed_df.columns
                else f"_is_outlier_{col}"
                if op == "handle_outliers" and act == "flag" and f"_is_outlier_{col}" in transformed_df.columns
                else col
            )
            for idx, (orig_r, new_r) in enumerate(zip(initial_sample, post_dicts)):
                ov = orig_r.get(col)
                nv = new_r.get(target_col)
                if target_col != col:
                    if bool(nv):
                        diffs.append(
                            OperationDiffSample(
                                row_index=idx,
                                column=target_col,
                                original_value=ov,
                                proposed_value=nv,
                                reason=reason,
                            )
                        )
                elif ov != nv and not (
                    isinstance(ov, float) and isinstance(nv, float) and ov != ov and nv != nv
                ):
                    diffs.append(
                        OperationDiffSample(
                            row_index=idx,
                            column=col,
                            original_value=ov,
                            proposed_value=nv,
                            reason=reason,
                        )
                    )
                if len(diffs) >= 10:
                    break

        elapsed = round((time.perf_counter() - t0) * 1000.0, 2)
        return CleaningPreviewResult(
            operation=step.operation,
            affected_rows=affected_count,
            total_rows_before=initial_h,
            total_rows_after=post_h,
            quality_score_before=q_before,
            quality_score_after=q_after,
            sample_diffs=diffs,
            preview_rows=post_dicts,
            execution_time_ms=elapsed,
        )

    def execute_recipe(
        self,
        df: pl.DataFrame,
        steps: List[CleaningStepConfig],
    ) -> Tuple[pl.DataFrame, List[Dict[str, Any]]]:
        """Executes a full cleaning recipe sequentially, returning the cleaned DataFrame and audit log."""
        curr_df = df
        audit_log: List[Dict[str, Any]] = []

        for step in steps:
            t0 = time.perf_counter()
            init_h = curr_df.height
            curr_df, affected = self._apply_single_step(curr_df, step)
            elapsed = round((time.perf_counter() - t0) * 1000.0, 2)

            audit_log.append({
                "step_id": step.step_id,
                "operation": step.operation,
                "column": step.column,
                "parameters": step.parameters,
                "affected_rows": affected,
                "rows_before": init_h,
                "rows_after": curr_df.height,
                "execution_time_ms": elapsed,
                "status": "COMPLETED",
            })

        return curr_df, audit_log

    def _apply_single_step(
        self,
        df: pl.DataFrame,
        step: CleaningStepConfig,
    ) -> Tuple[pl.DataFrame, int]:
        """Dispatches to specific cleaning operation."""
        op = step.operation.lower().strip()
        params = step.parameters
        col = step.column or ""

        if op == "remove_missing":
            cols = params.get("columns", [col] if col else [])
            return apply_remove_missing(df, cols)
        elif op == "fill_missing":
            strat = params.get("strategy", "constant")
            fval = params.get("fill_value")
            return apply_fill_missing(df, col, strategy=strat, fill_value=fval)
        elif op == "standardize_text":
            trim = params.get("trim", True)
            case = params.get("case", "none")
            rmap = params.get("replace_map")
            sreg = params.get("strip_regex")
            return apply_standardize_text(df, col, trim=trim, case=case, replace_map=rmap, strip_regex=sreg)
        elif op == "deduplicate":
            subset = params.get("subset")
            keep = params.get("keep", "first")
            return apply_deduplicate(df, subset=subset, keep=keep)
        elif op == "handle_outliers":
            method = params.get("method", "IQR")
            thresh = float(params.get("threshold", 1.5))
            act = params.get("action", "cap")
            return apply_handle_outliers(df, col, method=method, threshold=thresh, action=act)
        else:
            return df, 0
