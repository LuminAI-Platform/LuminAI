import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, ApiError } from "../../../../lib/api";
import type {
  TimeRangeOption,
  EngineMetricsPayload,
  PipelineSummaryMetricsDto,
  TimeSeriesPoint,
  PipelineRunItem,
  PageResponse,
} from "./pipelineAnalysisTypes";
import {
  filterAndSortRuns,
  computeStageBreakdown,
  computeTopIssues,
} from "./pipelineAnalysisComputations";

export function usePipelineAnalysis() {
  const [timeRange, setTimeRange] = useState<TimeRangeOption>("7D");
  const [pipelineFilter, setPipelineFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [page, setPage] = useState<number>(0);
  const [pageSize] = useState<number>(10);
  const [sortBy, setSortBy] = useState<keyof PipelineRunItem>("startedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const {
    data: engineMetrics,
    isLoading: isEngineMetricsLoading,
    error: engineMetricsError,
    refetch: refetchEngineMetrics,
    dataUpdatedAt: metricsUpdatedAt,
  } = useQuery<EngineMetricsPayload>({
    queryKey: ["engine", "metrics", timeRange],
    queryFn: async () => {
      const rangeParam = timeRange.toLowerCase();
      const res = await apiFetch(`/api/v1/engine/metrics?range=${rangeParam}`, {
        headers: { "X-Suppress-Toast": "true" },
      });
      return res.json();
    },
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const {
    data: pipelineMetrics,
    isLoading: isPipelineMetricsLoading,
    error: pipelineMetricsError,
    refetch: refetchPipelineMetrics,
  } = useQuery<PipelineSummaryMetricsDto>({
    queryKey: ["pipeline", "summary-metrics"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/pipelines/metrics", {
        headers: { "X-Suppress-Toast": "true" },
      });
      return res.json();
    },
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const {
    data: runsPage,
    isLoading: isRunsLoading,
    error: runsError,
    refetch: refetchRuns,
  } = useQuery<PageResponse<PipelineRunItem>>({
    queryKey: ["pipeline", "runs", page, pageSize, statusFilter],
    queryFn: async () => {
      const statusParam =
        statusFilter !== "ALL" ? `&status=${statusFilter}` : "";
      const res = await apiFetch(
        `/api/v1/pipelines/runs?page=${page}&size=${pageSize}${statusParam}`,
        {
          headers: { "X-Suppress-Toast": "true" },
        },
      );
      return res.json();
    },
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const hasActiveRun = useMemo(() => {
    if ((pipelineMetrics?.activeJobsCount ?? 0) > 0) return true;
    return runsPage?.content?.some((r) => r.status === "RUNNING") ?? false;
  }, [pipelineMetrics, runsPage]);

  const rangeParam = useMemo(() => {
    switch (timeRange) {
      case "24H":
        return "1d";
      case "7D":
        return "7d";
      case "30D":
        return "30d";
      default:
        return "7d";
    }
  }, [timeRange]);

  const {
    data: timeSeries = [],
    isLoading: isTimeSeriesLoading,
    error: timeSeriesError,
    refetch: refetchTimeSeries,
  } = useQuery<TimeSeriesPoint[]>({
    queryKey: ["pipeline", "timeseries", rangeParam],
    queryFn: async () => {
      const res = await apiFetch(
        `/api/v1/dashboard/stats/timeseries?range=${rangeParam}`,
        {
          headers: { "X-Suppress-Toast": "true" },
        },
      );
      return res.json();
    },
    refetchInterval: hasActiveRun ? 20000 : false,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const handleRefresh = useCallback(() => {
    refetchEngineMetrics();
    refetchPipelineMetrics();
    refetchTimeSeries();
    refetchRuns();
  }, [
    refetchEngineMetrics,
    refetchPipelineMetrics,
    refetchTimeSeries,
    refetchRuns,
  ]);

  const filteredRuns = useMemo(
    () =>
      filterAndSortRuns(
        runsPage?.content ?? [],
        pipelineFilter,
        searchTerm,
        sortBy,
        sortOrder,
      ),
    [runsPage, pipelineFilter, searchTerm, sortBy, sortOrder],
  );

  const uniquePipelines = useMemo(() => {
    const list = runsPage?.content ?? [];
    const names = new Set<string>();
    list.forEach((r) => {
      if (r.connectorName) names.add(r.connectorName);
    });
    return Array.from(names);
  }, [runsPage]);

  const stageBreakdown = useMemo(
    () => computeStageBreakdown(runsPage?.content ?? []),
    [runsPage],
  );

  const topIssues = useMemo(
    () => computeTopIssues(runsPage?.content ?? []),
    [runsPage],
  );

  const anyError =
    engineMetricsError || pipelineMetricsError || runsError || timeSeriesError;
  const isEngineReachable =
    engineMetrics?.engineHealth?.status === "ONLINE" ||
    (engineMetrics && !engineMetricsError);

  const errorCode = anyError instanceof ApiError ? anyError.status : undefined;
  const errorMessage =
    anyError instanceof Error
      ? anyError.message
      : "Unable to reach data engine service";

  return {
    timeRange,
    setTimeRange,
    pipelineFilter,
    setPipelineFilter,
    statusFilter,
    setStatusFilter,
    searchTerm,
    setSearchTerm,
    page,
    setPage,
    pageSize,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    uniquePipelines,
    engineMetrics,
    pipelineMetrics,
    runsPage,
    filteredRuns,
    timeSeries,
    stageBreakdown,
    topIssues,
    hasActiveRun,
    isLoading:
      isEngineMetricsLoading ||
      isPipelineMetricsLoading ||
      isRunsLoading ||
      isTimeSeriesLoading,
    isEngineReachable,
    metricsUpdatedAt,
    anyError,
    errorCode,
    errorMessage,
    handleRefresh,
  };
}
