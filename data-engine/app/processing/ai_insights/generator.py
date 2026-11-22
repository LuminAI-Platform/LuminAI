"""Insight generation engine supporting Gemini API, OpenAI API, and heuristic fallbacks."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import httpx

from app.config import get_settings
from app.processing.ai_insights.models import (
    InsightItem,
    InsightsResponse,
    MetricSummary,
)

logger = logging.getLogger(__name__)


class InsightGenerator:
    """Generates structured data insights via Cloud LLM APIs or deterministic heuristics."""

    def __init__(self) -> None:
        self.settings = get_settings()

    async def generate(
        self,
        profile: Dict[str, Any],
        tenant_id: str,
        entity_type: str,
        table: str,
        focus_question: Optional[str] = None,
    ) -> InsightsResponse:
        """Produce executive summary, metrics, and actionable insights.

        Gracefully degrades to heuristic analysis if external API keys are absent or network fails.
        """
        provider_mode = self.settings.ai_insights_provider.lower()
        gemini_key = self.settings.gemini_api_key
        openai_key = self.settings.openai_api_key

        # 1. Try Gemini if configured or auto-detected
        if provider_mode == "gemini" or (provider_mode == "auto" and gemini_key):
            try:
                res = await self._call_gemini(
                    profile, tenant_id, entity_type, table, focus_question
                )
                if res:
                    return res
            except Exception as exc:
                logger.warning(
                    "Gemini API insight generation failed (%s). Falling back to heuristic engine.",
                    exc,
                )

        # 2. Try OpenAI if configured or auto-detected
        if provider_mode == "openai" or (provider_mode == "auto" and openai_key):
            try:
                res = await self._call_openai(
                    profile, tenant_id, entity_type, table, focus_question
                )
                if res:
                    return res
            except Exception as exc:
                logger.warning(
                    "OpenAI API insight generation failed (%s). Falling back to heuristic engine.",
                    exc,
                )

        # 3. Deterministic Heuristic Engine Fallback
        return self._generate_heuristic(
            profile, tenant_id, entity_type, table, focus_question
        )

    def _generate_heuristic(
        self,
        profile: Dict[str, Any],
        tenant_id: str,
        entity_type: str,
        table: str,
        focus_question: Optional[str] = None,
    ) -> InsightsResponse:
        """Generate high-quality rule-based statistical insights without external network dependencies."""
        now_str = datetime.now(timezone.utc).isoformat()
        row_count = profile.get("row_count", 0)

        if row_count == 0:
            return InsightsResponse(
                tenant_id=tenant_id,
                entity_type=entity_type,
                table=table,
                row_count=0,
                executive_summary=f"No {entity_type} records found in table '{table}' for tenant '{tenant_id}'.",
                key_metrics=[MetricSummary(name="Total Records", value=0)],
                insights=[],
                provider="heuristic",
                generated_at=now_str,
            )

        completeness = profile.get("completeness", {})
        avg_completeness = (
            round(sum(completeness.values()) / len(completeness), 1)
            if completeness
            else 100.0
        )
        anomalies = profile.get("anomalies", [])
        categorical = profile.get("categorical_distributions", {})
        numeric = profile.get("numerical_metrics", {})

        key_metrics = [
            MetricSummary(name="Total Records", value=row_count),
            MetricSummary(name="Avg Completeness", value=f"{avg_completeness}%"),
            MetricSummary(name="Detected Anomalies", value=len(anomalies)),
            MetricSummary(name="Indexed Columns", value=profile.get("column_count", 0)),
        ]

        insights: List[InsightItem] = []

        # 1. Descriptive Insight (What happened / Distribution Baseline)
        insights.append(
            InsightItem(
                title=f"Population & Completeness Baseline for {entity_type}",
                category="descriptive",
                severity="info",
                description=(
                    f"{entity_type} dataset contains {row_count:,} records with {avg_completeness}% "
                    f"average completeness across {len(completeness)} attributes."
                ),
                impact="Provides baseline volume and structural health for downstream processing.",
                recommendation="Monitor completeness trend over succeeding ingestion batches.",
                evidence={
                    "total_records": row_count,
                    "avg_completeness_pct": avg_completeness,
                    "columns_analyzed": len(completeness),
                },
            )
        )

        # 2. Diagnostic Insights (Why it happened / Anomalies / Missingness / Skew)
        for col, pct in completeness.items():
            if pct < 75.0:
                missing_pct = round(100.0 - pct, 1)
                insights.append(
                    InsightItem(
                        title=f"Data Quality Defect on '{col}'",
                        category="diagnostic",
                        severity="warning" if pct >= 50.0 else "critical",
                        description=f"Attribute '{col}' is missing in {missing_pct}% of {entity_type} records.",
                        impact="May degrade downstream entity resolution accuracy and duplicate detection.",
                        recommendation=f"Enforce validation rules on ingestion connectors for '{col}'.",
                        evidence={"column": col, "missing_pct": missing_pct, "valid_records_pct": pct},
                    )
                )

        for anom in anomalies:
            insights.append(
                InsightItem(
                    title=f"Statistical Outlier in '{anom['column']}'",
                    category="diagnostic",
                    severity=anom.get("severity", "warning"),
                    description=(
                        f"Detected {anom['outlier_count']} records exceeding 2.5 standard deviations. "
                        f"Max observed value is {anom['max_observed']} vs threshold {anom['upper_bound']}."
                    ),
                    impact="Extreme values may distort aggregate reporting and financial KPIs.",
                    recommendation="Review extreme records in Explorer or quarantine queue.",
                    evidence=anom,
                )
            )

        for col, cat_data in categorical.items():
            dominant_pct = cat_data.get("dominant_pct", 0.0)
            if dominant_pct >= 75.0 and cat_data.get("top_values"):
                top_val = cat_data["top_values"][0]["value"]
                insights.append(
                    InsightItem(
                        title=f"High Concentration in '{col}'",
                        category="diagnostic",
                        severity="info",
                        description=f"Value '{top_val}' accounts for {dominant_pct}% of all records.",
                        impact="Potential segment imbalance or default form submission value.",
                        recommendation="Verify if this represents genuine customer distribution or placeholder values.",
                        evidence={"column": col, "dominant_pct": dominant_pct, "dominant_value": top_val},
                    )
                )

        # 3. Predictive Insight (Forecast / Risk Projection)
        defect_cols = [c for c, p in completeness.items() if p < 75.0]
        if anomalies or defect_cols:
            risk_score = min(100.0, round(len(anomalies) * 12.5 + len(defect_cols) * 8.0, 1))
            insights.append(
                InsightItem(
                    title="Model Accuracy & Analytics Drift Risk",
                    category="predictive",
                    severity="warning" if risk_score < 50.0 else "critical",
                    description=(
                        f"Detected {len(anomalies)} statistical anomalies and {len(defect_cols)} incomplete fields. "
                        f"Projecting a composite drift/error risk index of {risk_score}/100 for downstream analytics and ML inference."
                    ),
                    impact="Uncorrected outliers and nulls can propagate error into clustering and regression models.",
                    recommendation="Apply automated cleaning and outlier capping recipes prior to model training.",
                    evidence={"risk_score": risk_score, "anomaly_count": len(anomalies), "incomplete_columns": defect_cols},
                )
            )
        else:
            insights.append(
                InsightItem(
                    title="Stable Trend Projection",
                    category="predictive",
                    severity="info",
                    description=f"{entity_type} exhibits high statistical regularity with minimal projected variance risk.",
                    impact="Reliable foundation for automated downstream machine learning and reporting pipelines.",
                    recommendation="Proceed with standard scheduled model retraining.",
                    evidence={"stability_score": 98.5, "anomaly_count": 0},
                )
            )

        # 4. Prescriptive Insight (Concrete Evidence-Backed Action Plan)
        curation_actions = []
        if defect_cols:
            curation_actions.append(f"Impute missing values for {', '.join(defect_cols[:3])}")
        if anomalies:
            curation_actions.append(f"Cap or filter {len(anomalies)} numeric outlier dimensions")
        if not curation_actions:
            curation_actions.append("Publish dataset directly to Curated tier without modification")

        insights.append(
            InsightItem(
                title="Prescribed Curation Action Plan",
                category="prescriptive",
                severity="info" if not defect_cols and not anomalies else "warning",
                description="; ".join(curation_actions) + ".",
                impact="Ensures data governance standards and certifies dataset for enterprise consumption.",
                recommendation="Execute the recommended cleaning recipe in the Pipeline Studio.",
                evidence={"action_items": curation_actions, "defect_columns": defect_cols, "outlier_count": len(anomalies)},
            )
        )

        exec_summary = (
            f"Analysis of {row_count:,} {entity_type} records reveals {avg_completeness}% overall field completeness "
            f"with {len(anomalies)} statistical anomalies identified across {len(numeric)} numeric dimensions."
        )

        return InsightsResponse(
            tenant_id=tenant_id,
            entity_type=entity_type,
            table=table,
            row_count=row_count,
            executive_summary=exec_summary,
            key_metrics=key_metrics,
            insights=insights,
            provider="heuristic",
            generated_at=now_str,
        )

    async def _call_gemini(
        self,
        profile: Dict[str, Any],
        tenant_id: str,
        entity_type: str,
        table: str,
        focus_question: Optional[str],
    ) -> Optional[InsightsResponse]:
        """Generate insights using Google Gemini 1.5 Flash REST API."""
        api_key = self.settings.gemini_api_key
        if not api_key:
            return None

        model = self.settings.gemini_model
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

        prompt = (
            "You are LuminAI's Data Intelligence Assistant. Analyze the following statistical dataset profile "
            f"for tenant '{tenant_id}' on entity '{entity_type}'.\n\n"
            f"DATASET PROFILE:\n{json.dumps(profile, indent=2)}\n\n"
            f"USER FOCUS QUESTION: {focus_question or 'Provide executive summary, trends, anomalies, and recommendations.'}\n\n"
            "Return valid JSON strictly adhering to this structure:\n"
            "{\n"
            '  "executive_summary": "2-3 sentence executive summary",\n'
            '  "insights": [\n'
            '    {"title": "...", "category": "trend|anomaly|data_quality|distribution|recommendation", '
            '"severity": "info|warning|critical", "description": "...", "impact": "...", "recommendation": "..."}\n'
            "  ]\n"
            "}"
        )

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"response_mime_type": "application/json"},
        }

        async with httpx.AsyncClient(
            timeout=self.settings.ai_insights_timeout_seconds
        ) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                text_content = data["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(text_content)
                insights_raw = parsed.get("insights", [])

                insights = [
                    InsightItem(
                        title=item.get("title", "Insight"),
                        category=item.get("category", "trend"),
                        severity=item.get("severity", "info"),
                        description=item.get("description", ""),
                        impact=item.get("impact"),
                        recommendation=item.get("recommendation"),
                    )
                    for item in insights_raw
                ]

                # Use heuristic metrics as baseline
                base = self._generate_heuristic(
                    profile, tenant_id, entity_type, table, focus_question
                )

                return InsightsResponse(
                    tenant_id=tenant_id,
                    entity_type=entity_type,
                    table=table,
                    row_count=profile.get("row_count", 0),
                    executive_summary=parsed.get(
                        "executive_summary", base.executive_summary
                    ),
                    key_metrics=base.key_metrics,
                    insights=insights or base.insights,
                    provider="gemini",
                    generated_at=datetime.now(timezone.utc).isoformat(),
                )
        return None

    async def _call_openai(
        self,
        profile: Dict[str, Any],
        tenant_id: str,
        entity_type: str,
        table: str,
        focus_question: Optional[str],
    ) -> Optional[InsightsResponse]:
        """Generate insights using OpenAI GPT-4o-mini API."""
        api_key = self.settings.openai_api_key
        if not api_key:
            return None

        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        system_prompt = (
            "You are LuminAI's Data Intelligence Assistant. Given a dataset profile JSON, return an executive summary "
            "and list of insights formatted strictly as a JSON object with keys 'executive_summary' and 'insights'."
        )
        user_prompt = f"PROFILE:\n{json.dumps(profile, indent=2)}\nFOCUS: {focus_question or 'Executive summary and key trends'}"

        payload = {
            "model": self.settings.openai_model,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,
        }

        async with httpx.AsyncClient(
            timeout=self.settings.ai_insights_timeout_seconds
        ) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                parsed = json.loads(content)
                insights_raw = parsed.get("insights", [])

                insights = [
                    InsightItem(
                        title=item.get("title", "Insight"),
                        category=item.get("category", "trend"),
                        severity=item.get("severity", "info"),
                        description=item.get("description", ""),
                        impact=item.get("impact"),
                        recommendation=item.get("recommendation"),
                    )
                    for item in insights_raw
                ]

                base = self._generate_heuristic(
                    profile, tenant_id, entity_type, table, focus_question
                )

                return InsightsResponse(
                    tenant_id=tenant_id,
                    entity_type=entity_type,
                    table=table,
                    row_count=profile.get("row_count", 0),
                    executive_summary=parsed.get(
                        "executive_summary", base.executive_summary
                    ),
                    key_metrics=base.key_metrics,
                    insights=insights or base.insights,
                    provider="openai",
                    generated_at=datetime.now(timezone.utc).isoformat(),
                )
        return None
