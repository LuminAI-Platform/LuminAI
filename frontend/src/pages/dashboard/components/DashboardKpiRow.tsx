import React from "react";
import { KpiCard } from "./KpiCard";
import type {
  DashboardSummary,
  EngineMetricsResponse,
} from "../useDashboardData";
import { Icons } from "../../../lib/icons";

interface DashboardKpiRowProps {
  summary: DashboardSummary | undefined;
  isLoading: boolean;
  isCached?: boolean;
  engineMetrics?: EngineMetricsResponse;
}

/**
 * Dashboard KPI Metric Cards Row
 *
 * Rules:
 * - If the count/metric is 0, display "None yet" in a neutral badge.
 * - Reserve green ("success") badges strictly for non-zero, active/operational metrics.
 * - When no pipeline executions exist, show "–" or "No runs yet", never misleading zeros or dummy scores.
 * - Never default a missing, null, zero-evaluated, or undefined score to 100%. Show "–" with caption "No data evaluated".
 * - Show Good (>=90), Fair (70-89), Poor (<70) only when numeric. Label must match number.
 * - If score is 100 and API gives no evaluated-records count, badge is "Unverified" (neutral) with explanatory tooltip.
 * - If API provides quarantined or rejected counts > 0, "Good" must not be shown; show "Completed with issues" in amber.
 */
export const DashboardKpiRow: React.FC<DashboardKpiRowProps> = ({
  summary,
  isLoading,
  isCached = false,
  engineMetrics,
}) => {
  const totalEntities = summary?.totalEntities ?? 0;
  const totalConnections = summary?.totalConnections ?? 0;
  const totalPipelines = summary?.totalPipelines ?? 0;
  const failedRuns = summary?.pipelineHealth?.failed ?? 0;
  const hasPipelineIssues = failedRuns > 0;

  const hasEntities = totalEntities > 0;
  const hasConnections = totalConnections > 0;
  const hasPipelines = totalPipelines > 0;

  const rawQualityScore = summary?.dataQualityScore;
  const hasNumericScore =
    hasPipelines &&
    typeof rawQualityScore === "number" &&
    !isNaN(rawQualityScore) &&
    rawQualityScore > 0;

  const evaluatedCount =
    engineMetrics?.dataQuality?.recordsEvaluated ??
    engineMetrics?.pipelineStats?.evaluatedCount ??
    0;
  const hasEvaluatedCount = evaluatedCount > 0;

  const quarantinedCount =
    engineMetrics?.dataQuality?.recordsQuarantined ??
    engineMetrics?.pipelineStats?.quarantinedCount ??
    0;
  const rejectedCount =
    engineMetrics?.dataQuality?.recordsRejected ??
    engineMetrics?.pipelineStats?.rejectedCount ??
    failedRuns;
  const hasQuarantineOrRejectedIssues =
    quarantinedCount > 0 || rejectedCount > 0;

  let qualityBadge: {
    text: string;
    variant?: "neutral" | "success" | "warning" | "danger";
    tooltip?: string;
  } = {
    text: "None yet",
    variant: "neutral",
  };

  if (hasNumericScore) {
    if (hasQuarantineOrRejectedIssues) {
      qualityBadge = {
        text: "Completed with issues",
        variant: "warning",
        tooltip: `${rejectedCount} rejected · ${quarantinedCount} quarantined`,
      };
    } else if (rawQualityScore === 100 && !hasEvaluatedCount) {
      qualityBadge = {
        text: "Unverified",
        variant: "neutral",
        tooltip:
          "Score has no evaluated-records count, so it cannot be verified.",
      };
    } else if (rawQualityScore >= 90) {
      qualityBadge = { text: "Good", variant: "success" };
    } else if (rawQualityScore >= 70) {
      qualityBadge = { text: "Fair", variant: "warning" };
    } else {
      qualityBadge = { text: "Poor", variant: "danger" };
    }
  }

  const pipelineStatus =
    hasPipelines && failedRuns > 0
      ? "danger"
      : hasPipelineIssues
        ? "warning"
        : "default";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        title="Resolved Entities"
        value={totalEntities}
        subtitle={hasEntities ? "Matched records" : "No records yet"}
        icon={<Icons.ResolvedEntities />}
        badge={
          hasEntities
            ? { text: "Active", variant: "success" }
            : { text: "None yet", variant: "neutral" }
        }
        isLoading={isLoading}
        isCached={isCached}
      />

      <KpiCard
        title="Active Connectors"
        value={totalConnections}
        subtitle={hasConnections ? "Connected sources" : "No sources connected"}
        icon={<Icons.DataConnections />}
        badge={
          hasConnections
            ? { text: "Online", variant: "success" }
            : { text: "None yet", variant: "neutral" }
        }
        isLoading={isLoading}
        isCached={isCached}
      />

      <KpiCard
        title="Pipeline Executions"
        value={totalPipelines}
        subtitle={
          hasPipelines && summary?.pipelineHealth
            ? `${summary.pipelineHealth.completed} completed · ${summary.pipelineHealth.running} running`
            : "No runs yet"
        }
        icon={<Icons.PipelineExecutions />}
        status={pipelineStatus}
        badge={
          hasPipelines
            ? {
                text: hasPipelineIssues ? "Issues" : "Healthy",
                variant: hasPipelineIssues ? "warning" : "success",
              }
            : { text: "None yet", variant: "neutral" }
        }
        isLoading={isLoading}
        isCached={isCached}
      />

      <KpiCard
        title="Data Quality Score"
        value={
          hasNumericScore &&
          rawQualityScore !== undefined &&
          rawQualityScore !== null
            ? `${rawQualityScore.toFixed(1)}%`
            : "–"
        }
        subtitle={
          hasNumericScore ? "Completeness & accuracy" : "No data evaluated"
        }
        icon={<Icons.DataQuality />}
        badge={qualityBadge}
        isLoading={isLoading}
        isCached={isCached}
      />
    </div>
  );
};
