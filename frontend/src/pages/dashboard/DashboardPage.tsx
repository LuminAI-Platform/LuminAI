import React from "react";
import { Link } from "@tanstack/react-router";
import { RefreshCw, ArrowRight, Layers, AlertCircle } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { EntityBreakdownChart } from "./components/EntityBreakdownChart";
import { PipelineTimelineChart } from "./components/PipelineTimelineChart";
import { ActivityFeed } from "./components/ActivityFeed";
import { DataEngineTelemetryCard } from "../../features/dashboard/components/DataEngineTelemetryCard";
import { PageHeader } from "../../components/layout/PageHeader";
import { useDashboardData } from "./useDashboardData";
import { DashboardKpiRow } from "./components/DashboardKpiRow";
import { DashboardQuickActions } from "./components/DashboardQuickActions";

export const DashboardPage: React.FC = () => {
  const {
    timeRange,
    setTimeRange,
    summary,
    isSummaryLoading,
    summaryError,
    timeSeries,
    isTimeSeriesLoading,
    activity,
    isActivityLoading,
    isRefetching,
    handleManualRefresh,
    refetchSummary,
  } = useDashboardData();

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto pr-2 pb-8">
      {/* Standard Page Header */}
      <PageHeader
        breadcrumbs={[{ label: "Dashboard" }]}
        title="Platform Overview"
        description="System status, connected data sources, pipeline executions, and resolved records."
        icon={<Layers className="w-5 h-5 text-zinc-300" />}
        actions={
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
        }
      />

      {summaryError && (
        <div className="bg-red-950/30 border border-red-500/40 rounded-lg p-4 flex items-center justify-between text-xs text-red-200">
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
      <DashboardKpiRow summary={summary} isLoading={isSummaryLoading} />

      {/* Python Data Engine Telemetry & Polars Compute */}
      <DataEngineTelemetryCard />

      {/* 2. Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-lg p-5">
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

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 flex flex-col justify-between">
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
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-lg p-5">
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
              to="/connections/pipeline"
              className="text-xs text-zinc-400 hover:text-zinc-200 font-medium inline-flex items-center gap-1 cursor-pointer"
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

        <DashboardQuickActions />
      </div>
    </div>
  );
};
