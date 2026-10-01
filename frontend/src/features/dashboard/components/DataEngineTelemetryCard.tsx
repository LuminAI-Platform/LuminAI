import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Cpu,
  Activity,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { apiFetch } from "../../../lib/api";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";

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
  const { data, isLoading, refetch, isRefetching } =
    useQuery<EngineMetricsResponse>({
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
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
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
          {health?.latencyMs !== undefined && (
            <span className="text-[11px] font-mono text-zinc-400 bg-zinc-950 px-2 py-1 rounded border border-zinc-800">
              {health.latencyMs}ms RTT
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            leftIcon={
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`}
              />
            }
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-lg">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>Records Processed</span>
          </div>
          <div className="text-lg font-bold font-mono text-zinc-100">
            {stats?.recordsProcessed?.toLocaleString() ?? "—"}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            Streaming & batch ingest
          </div>
        </div>

        <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-lg">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Success Rate</span>
          </div>
          <div className="text-lg font-bold font-mono text-emerald-400">
            {stats?.successRate !== undefined
              ? `${stats.successRate.toFixed(1)}%`
              : "—"}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            {stats?.totalRuns ?? 0} total executions
          </div>
        </div>

        <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-lg">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Avg Polars Compute</span>
          </div>
          <div className="text-lg font-bold font-mono text-zinc-100">
            {stats?.avgDuration !== undefined
              ? `${stats.avgDuration.toFixed(2)}s`
              : "—"}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            Vectorized batch latency
          </div>
        </div>

        <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-lg">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>Data Quality Index</span>
          </div>
          <div className="text-lg font-bold font-mono text-blue-400">
            {quality?.overallScore !== undefined
              ? `${quality.overallScore.toFixed(1)}%`
              : "—"}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            Completeness & deduplication
          </div>
        </div>
      </div>

      {/* Quality Dimensions Breakdown */}
      {quality && (
        <div className="bg-zinc-950/40 border border-zinc-800/60 rounded-lg p-3">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span className="flex items-center gap-1 font-medium text-zinc-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Engine Data Quality Dimensions
            </span>
            <span className="text-[11px] font-mono text-zinc-500">
              Real-time audit
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="flex flex-col">
              <span className="text-[11px] text-zinc-500">Completeness</span>
              <span className="font-mono text-zinc-200 font-semibold">
                {quality.completeness?.toFixed(1)}%
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-zinc-500">Uniqueness</span>
              <span className="font-mono text-zinc-200 font-semibold">
                {quality.uniqueness?.toFixed(1)}%
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-zinc-500">Consistency</span>
              <span className="font-mono text-zinc-200 font-semibold">
                {quality.consistency?.toFixed(1)}%
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-zinc-500">Timeliness</span>
              <span className="font-mono text-zinc-200 font-semibold">
                {quality.timeliness?.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
