import React from "react";
import { Network, Database, Play, ShieldCheck } from "lucide-react";
import { KpiCard } from "./KpiCard";
import type { DashboardSummary } from "../useDashboardData";

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
 */
export const DashboardKpiRow: React.FC<DashboardKpiRowProps> = ({
  summary,
  isLoading,
  isCached = false,
}) => {
  const totalEntities = summary?.totalEntities ?? 0;
  const totalConnections = summary?.totalConnections ?? 0;
  const totalPipelines = summary?.totalPipelines ?? 0;
  const hasPipelineIssues = (summary?.pipelineHealth?.failed ?? 0) > 0;

  const hasEntities = totalEntities > 0;
  const hasConnections = totalConnections > 0;
  const hasPipelines = totalPipelines > 0;

  const hasEvaluations =
    hasPipelines &&
    typeof summary?.dataQualityScore === "number" &&
    summary.dataQualityScore > 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        title="Resolved Entities"
        value={totalEntities}
        subtitle={hasEntities ? "Matched records" : "No records yet"}
        icon={<Network className="w-4 h-4" />}
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
        icon={<Database className="w-4 h-4" />}
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
        icon={<Play className="w-4 h-4" />}
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
        icon={<ShieldCheck className="w-4 h-4" />}
        badge={
          hasEvaluations
            ? { text: "Healthy", variant: "success" }
            : { text: "None yet", variant: "neutral" }
        }
        isLoading={isLoading}
        isCached={isCached}
      />
    </div>
  );
};
