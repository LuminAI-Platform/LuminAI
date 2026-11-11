import React from "react";
import { Network, Database, Play, ShieldCheck } from "lucide-react";
import { KpiCard } from "./KpiCard";
import type { DashboardSummary } from "../useDashboardData";

interface DashboardKpiRowProps {
  summary: DashboardSummary | undefined;
  isLoading: boolean;
}

export const DashboardKpiRow: React.FC<DashboardKpiRowProps> = ({
  summary,
  isLoading,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        title="Resolved Entities"
        value={summary?.totalEntities ?? 0}
        subtitle="Golden semantic records"
        icon={<Network className="w-4 h-4" />}
        badge={{ text: "Active", variant: "success" }}
        isLoading={isLoading}
      />

      <KpiCard
        title="Active Connectors"
        value={summary?.totalConnections ?? 0}
        subtitle="Data sources integrated"
        icon={<Database className="w-4 h-4" />}
        badge={{ text: "Online", variant: "info" }}
        isLoading={isLoading}
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
          text:
            (summary?.pipelineHealth?.failed ?? 0) > 0 ? "Issues" : "Healthy",
          variant:
            (summary?.pipelineHealth?.failed ?? 0) > 0 ? "warning" : "success",
        }}
        isLoading={isLoading}
      />

      <KpiCard
        title="Data Quality Score"
        value={summary ? `${summary.dataQualityScore}%` : "98.5%"}
        subtitle="Completeness & accuracy"
        icon={<ShieldCheck className="w-4 h-4" />}
        isLoading={isLoading}
      />
    </div>
  );
};
