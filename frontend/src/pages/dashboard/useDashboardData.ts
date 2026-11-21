import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";
import type { TimeSeriesPoint } from "./components/PipelineTimelineChart";
import type { ActivityItem } from "./components/ActivityFeed";
import {
  type DashboardSummary,
  type EngineHealth,
  type PipelineStats,
  type DataQuality,
  type EntityStats,
  type EngineMetricsResponse,
  type SyncDiscrepancy,
  computeSyncDiscrepancy,
} from "./dashboardTypes";

export type {
  DashboardSummary,
  EngineHealth,
  PipelineStats,
  DataQuality,
  EntityStats,
  EngineMetricsResponse,
  SyncDiscrepancy,
};

export function useDashboardData() {
  const [timeRange, setTimeRange] = useState<"7d" | "14d" | "30d">("7d");
  const [fallbackTime] = useState(() => Date.now());

  // 1. Fetch dashboard summary with adaptive interval and tab-visibility pause
  const {
    data: summary,
    isLoading: isSummaryLoading,
    error: summaryError,
    refetch: refetchSummary,
    isRefetching: isSummaryRefetching,
    dataUpdatedAt: summaryUpdatedAt,
  } = useQuery<DashboardSummary>({
    queryKey: ["dashboard", "summary"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/dashboard/summary", {
        headers: { "X-Suppress-Toast": "true" },
      });
      return res.json();
    },
    refetchInterval: (query) => {
      if (typeof document !== "undefined" && document.hidden) {
        return false;
      }
      const data = query.state.data as DashboardSummary | undefined;
      const hasRunning =
        (data?.pipelineHealth?.running ?? 0) > 0 ||
        data?.recentActivity?.some(
          (item) => item.status?.toUpperCase() === "RUNNING",
        );
      return hasRunning ? 5000 : 60000;
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Log raw technical errors to console rather than exposing them in production UI
  useEffect(() => {
    if (summaryError) {
      console.error("[Dashboard] Failed to fetch live metrics:", summaryError);
    }
  }, [summaryError]);

  const timestamp =
    summaryUpdatedAt > 0
      ? summaryUpdatedAt
      : summary?.lastSyncAt
        ? new Date(summary.lastSyncAt).getTime()
        : fallbackTime;

  const cachedAtTime = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(timestamp));

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
        { headers: { "X-Suppress-Toast": "true" } },
      );
      return res.json();
    },
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // 3. Fetch recent platform activity with adaptive interval & background pause
  const {
    data: activity = [],
    isLoading: isActivityLoading,
    refetch: refetchActivity,
    isRefetching: isActivityRefetching,
  } = useQuery<ActivityItem[]>({
    queryKey: ["dashboard", "activity"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/dashboard/activity?limit=25", {
        headers: { "X-Suppress-Toast": "true" },
      });
      return res.json();
    },
    refetchInterval: (query) => {
      if (typeof document !== "undefined" && document.hidden) {
        return false;
      }
      const data = query.state.data as ActivityItem[] | undefined;
      const hasRunning =
        Array.isArray(data) &&
        data.some((item) => item.status?.toUpperCase() === "RUNNING");
      return hasRunning ? 5000 : 30000;
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // 4. Fetch engine telemetry metrics using the same polling cadence
  const {
    data: engineMetrics,
    isLoading: isEngineMetricsLoading,
    error: engineMetricsError,
    refetch: refetchEngineMetrics,
  } = useQuery<EngineMetricsResponse>({
    queryKey: ["engine", "metrics"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/engine/metrics", {
        headers: { "X-Suppress-Toast": "true" },
      });
      return res.json();
    },
    refetchInterval: () => {
      if (typeof document !== "undefined" && document.hidden) {
        return false;
      }
      return 60000;
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const hasRunningRuns = useMemo(() => {
    const activityRunning = activity.some(
      (item) => item.status?.toUpperCase() === "RUNNING",
    );
    const summaryRunning = (summary?.pipelineHealth?.running ?? 0) > 0;
    return activityRunning || summaryRunning;
  }, [activity, summary]);

  const syncDiscrepancy = useMemo<SyncDiscrepancy>(
    () => computeSyncDiscrepancy(summary, engineMetrics),
    [summary, engineMetrics],
  );

  useEffect(() => {
    if (
      import.meta.env.DEV &&
      (syncDiscrepancy.runsMismatch || syncDiscrepancy.entitiesMismatch)
    ) {
      console.warn(
        "[Dashboard Sync Discrepancy] Figures may be out of sync between core backend and engine:",
        {
          summaryPipelines: summary?.totalPipelines,
          engineRuns: engineMetrics?.pipelineStats?.totalRuns,
          summaryEntities: summary?.totalEntities,
          engineEntities:
            engineMetrics?.entityStats?.totalEntities ??
            engineMetrics?.entityStats?.totalGoldenRecords,
        },
      );
    }
  }, [syncDiscrepancy, summary, engineMetrics]);

  // When tab transitions back from hidden to visible, immediately refresh
  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refetchActivity();
        refetchSummary();
        refetchEngineMetrics();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refetchActivity, refetchSummary, refetchEngineMetrics]);

  const handleManualRefresh = useCallback(() => {
    refetchSummary();
    refetchTimeSeries();
    refetchActivity();
    refetchEngineMetrics();
  }, [
    refetchSummary,
    refetchTimeSeries,
    refetchActivity,
    refetchEngineMetrics,
  ]);

  const isRefetching = isSummaryRefetching || isActivityRefetching;

  return {
    timeRange,
    setTimeRange,
    summary,
    isSummaryLoading,
    summaryError,
    engineMetrics,
    isEngineMetricsLoading,
    engineMetricsError,
    syncDiscrepancy,
    cachedAtTime,
    isRefetching,
    timeSeries,
    isTimeSeriesLoading,
    activity,
    isActivityLoading,
    hasRunningRuns,
    handleManualRefresh,
    refetchSummary,
    refetchActivity,
    refetchEngineMetrics,
  };
}
