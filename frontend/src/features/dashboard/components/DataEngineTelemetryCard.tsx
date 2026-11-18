import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Cpu } from "../../../lib/icons";
import { apiFetch } from "../../../lib/api";
import { Badge } from "../../../components/ui/Badge";

interface EngineHealth {
  status: "ONLINE" | "STANDBY" | string;
  appName: string;
  version: string;
  latencyMs: number;
  message: string;
}

interface PipelineStats {
  totalRuns: number;
  successRate: number;
  avgDuration: number;
  recordsProcessed: number;
  lastRunAt?: string;
}

interface DataQuality {
  overallScore: number;
  completeness: number;
  uniqueness: number;
  consistency: number;
  timeliness: number;
}

interface EngineMetricsResponse {
  engineHealth?: EngineHealth;
  pipelineStats?: PipelineStats;
  dataQuality?: DataQuality;
  entityStats?: {
    totalEntities?: number;
  };
}

export const DataEngineTelemetryCard: React.FC = () => {
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

  const health = data?.engineHealth;
  const stats = data?.pipelineStats;
  const quality = data?.dataQuality;
  const isOnline = health?.status === "ONLINE";
  const hasRuns = (stats?.totalRuns ?? 0) > 0;

  return (
    <div className="bg-surface border border-border rounded-lg p-5 transition-colors shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-surface-subtle border border-border text-text-secondary flex items-center justify-center">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-text tracking-tight">
                Python Data Engine & Polars Telemetry
              </h3>
              <Badge variant={isOnline ? "success" : "neutral"}>
                {isOnline ? "ONLINE" : "STANDBY"}
              </Badge>
            </div>
            <p className="text-xs text-text-secondary">
              High-throughput columnar execution, deduplication & entity
              resolution
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary bg-surface-subtle px-2.5 py-1 rounded border border-border">
            Avg Compute:{" "}
            {hasRuns && stats?.avgDuration
              ? `${stats.avgDuration.toFixed(2)}s`
              : "–"}
          </span>
          {health?.latencyMs !== undefined && (
            <span className="text-xs text-text-secondary bg-surface-subtle px-2 py-1 rounded border border-border">
              {health.latencyMs}ms RTT
            </span>
          )}
        </div>
      </div>

      {/* Quality Dimensions Breakdown */}
      {quality && (
        <div className="bg-surface-subtle border border-border rounded-lg p-3">
          <div className="flex items-center justify-between text-xs text-text-secondary mb-2">
            <span className="font-medium text-text">
              Engine Data Quality Dimensions
            </span>
            <span className="text-[11px] text-text-secondary">
              {hasRuns && (stats?.recordsProcessed ?? 0) > 0
                ? `${stats!.recordsProcessed.toLocaleString()} records evaluated`
                : "No runs yet"}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="flex flex-col">
              <span className="text-[11px] text-text-secondary">
                Completeness
              </span>
              <span className="text-text font-semibold">
                {hasRuns && quality.completeness
                  ? `${quality.completeness.toFixed(1)}%`
                  : "–"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-text-secondary">
                Uniqueness
              </span>
              <span className="text-text font-semibold">
                {hasRuns && quality.uniqueness
                  ? `${quality.uniqueness.toFixed(1)}%`
                  : "–"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-text-secondary">
                Consistency
              </span>
              <span className="text-text font-semibold">
                {hasRuns && quality.consistency
                  ? `${quality.consistency.toFixed(1)}%`
                  : "–"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-text-secondary">
                Timeliness
              </span>
              <span className="text-text font-semibold">
                {hasRuns && quality.timeliness
                  ? `${quality.timeliness.toFixed(1)}%`
                  : "–"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
