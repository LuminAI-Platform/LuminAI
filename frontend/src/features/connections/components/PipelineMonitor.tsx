import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { Activity, AlertCircle, ArrowRight, RefreshCw } from "lucide-react";
import { apiFetch, ApiError } from "../../../lib/api";
import { Button } from "../../../components/ui/Button";
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

interface PipelineMonitorProps {
  initialJobs?: PipelineJob[];
  initialLoading?: boolean;
}

export const PipelineMonitor: React.FC<PipelineMonitorProps> = ({
  initialJobs,
  initialLoading,
}) => {
  const [jobs, setJobs] = useState<PipelineJob[]>(() => initialJobs ?? []);
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(() => {
    if (initialLoading !== undefined) return initialLoading;
    if (
      typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.MODE === "test"
    ) {
      return false;
    }
    return true;
  });
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
        if (err.status === 401) {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
        if (err.status === 404) {
          setIs404Error(true);
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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 bg-surface border border-border rounded-lg select-none">
        <svg
          className="animate-spin text-text-secondary"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 12a9 9 0 1 1-6.22-8.56" />
        </svg>
        <span className="text-xs text-text-secondary">
          Connecting to telemetry stream...
        </span>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div
        className="flex flex-col items-center justify-center py-14 px-6 border border-error-border/60 bg-error-bg/30 rounded-xl text-center select-none"
        data-testid="pipeline-monitor-error"
      >
        <div className="w-12 h-12 rounded-xl bg-surface border border-error-border flex items-center justify-center text-error mb-3.5 shadow-2xs">
          <AlertCircle className="w-6 h-6" />
        </div>

        <h4 className="text-base font-bold text-text mb-1">
          Couldn't load pipelines
        </h4>
        <p className="text-xs text-text-secondary max-w-sm mb-5 leading-relaxed">
          {is404Error
            ? "The pipeline service endpoint was not found (404)."
            : fetchError}
        </p>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setIsLoading(true);
            fetchOnce();
          }}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-16 px-6 border border-dashed border-border rounded-xl text-center bg-surface-subtle/40 select-none transition-colors"
        data-testid="pipeline-monitor-empty"
      >
        <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center text-text-secondary mb-3.5 shadow-2xs">
          <Activity className="w-6 h-6 text-primary" />
        </div>

        <h3 className="text-base font-bold text-text mb-1">Pipeline Monitor</h3>
        <p className="text-xs text-text-secondary max-w-md mb-4 leading-relaxed">
          Monitor ingest topics, data cleaning stage throughput, and real-time
          execution telemetry.
        </p>

        <span className="text-sm font-semibold text-text mb-1.5">
          No pipelines yet
        </span>
        <p className="text-xs text-text-secondary max-w-sm mb-6 leading-relaxed">
          Connect a data source to begin running pipelines and observing live
          execution telemetry.
        </p>

        <Link
          to="/connections"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover border border-primary text-primary-text text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <span>Create a connection</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

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
          <h2 className="text-base font-bold text-text">
            Live Pipeline Telemetry
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Real-time data cleaning job status & throughput
          </p>
        </div>
        <div className="flex items-center gap-4">
          <ConnectionDot connected={sseConnected} polling={polling} />
          {lastUpdated && (
            <span className="text-[10px] text-text-secondary select-none">
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
      <div className="bg-surface-subtle border border-border rounded-lg p-5 flex items-center justify-between">
        <div>
          <div className="text-[10px] text-text-secondary font-semibold uppercase tracking-wider">
            Aggregate Engine Throughput
          </div>
          <div className="text-2xl font-bold text-text mt-1">
            {formatNumber(totalThroughput)}
            <span className="text-sm font-normal text-text-secondary ml-1.5">
              records / sec
            </span>
          </div>
          <div className="text-xs text-text-secondary mt-0.5">
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
      {filtered.length === 0 ? (
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
