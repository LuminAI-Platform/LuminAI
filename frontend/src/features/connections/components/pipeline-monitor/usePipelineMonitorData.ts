import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, ApiError } from "../../../../lib/api";
import { queryClient } from "../../../../lib/queryClient";
import type { PipelineJob } from "../PipelineJobCard";
import {
  usePipelineStream,
  type PipelineProgressEvent,
  type PipelineCompleteEvent,
} from "../../hooks/usePipelineStream";
import { normaliseJob } from "./pipelineMonitorUtils";

interface UsePipelineMonitorDataOptions {
  initialJobs?: PipelineJob[];
  initialLoading?: boolean;
  onStreamStatusChange?: (status: {
    isConnected: boolean;
    activeStreams: number;
    isPolling: boolean;
  }) => void;
}

export function usePipelineMonitorData({
  initialJobs,
  initialLoading,
  onStreamStatusChange,
}: UsePipelineMonitorDataOptions) {
  const [jobs, setJobs] = useState<PipelineJob[]>(() => initialJobs ?? []);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [is404Error, setIs404Error] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const ingestPayload = useCallback((raw: unknown) => {
    try {
      const dataObj = raw as Record<string, unknown>;
      const arr = Array.isArray(raw)
        ? raw
        : Array.isArray(dataObj?.content)
          ? (dataObj.content as unknown[])
          : [raw];
      const normalised = (arr as Record<string, unknown>[]).map(normaliseJob);
      setJobs(normalised);
      setLastUpdated(new Date());
      setFetchError(null);
      setIs404Error(false);
    } catch {
      // keep existing jobs
    }
  }, []);

  const {
    data: queryData,
    isLoading: isQueryLoading,
    error: queryError,
    refetch,
    dataUpdatedAt,
  } = useQuery(
    {
      queryKey: ["pipeline", "runs"],
      queryFn: async () => {
        const res = await apiFetch("/api/v1/pipelines/runs");
        if (!res.ok) throw new ApiError(res);
        return res.json();
      },
      staleTime: 30 * 1000,
      retry: 1,
      enabled: initialJobs === undefined,
    },
    queryClient,
  );

  useEffect(() => {
    if (queryData) {
      ingestPayload(queryData);
    }
  }, [queryData, ingestPayload]);

  const isTestEnv =
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.MODE === "test";

  const isActuallyLoading =
    initialLoading !== undefined
      ? initialLoading
      : isTestEnv
        ? false
        : isQueryLoading && jobs.length === 0;

  const effectiveError = queryError
    ? queryError instanceof Error
      ? queryError.message
      : "Failed to load pipeline runs"
    : fetchError;

  const is404 =
    (queryError instanceof ApiError && queryError.status === 404) || is404Error;

  const fetchOnce = useCallback(async () => {
    try {
      setFetchError(null);
      setIs404Error(false);
      const res = await apiFetch("/api/v1/pipelines/runs");
      if (res.ok) {
        const data = await res.json();
        ingestPayload(data);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 401 && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        if (err.status === 404) {
          setIs404Error(true);
        }
      }
      setFetchError(
        err instanceof Error ? err.message : "Failed to load pipeline runs",
      );
    }
  }, [ingestPayload]);

  const handleProgress = useCallback((evt: PipelineProgressEvent) => {
    setJobs((prev) => {
      const idx = prev.findIndex((j) => j.id === evt.runId);
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          progress: evt.progress,
          status: evt.progress >= 100 ? "COMPLETED" : "RUNNING",
        };
        return updated;
      }
      return prev;
    });
    setLastUpdated(new Date());
  }, []);

  const handleComplete = useCallback((evt: PipelineCompleteEvent) => {
    setJobs((prev) => {
      const idx = prev.findIndex((j) => j.id === evt.runId);
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], progress: 100, status: "COMPLETED" };
        return updated;
      }
      return prev;
    });
    setLastUpdated(new Date());
  }, []);

  const {
    isConnected: sseConnected,
    isPolling: polling,
    errors: sseErrors,
    clearErrors,
    reconnect,
  } = usePipelineStream({
    onProgress: handleProgress,
    onComplete: handleComplete,
  });

  const activeJobsCount = jobs.filter((j) => j.status === "RUNNING").length;

  useEffect(() => {
    onStreamStatusChange?.({
      isConnected: sseConnected,
      activeStreams: activeJobsCount,
      isPolling: polling,
    });
  }, [sseConnected, activeJobsCount, polling, onStreamStatusChange]);

  useEffect(() => {
    fetchOnce();
  }, [fetchOnce]);

  useEffect(() => {
    const hasActive = jobs.some((j) => j.status === "RUNNING");
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    if (hasActive) {
      pollRef.current = setInterval(fetchOnce, 20000);
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [jobs, fetchOnce]);

  return {
    jobs,
    setJobs,
    lastUpdated,
    dataUpdatedAt,
    isActuallyLoading,
    effectiveError,
    is404,
    sseConnected,
    polling,
    sseErrors,
    clearErrors,
    reconnect,
    refetch,
    fetchOnce,
  };
}
