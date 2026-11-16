import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Cpu } from "lucide-react";
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

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-zinc-800 border border-zinc-700/60 text-zinc-300 flex items-center justify-center">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-100 tracking-tight">
                Python Data Engine & Polars Telemetry
              </h3>
              <Badge variant={isOnline ? "success" : "warning"}>
                {isOnline ? "ONLINE · :8000" : "STANDBY"}
              </Badge>
            </div>
            <p className="text-xs text-zinc-400">
              High-throughput columnar execution, deduplication & entity
              resolution
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {stats?.avgDuration !== undefined && (
            <span className="text-xs text-zinc-400 bg-zinc-950 px-2.5 py-1 rounded border border-zinc-800">
              Avg Compute: {stats.avgDuration.toFixed(2)}s
            </span>
          )}
          {health?.latencyMs !== undefined && (
            <span className="text-xs text-zinc-400 bg-zinc-950 px-2 py-1 rounded border border-zinc-800">
              {health.latencyMs}ms RTT
            </span>
          )}
        </div>
      </div>

      {/* Quality Dimensions Breakdown */}
      {quality && (
        <div className="bg-zinc-950/40 border border-zinc-800 rounded-lg p-3">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span className="font-medium text-zinc-300">
              Engine Data Quality Dimensions
            </span>
            {stats?.recordsProcessed !== undefined && (
              <span className="text-[11px] text-zinc-500">
                {stats.recordsProcessed.toLocaleString()} records evaluated
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="flex flex-col">
              <span className="text-[11px] text-zinc-500">Completeness</span>
              <span className="text-zinc-200 font-semibold">
                {quality.completeness?.toFixed(1)}%
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-zinc-500">Uniqueness</span>
              <span className="text-zinc-200 font-semibold">
                {quality.uniqueness?.toFixed(1)}%
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-zinc-500">Consistency</span>
              <span className="text-zinc-200 font-semibold">
                {quality.consistency?.toFixed(1)}%
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-zinc-500">Timeliness</span>
              <span className="text-zinc-200 font-semibold">
                {quality.timeliness?.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
