import React, { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cpu, Info, AlertTriangle } from "../../../lib/icons";
import { apiFetch } from "../../../lib/api";
import { Badge } from "../../../components/ui/Badge";
import { Tooltip } from "../../../components/ui/Tooltip";
import type {
  DashboardSummary,
  EngineMetricsResponse,
} from "../../../pages/dashboard/useDashboardData";
import { DataQualityDimensionsPanel } from "./DataQualityDimensionsPanel";

export interface DataEngineTelemetryCardProps {
  summary?: DashboardSummary;
  engineMetrics?: EngineMetricsResponse;
}

export const DataEngineTelemetryCardContent: React.FC<{
  summary?: DashboardSummary;
  engineMetrics?: EngineMetricsResponse;
}> = ({ summary, engineMetrics }) => {
  const health = engineMetrics?.engineHealth;
  const stats = engineMetrics?.pipelineStats;
  const quality = engineMetrics?.dataQuality;

  const isOnline = health?.status?.toUpperCase() === "ONLINE";
  const isDegraded = health?.status?.toUpperCase() === "DEGRADED";

  // Check live runs vs platform history
  const liveRuns = stats?.totalRuns ?? 0;
  const platformRuns = summary?.totalPipelines ?? 0;
  const platformCompleted = summary?.pipelineHealth?.completed ?? 0;
  const hasCompletedRuns = platformCompleted > 0 || platformRuns > 0;
  const hasLiveRuns = liveRuns > 0;

  // Sync discrepancy check
  const runsMismatch =
    summary?.totalPipelines !== undefined &&
    stats?.totalRuns !== undefined &&
    summary.totalPipelines !== stats.totalRuns;

  useEffect(() => {
    if (import.meta.env.DEV && runsMismatch) {
      console.warn(
        `[Processing Engine] Figures may be out of sync. Platform history reports ${summary?.totalPipelines} runs, while engine live telemetry reports ${stats?.totalRuns ?? 0} runs.`,
      );
    }
  }, [runsMismatch, summary?.totalPipelines, stats?.totalRuns]);

  // Status badge text & variant
  let statusBadgeText = "Offline";
  let statusBadgeVariant: "success" | "warning" | "neutral" = "neutral";
  if (isOnline) {
    statusBadgeText = `Online${health?.version ? ` v${health.version}` : ""}`;
    statusBadgeVariant = "success";
  } else if (isDegraded) {
    statusBadgeText = "Degraded";
    statusBadgeVariant = "warning";
  }

  // Records evaluated count
  const recordsEvaluated =
    quality?.recordsEvaluated ??
    stats?.evaluatedCount ??
    (hasLiveRuns ? stats?.recordsProcessed : undefined);

  // Avg run time display
  const hasAvgDuration =
    stats?.avgDuration !== undefined && stats.avgDuration > 0;
  const avgRunTimeText = hasAvgDuration
    ? `${stats!.avgDuration.toFixed(2)}s${
        stats?.p95Duration && stats.p95Duration > 0
          ? ` (p95 ${stats.p95Duration.toFixed(2)}s)`
          : ""
      }`
    : "–";

  const techTooltip = `Python Data Engine & Polars${health?.version ? ` (v${health.version})` : ""}`;
  const syncTooltip = `Platform history reports ${summary?.totalPipelines} runs, while engine live telemetry reports ${stats?.totalRuns ?? 0} runs.`;

  return (
    <div className="bg-surface border border-border rounded-lg p-5 transition-colors shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-border gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-surface-subtle border border-border text-text-secondary flex items-center justify-center shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-text tracking-tight">
                Processing Engine
              </h3>
              <Tooltip label={techTooltip} side="top">
                <button
                  type="button"
                  title={techTooltip}
                  className="text-text-secondary hover:text-text transition-colors p-0.5 rounded cursor-help focus:outline-hidden focus:ring-1 focus:ring-primary"
                  aria-label="Engine technology details"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </Tooltip>
              <Badge variant={statusBadgeVariant}>{statusBadgeText}</Badge>
              {import.meta.env.DEV && (
                <span className="text-[11px] font-mono text-text-tertiary bg-surface-subtle px-1.5 py-0.5 rounded border border-border">
                  :8000
                </span>
              )}
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              Cleans, deduplicates and matches your records.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {runsMismatch && (
            <Tooltip label={syncTooltip} side="top">
              <span
                title={syncTooltip}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-warning bg-warning/10 border border-warning/30 px-2 py-1 rounded cursor-help"
              >
                <AlertTriangle className="w-3 h-3 text-warning shrink-0" />
                Figures may be out of sync
              </span>
            </Tooltip>
          )}
          <span className="text-xs text-text-secondary bg-surface-subtle px-2.5 py-1 rounded border border-border">
            Avg run time: {avgRunTimeText}
          </span>
          {health?.latencyMs !== undefined && (
            <Tooltip label="Round-trip time to the engine" side="top">
              <span
                title="Round-trip time to the engine"
                className="text-xs text-text-secondary bg-surface-subtle px-2 py-1 rounded border border-border cursor-help"
              >
                {health.latencyMs}ms Response
              </span>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Quality Dimensions Breakdown */}
      <DataQualityDimensionsPanel
        quality={quality}
        hasLiveRuns={hasLiveRuns}
        hasCompletedRuns={hasCompletedRuns}
        liveRuns={liveRuns}
        recordsEvaluated={recordsEvaluated}
      />
    </div>
  );
};

const DataEngineTelemetryCardWithFetch: React.FC<{
  summary?: DashboardSummary;
}> = ({ summary }) => {
  const { data } = useQuery<EngineMetricsResponse>({
    queryKey: ["engine", "metrics"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/engine/metrics", {
        headers: { "X-Suppress-Toast": "true" },
      });
      return res.json();
    },
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  return (
    <DataEngineTelemetryCardContent summary={summary} engineMetrics={data} />
  );
};

export const DataEngineTelemetryCard: React.FC<
  DataEngineTelemetryCardProps
> = ({ summary, engineMetrics: externalEngineMetrics }) => {
  if (externalEngineMetrics !== undefined) {
    return (
      <DataEngineTelemetryCardContent
        summary={summary}
        engineMetrics={externalEngineMetrics}
      />
    );
  }

  return <DataEngineTelemetryCardWithFetch summary={summary} />;
};
