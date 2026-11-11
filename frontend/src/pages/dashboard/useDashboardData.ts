import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";
import type { TimeSeriesPoint } from "./components/PipelineTimelineChart";
import type { ActivityItem } from "./components/ActivityFeed";

export interface DashboardSummary {
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

export function useDashboardData() {
  const [timeRange, setTimeRange] = useState<"7d" | "14d" | "30d">("7d");

  // 1. Fetch dashboard summary with 60s auto-refresh
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

  return {
    timeRange,
    setTimeRange,
    summary,
    isSummaryLoading,
    summaryError,
    isRefetching,
    timeSeries,
    isTimeSeriesLoading,
    activity,
    isActivityLoading,
    handleManualRefresh,
    refetchSummary,
  };
}
