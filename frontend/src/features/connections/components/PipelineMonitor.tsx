import React, { useState, useRef, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "../../../lib/icons";
import { PipelineJobCard, type PipelineJob } from "./PipelineJobCard";
import type { FilterStatus } from "./pipeline-monitor/pipelineMonitorUtils";
import { ConnectionDot } from "./pipeline-monitor/pipelineMonitorTypes";
import { PipelineKpis } from "./pipeline-monitor/PipelineKpis";
import {
  PipelineMonitorLoading,
  PipelineMonitorError,
  PipelineMonitorEmpty,
} from "./pipeline-monitor/PipelineEmptyStates";
import { PipelineFilterToolbar } from "./pipeline-monitor/PipelineFilterToolbar";
import { RunDetailDrawer } from "./pipeline-analysis/RunDetailDrawer";
import type { PipelineRunItem } from "./pipeline-analysis/pipelineAnalysisTypes";
import { usePipelineMonitorData } from "./pipeline-monitor/usePipelineMonitorData";
import { PipelineThroughputBanner } from "./pipeline-monitor/PipelineThroughputBanner";

interface PipelineMonitorProps {
  initialJobs?: PipelineJob[];
  initialLoading?: boolean;
  onStreamStatusChange?: (status: {
    isConnected: boolean;
    activeStreams: number;
    isPolling: boolean;
  }) => void;
}

export const PipelineMonitor: React.FC<PipelineMonitorProps> = ({
  initialJobs,
  initialLoading,
  onStreamStatusChange,
}) => {
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedRun, setSelectedRun] = useState<PipelineRunItem | null>(null);
  const drawerTriggerRef = useRef<HTMLElement | null>(null);

  const {
    jobs,
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
  } = usePipelineMonitorData({
    initialJobs,
    initialLoading,
    onStreamStatusChange,
  });

  const handleOpenJobDetail = useCallback(
    (job: PipelineJob, triggerEl: HTMLElement | null) => {
      drawerTriggerRef.current = triggerEl;
      setSelectedRun({
        id: job.id,
        connectorName: job.connectorName,
        connectorType: job.connectorType,
        pipelineType: "",
        status: job.status,
        progress: job.progress,
        recordsInput: job.recordsInput,
        recordsOutput: job.recordsOutput,
        recordsFailed: job.recordsFailed,
        throughput: job.throughput,
        startedAt: job.startedAt,
        completedAt: null,
        durationSeconds: job.durationSeconds,
        errorMessage: job.errors[0]?.message ?? null,
      });
    },
    [],
  );

  if (isActuallyLoading) {
    return <PipelineMonitorLoading />;
  }

  if (effectiveError && jobs.length === 0) {
    return (
      <PipelineMonitorError
        is404={is404}
        effectiveError={effectiveError}
        onRetry={() => {
          refetch();
          fetchOnce();
        }}
      />
    );
  }

  if (jobs.length === 0) {
    return <PipelineMonitorEmpty />;
  }

  const counts: Record<FilterStatus, number> = {
    ALL: jobs.length,
    RUNNING: jobs.filter((j) => j.status === "RUNNING").length,
    CLEANED: jobs.filter((j) => j.status === "CLEANED").length,
    COMPLETED: jobs.filter((j) => j.status === "COMPLETED").length,
    FAILED: jobs.filter((j) => j.status === "FAILED").length,
  };

  const filtered = jobs.filter((j) => {
    if (selectedStatuses.length > 0) {
      return selectedStatuses.includes(j.status);
    }
    if (filter !== "ALL") {
      return j.status === filter;
    }
    return true;
  });

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
          <ConnectionDot
            connected={sseConnected}
            polling={polling}
            onReconnect={reconnect}
            fallbackNote="polling every 30s"
          />
          {(lastUpdated || dataUpdatedAt > 0) && (
            <span className="text-[10px] text-text-secondary select-none font-mono">
              Updated{" "}
              {new Date(
                lastUpdated ? lastUpdated.getTime() : dataUpdatedAt,
              ).toLocaleTimeString()}
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
                type="button"
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
      <PipelineThroughputBanner
        totalThroughput={totalThroughput}
        runningCount={counts.RUNNING}
      />

      {/* Status Filter MultiSelect & Pills */}
      <PipelineFilterToolbar
        filter={filter}
        setFilter={setFilter}
        selectedStatuses={selectedStatuses}
        setSelectedStatuses={setSelectedStatuses}
        counts={counts}
      />

      {/* Jobs list */}
      {filtered.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg p-12 text-center text-xs text-text-secondary">
          {filter === "ALL" ? (
            <div className="flex flex-col items-center gap-3">
              <span className="font-semibold text-text">
                No pipeline runs yet
              </span>
              <p className="text-text-secondary">
                Connect a data source to begin running pipelines and observing
                live execution telemetry.
              </p>
              <Link
                to="/connections"
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-hover border border-primary text-primary-text font-semibold text-xs shadow-xs"
              >
                <span>Create a connection</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            `No runs matching "${filter}"`
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((job) => (
            <PipelineJobCard
              key={job.id}
              job={job}
              onSelectRun={handleOpenJobDetail}
            />
          ))}
        </div>
      )}

      {selectedRun && (
        <RunDetailDrawer
          run={selectedRun}
          onClose={() => setSelectedRun(null)}
          triggerButtonRef={drawerTriggerRef}
        />
      )}
    </div>
  );
};
