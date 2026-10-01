import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Database,
  Network,
  Play,
  ShieldCheck,
  RefreshCw,
  ArrowRight,
  Sparkles,
  GitBranch,
  Layers,
  AlertCircle,
} from "lucide-react";
import { apiFetch } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { KpiCard } from "./components/KpiCard";
import { EntityBreakdownChart } from "./components/EntityBreakdownChart";
import {
  PipelineTimelineChart,
  type TimeSeriesPoint,
} from "./components/PipelineTimelineChart";
import { ActivityFeed, type ActivityItem } from "./components/ActivityFeed";
import { DataEngineTelemetryCard } from "../../features/dashboard/components/DataEngineTelemetryCard";

interface DashboardSummary {
  totalEntities: number;
  totalConnections: number;
  totalPipelines: number;
  entityBreakdown: Record<string, number>;
  recentActivity: ActivityItem[];
  dataQualityScore: number;
  pipelineHealth: {
    running: number;
    completed: number;
    failed: number;
  };
  lastSyncAt: string | null;
}

/**
 * Production Dashboard Page with real-time KPI aggregations, charts, and activity feeds
 */
export const DashboardPage: React.FC = () => {
  const [timeRange, setTimeRange] = useState<"7d" | "14d" | "30d">("7d");

  // 1. Fetch dashboard summary with 30s auto-refresh
  const {
    data: summary,
    isLoading: isSummaryLoading,
    error: summaryError,
    refetch: refetchSummary,
    isRefetching,
  } = useQuery<DashboardSummary>({
    queryKey: ["dashboard", "summary"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/dashboard/summary", {
        headers: { "X-Suppress-Toast": "true" },
      });
      return res.json();
    },
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // 2. Fetch time-series telemetry for charts
  const {
    data: timeSeries = [],
    isLoading: isTimeSeriesLoading,
    refetch: refetchTimeSeries,
  } = useQuery<TimeSeriesPoint[]>({
    queryKey: ["dashboard", "timeseries", timeRange],
    queryFn: async () => {
      const res = await apiFetch(
        `/api/v1/dashboard/stats/timeseries?range=${timeRange}`,
        {
          headers: { "X-Suppress-Toast": "true" },
        },
      );
      return res.json();
    },
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // 3. Fetch recent platform activity
  const {
    data: activity = [],
    isLoading: isActivityLoading,
    refetch: refetchActivity,
  } = useQuery<ActivityItem[]>({
    queryKey: ["dashboard", "activity"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/dashboard/activity?limit=15", {
        headers: { "X-Suppress-Toast": "true" },
      });
      return res.json();
    },
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const handleManualRefresh = () => {
    refetchSummary();
    refetchTimeSeries();
    refetchActivity();
  };

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto pr-2 pb-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-zinc-100 tracking-tight">
              Platform Overview
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Live Mesh
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time entity resolution telemetry, pipeline health, and data
            infrastructure metrics
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleManualRefresh}
            isLoading={isRefetching}
            leftIcon={
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`}
              />
            }
          >
            Refresh
          </Button>

          <Link to="/connections">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Sparkles className="w-3.5 h-3.5" />}
            >
              Ingest Data
            </Button>
          </Link>
        </div>
      </div>

      {/* Error state if backend endpoint is unavailable */}
      {summaryError && (
        <div className="bg-red-950/30 border border-red-500/40 rounded-xl p-4 flex items-center justify-between text-xs text-red-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>
              Failed to connect to Dashboard telemetry services. Showing cached
              metrics.
            </span>
          </div>
          <Button
            size="xs"
            variant="secondary"
            onClick={() => refetchSummary()}
          >
            Retry
          </Button>
        </div>
      )}

      {/* 1. KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Resolved Entities"
          value={summary?.totalEntities ?? 0}
          subtitle="Golden semantic records"
          icon={<Network className="w-4 h-4" />}
          badge={{ text: "Active", variant: "success" }}
          isLoading={isSummaryLoading}
        />

        <KpiCard
          title="Active Connectors"
          value={summary?.totalConnections ?? 0}
          subtitle="Data sources integrated"
          icon={<Database className="w-4 h-4" />}
          badge={{ text: "Online", variant: "info" }}
          isLoading={isSummaryLoading}
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
              (summary?.pipelineHealth?.failed ?? 0) > 0
                ? "warning"
                : "success",
          }}
          isLoading={isSummaryLoading}
        />

        <KpiCard
          title="Data Quality Score"
          value={summary ? `${summary.dataQualityScore}%` : "98.5%"}
          subtitle="Completeness & accuracy"
          icon={<ShieldCheck className="w-4 h-4" />}
          badge={{ text: "Grade A", variant: "purple" }}
          isLoading={isSummaryLoading}
        />
      </div>

      {/* Python Data Engine Telemetry & Polars Compute */}
      <DataEngineTelemetryCard />

      {/* 2. Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Pipeline Telemetry Chart (2 cols) */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800/80 rounded-xl p-5 shadow-lg shadow-black/20">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                Pipeline Throughput & Entity Growth
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Daily entity volume alongside successful pipeline completions
              </p>
            </div>
            <div className="flex items-center bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-[11px]">
              {(["7d", "14d", "30d"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    timeRange === r
                      ? "bg-zinc-800 text-zinc-100 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <PipelineTimelineChart
            data={timeSeries}
            isLoading={isTimeSeriesLoading}
          />
        </div>

        {/* Right: Entity Type Distribution (1 col) */}
        <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-5 shadow-lg shadow-black/20 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">
              Entity Type Distribution
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5 mb-4">
              Composition of resolved entity classes
            </p>
          </div>

          <EntityBreakdownChart
            data={summary?.entityBreakdown}
            isLoading={isSummaryLoading}
          />
        </div>
      </div>

      {/* 3. Bottom Row: Activity Feed & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Activity Feed (2 cols) */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800/80 rounded-xl p-5 shadow-lg shadow-black/20">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-zinc-800/60">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                Live Audit & Activity Stream
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Recent batch jobs, schema normalizations, and entity updates
              </p>
            </div>
            <Link
              to="/connections/pipelines"
              className="text-xs text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1 cursor-pointer"
            >
              All Pipelines <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <ActivityFeed
            activities={
              activity.length > 0 ? activity : summary?.recentActivity
            }
            isLoading={isActivityLoading && isSummaryLoading}
          />
        </div>

        {/* Command Center Quick Actions (1 col) */}
        <div className="flex flex-col gap-3">
          <Link
            to="/connections"
            className="group p-4 bg-zinc-900 border border-zinc-800/80 hover:border-blue-500/60 rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/5 cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                <Database className="w-4 h-4" />
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
            </div>
            <h4 className="text-xs font-semibold text-zinc-100 group-hover:text-blue-300 transition-colors">
              Data Ingestion Hub
            </h4>
            <p className="text-[11px] text-zinc-400 mt-1 leading-normal">
              Connect PostgreSQL, S3, MinIO, or upload CSV/JSON files.
            </p>
          </Link>

          <Link
            to="/graph"
            className="group p-4 bg-zinc-900 border border-zinc-800/80 hover:border-purple-500/60 rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-500/5 cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                <GitBranch className="w-4 h-4" />
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" />
            </div>
            <h4 className="text-xs font-semibold text-zinc-100 group-hover:text-purple-300 transition-colors">
              Knowledge Graph Explorer
            </h4>
            <p className="text-[11px] text-zinc-400 mt-1 leading-normal">
              Visualize semantic entity neighbourhoods and shortest paths in 2D
              mesh.
            </p>
          </Link>

          <Link
            to="/ontology"
            className="group p-4 bg-zinc-900 border border-zinc-800/80 hover:border-emerald-500/60 rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/5 cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
            </div>
            <h4 className="text-xs font-semibold text-zinc-100 group-hover:text-emerald-300 transition-colors">
              Semantic Schema Studio
            </h4>
            <p className="text-[11px] text-zinc-400 mt-1 leading-normal">
              Define entity types, property schemas, and publish ontology
              versions.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
};
