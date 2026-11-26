import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";
import {
  mergeActivityWithRuns,
  type PipelineRunSummary,
} from "./components/activityFeedUtils";
import type {
  DashboardSummary,
  EngineMetricsResponse,
  SyncDiscrepancy,
  TimeSeriesPoint,
  ActivityItem,
} from "./dashboardTypes";

export * from "./dashboardTypes";

export function useDashboardData() {
  const [timeRange, setTimeRange] = useState<"7d" | "14d" | "30d">("7d");
  const [fallbackTime] = useState(() => Date.now());

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

  const cachedAtTime = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(timestamp));

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
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const {
    data: activity = [],
    isLoading: isActivityLoading,
    refetch: refetchActivity,
    isRefetching: isActivityRefetching,
  } = useQuery<ActivityItem[]>({
    queryKey: ["dashboard", "activity"],
    queryFn: async () => {
      const [actRes, runsRes] = await Promise.allSettled([
        apiFetch("/api/v1/dashboard/activity?limit=25", {
          headers: { "X-Suppress-Toast": "true" },
        }),
        apiFetch("/api/v1/pipelines/runs?page=0&size=25", {
          headers: { "X-Suppress-Toast": "true" },
        }),
      ]);
      if (actRes.status !== "fulfilled") throw actRes.reason;
      const items = (await actRes.value.json()) as ActivityItem[];
      if (runsRes.status !== "fulfilled") return items;
      const runsPayload = (await runsRes.value.json()) as
        | PipelineRunSummary[]
        | { content?: PipelineRunSummary[] };
      const runs = Array.isArray(runsPayload)
        ? runsPayload
        : (runsPayload?.content ?? []);
      return mergeActivityWithRuns(items, runs);
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

  const syncDiscrepancy = useMemo<SyncDiscrepancy>(() => {
    const summaryPipelines = summary?.totalPipelines;
    const engineRuns = engineMetrics?.pipelineStats?.totalRuns;
    const runsMismatch =
      summaryPipelines !== undefined &&
      engineRuns !== undefined &&
      summaryPipelines !== engineRuns;

    const summaryEntities = summary?.totalEntities;
    const engineEntities =
      engineMetrics?.entityStats?.totalEntities ??
      engineMetrics?.entityStats?.totalGoldenRecords;
    const entitiesMismatch =
      summaryEntities !== undefined &&
      engineEntities !== undefined &&
      summaryEntities !== engineEntities;

    let message: string | undefined;
    if (runsMismatch && entitiesMismatch) {
      message = `Runs (${summaryPipelines} platform vs ${engineRuns} engine) and entities (${summaryEntities} vs ${engineEntities}) are out of sync.`;
    } else if (runsMismatch) {
      message = `Platform history reports ${summaryPipelines} runs, while engine live telemetry reports ${engineRuns} runs.`;
    } else if (entitiesMismatch) {
      message = `Platform reports ${summaryEntities} entities, while engine reports ${engineEntities} entities.`;
    }

    if (import.meta.env.DEV && (runsMismatch || entitiesMismatch)) {
      console.warn(
        `[Dashboard Sync Discrepancy] Figures may be out of sync between core backend and engine:`,
        { summaryPipelines, engineRuns, summaryEntities, engineEntities },
      );
    }

    return {
      runsMismatch,
      entitiesMismatch,
      message,
    };
  }, [summary, engineMetrics]);

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
