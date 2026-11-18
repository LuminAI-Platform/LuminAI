import React from "react";
import { KpiCard } from "./KpiCard";
import type { DashboardSummary } from "../useDashboardData";
import { Icons } from "../../../lib/icons";

interface DashboardKpiRowProps {
  summary: DashboardSummary | undefined;
  isLoading: boolean;
  isCached?: boolean;
}

/**
 * Dashboard KPI Metric Cards Row
 *
 * Rules:
 * - If the count/metric is 0, display "None yet" in a neutral badge.
 * - Reserve green ("success") badges strictly for non-zero, active/operational metrics.
 * - When no pipeline executions exist, show "–" or "No runs yet", never misleading zeros or dummy scores.
 * - Card tile icons are tinted with the status color (danger for failed runs, warning for attention) only when the card needs attention.
 */
export const DashboardKpiRow: React.FC<DashboardKpiRowProps> = ({
  summary,
  isLoading,
  isCached = false,
}) => {
  const totalEntities = summary?.totalEntities ?? 0;
  const totalConnections = summary?.totalConnections ?? 0;
  const totalPipelines = summary?.totalPipelines ?? 0;
  const failedRuns = summary?.pipelineHealth?.failed ?? 0;
  const hasPipelineIssues = failedRuns > 0;

  const hasEntities = totalEntities > 0;
  const hasConnections = totalConnections > 0;
  const hasPipelines = totalPipelines > 0;

  const hasEvaluations =
    hasPipelines &&
    typeof summary?.dataQualityScore === "number" &&
    summary.dataQualityScore > 0;

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
          hasEvaluations && summary?.dataQualityScore !== undefined
            ? `${summary.dataQualityScore.toFixed(1)}%`
            : "–"
        }
        subtitle={hasEvaluations ? "Completeness & accuracy" : "No runs yet"}
        icon={<Icons.DataQuality />}
        badge={
          hasEvaluations
            ? {
                text: `${summary.dataQualityScore.toFixed(0)}% Good`,
                variant:
                  summary.dataQualityScore >= 90
                    ? "success"
                    : summary.dataQualityScore >= 70
                      ? "warning"
                      : "danger",
              }
            : { text: "None yet", variant: "neutral" }
        }
        isLoading={isLoading}
        isCached={isCached}
      />
    </div>
  );
};
