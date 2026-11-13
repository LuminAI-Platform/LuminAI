import React, { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch, ApiError } from "../../../lib/api";
import { PipelineJobCard, type PipelineJob } from "./PipelineJobCard";
import {
  usePipelineStream,
  type PipelineProgressEvent,
  type PipelineCompleteEvent,
} from "../hooks/usePipelineStream";
import type { FilterStatus } from "./pipeline-monitor/pipelineMonitorUtils";
import {
  normaliseJob,
  formatNumber,
} from "./pipeline-monitor/pipelineMonitorUtils";
import {
  ConnectionDot,
  FilterPill,
} from "./pipeline-monitor/pipelineMonitorTypes";
import { ThroughputGauge } from "./pipeline-monitor/ThroughputGauge";
import { PipelineKpis } from "./pipeline-monitor/PipelineKpis";

export const PipelineMonitor: React.FC = () => {
  const [jobs, setJobs] = useState<PipelineJob[]>([]);
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

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
    } catch {
      // keep existing jobs
    }
  }, []);

  const fetchOnce = useCallback(async () => {
    try {
      const res = await apiFetch("/api/v1/pipelines/runs");
      if (res.ok) {
        const data = await res.json();
        ingestPayload(data);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
      setFetchError(
        err instanceof Error ? err.message : "Failed to load pipeline runs",
      );
    } finally {
      setIsLoading(false);
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
  } = usePipelineStream({
    onProgress: handleProgress,
    onComplete: handleComplete,
  });

  useEffect(() => {
    fetchOnce();
    pollRef.current = setInterval(fetchOnce, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchOnce]);

  const counts: Record<FilterStatus, number> = {
    ALL: jobs.length,
    RUNNING: jobs.filter((j) => j.status === "RUNNING").length,
    CLEANED: jobs.filter((j) => j.status === "CLEANED").length,
    COMPLETED: jobs.filter((j) => j.status === "COMPLETED").length,
    FAILED: jobs.filter((j) => j.status === "FAILED").length,
  };

  const filtered =
    filter === "ALL" ? jobs : jobs.filter((j) => j.status === filter);
  const totalThroughput = jobs
    .filter((j) => j.status === "RUNNING")
    .reduce((acc, j) => acc + j.throughput, 0);

  return (
    <div className="flex flex-col gap-6" data-testid="pipeline-monitor">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-zinc-100">
            Live Pipeline Telemetry
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Real-time data cleaning job status & throughput
          </p>
        </div>
        <div className="flex items-center gap-4">
          <ConnectionDot connected={sseConnected} polling={polling} />
          {lastUpdated && (
            <span className="text-[10px] text-zinc-600 select-none">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* SSE Inline Error Alerts */}
      {sseErrors.length > 0 && (
        <div className="flex flex-col gap-2">
          {sseErrors.slice(0, 3).map((err, idx) => (
            <div
              key={`${err.runId}-${idx}`}
              className={`p-3 rounded-lg border text-xs flex items-center justify-between font-medium ${
                err.severity === "error"
                  ? "bg-error-bg border-error-border text-error"
                  : "bg-warning-bg border-warning-border text-warning"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/40 border border-current opacity-80 uppercase">
                  {err.step}
                </span>
                <span>{err.error}</span>
                {err.timestamp && (
                  <span className="text-[10px] opacity-60">
                    · {err.timestamp}
                  </span>
                )}
              </div>
              <button
                onClick={clearErrors}
                className="opacity-70 hover:opacity-100 text-[11px] underline cursor-pointer ml-3"
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}

      {/* KPI Cards Grid */}
      <PipelineKpis jobs={jobs} counts={counts} />

      {/* Aggregate Throughput Banner */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 flex items-center justify-between">
        <div>
          <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">
            Aggregate Engine Throughput
          </div>
          <div className="text-2xl font-bold text-zinc-100 mt-1">
            {formatNumber(totalThroughput)}
            <span className="text-sm font-normal text-zinc-500 ml-1.5">
              records / sec
            </span>
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">
            Summed across {counts.RUNNING} active pipeline
            {counts.RUNNING === 1 ? "" : "s"}
          </div>
        </div>
        <ThroughputGauge value={totalThroughput} max={100_000} />
      </div>

      {/* Status Filter Pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {(
          ["ALL", "RUNNING", "CLEANED", "COMPLETED", "FAILED"] as FilterStatus[]
        ).map((st) => (
          <FilterPill
            key={st}
            id={`filter-${st.toLowerCase()}`}
            label={st}
            count={counts[st]}
            active={filter === st}
            onClick={() => setFilter(st)}
          />
        ))}
      </div>

      {/* Jobs list */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 bg-zinc-900 border border-zinc-800 rounded-lg">
          <svg
            className="animate-spin text-zinc-500"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 12a9 9 0 1 1-6.22-8.56" />
          </svg>
          <span className="text-xs text-zinc-500">
            Connecting to telemetry stream...
          </span>
        </div>
      ) : fetchError ? (
        <div className="bg-error-bg border border-error-border rounded-lg p-4 text-xs text-error">
          {fetchError}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg p-12 text-center text-xs text-text-secondary">
          No pipeline runs matching filter &quot;{filter}&quot;
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((job) => (
            <PipelineJobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
};
