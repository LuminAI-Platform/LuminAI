import React from "react";
import { Network, Database, Play, ShieldCheck } from "lucide-react";
import { KpiCard } from "./KpiCard";
import type { DashboardSummary } from "../useDashboardData";

interface DashboardKpiRowProps {
  summary: DashboardSummary | undefined;
  isLoading: boolean;
  isCached?: boolean;
  cachedAt?: string;
}

/**
 * Dashboard KPI Metric Cards Row
 *
 * Design Rule 3: Use one color per meaning. "Active", "Online", and "Healthy"
 * all represent healthy operational states and therefore all use the same "success" token.
 * Design Rule 2: Never use color alone for status; always pair with a word or icon.
 */
export const DashboardKpiRow: React.FC<DashboardKpiRowProps> = ({
  summary,
  isLoading,
  isCached = false,
  cachedAt,
}) => {
  const hasPipelineIssues = (summary?.pipelineHealth?.failed ?? 0) > 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        title="Resolved Entities"
        value={summary?.totalEntities ?? 0}
        subtitle="Matched records"
        icon={<Network className="w-4 h-4" />}
        badge={{ text: "Active", variant: "success" }}
        isLoading={isLoading}
        isCached={isCached}
        cachedAt={cachedAt}
      />

      <KpiCard
        title="Active Connectors"
        value={summary?.totalConnections ?? 0}
        subtitle="Connected sources"
        icon={<Database className="w-4 h-4" />}
        badge={{ text: "Online", variant: "success" }}
        isLoading={isLoading}
        isCached={isCached}
        cachedAt={cachedAt}
      />

      <KpiCard
        title="Pipeline Executions"
        value={summary?.totalPipelines ?? 0}
        subtitle={
          summary?.pipelineHealth
            ? `${summary.pipelineHealth.completed} completed · ${summary.pipelineHealth.running} running`
            : "Execution history"
        }
        icon={<Play className="w-4 h-4" />}
        badge={{
          text: hasPipelineIssues ? "Issues" : "Healthy",
          variant: hasPipelineIssues ? "warning" : "success",
        }}
        isLoading={isLoading}
        isCached={isCached}
        cachedAt={cachedAt}
      />

      <KpiCard
        title="Data Quality Score"
        value={summary ? `${summary.dataQualityScore}%` : "98.5%"}
        subtitle="Completeness & accuracy"
        icon={<ShieldCheck className="w-4 h-4" />}
        isLoading={isLoading}
        isCached={isCached}
        cachedAt={cachedAt}
      />
    </div>
  );
};
