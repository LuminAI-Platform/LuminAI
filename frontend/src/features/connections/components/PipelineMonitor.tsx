import React, { useState, useRef, useCallback } from "react";
import type { PipelineJob } from "./PipelineJobCard";
import type { FilterStatus } from "./pipeline-monitor/pipelineMonitorUtils";
import { formatNumber } from "./pipeline-monitor/pipelineMonitorUtils";
import { ConnectionDot } from "./pipeline-monitor/pipelineMonitorTypes";
import { ThroughputGauge } from "./pipeline-monitor/ThroughputGauge";
import { PipelineKpis } from "./pipeline-monitor/PipelineKpis";
import {
  PipelineMonitorLoading,
  PipelineMonitorError,
  PipelineMonitorEmpty,
} from "./pipeline-monitor/PipelineEmptyStates";
import { PipelineFilterToolbar } from "./pipeline-monitor/PipelineFilterToolbar";
import { PipelineSseAlerts } from "./pipeline-monitor/PipelineSseAlerts";
import { PipelineJobsList } from "./pipeline-monitor/PipelineJobsList";
import { usePipelineMonitorData } from "./pipeline-monitor/usePipelineMonitorData";
import { RunDetailDrawer } from "./pipeline-analysis/RunDetailDrawer";
import type { PipelineRunItem } from "./pipeline-analysis/pipelineAnalysisTypes";

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
      <PipelineSseAlerts errors={sseErrors} onClearErrors={clearErrors} />

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

      {/* Status Filter MultiSelect & Pills */}
      <PipelineFilterToolbar
        filter={filter}
        setFilter={setFilter}
        selectedStatuses={selectedStatuses}
        setSelectedStatuses={setSelectedStatuses}
        counts={counts}
      />

      {/* Jobs list */}
      <PipelineJobsList
        jobs={filtered}
        filter={filter}
        onSelectRun={handleOpenJobDetail}
      />

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
