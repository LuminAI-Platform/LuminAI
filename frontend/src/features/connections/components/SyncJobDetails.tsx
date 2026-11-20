import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { apiFetch, ApiError } from "../../../lib/api";
import { Database, FileText, Plug, ICON_SIZES } from "../../../lib/icons";
import type { PipelineRunItem } from "./pipeline-analysis/pipelineAnalysisTypes";
import type {
  SyncJobStatus,
  SyncDataset,
  SyncJob,
} from "./sync-job/syncJobTypes";
import { STATUS_CONFIG } from "./sync-job/syncJobTypes";
import {
  parseSyncDatasetFromApi,
  formatOutcomeSummary,
} from "./sync-job/syncJobHelpers";
import { SyncJobKpiCards } from "./sync-job/SyncJobKpiCards";
import { SyncDatasetRow } from "./sync-job/SyncDatasetRow";

export type { SyncJobStatus, SyncDataset, SyncJob };

interface SyncJobDetailsProps {
  datasets?: SyncDataset[];
  onOpenRunDetail?: (
    run: PipelineRunItem,
    triggerEl: HTMLElement | null,
  ) => void;
  onPause?: (jobId: string) => void;
  onResume?: (jobId: string) => void;
  onCancel?: (jobId: string) => void;
}

export const SyncJobDetails: React.FC<SyncJobDetailsProps> = ({
  datasets: controlledDatasets,
  onOpenRunDetail,
  onPause,
  onResume,
  onCancel,
}) => {
  const [internalDatasets, setInternalDatasets] = useState<SyncDataset[]>([]);
  // "all" shows totals across all datasets; otherwise holds the selected dataset/run ID
  const [selectedScope, setSelectedScope] = useState<string | null>(null);
  const [speedHistory, setSpeedHistory] = useState<number[]>([]);
  const [liveNow, setLiveNow] = useState<number>(() => Date.now());
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>("");

  const prevStatusesRef = useRef<Record<string, SyncJobStatus>>({});
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const datasets = controlledDatasets ?? internalDatasets;

  const fetchSyncJobs = useCallback(async () => {
    try {
      const res = await apiFetch("/api/v1/pipelines?size=20", {
        headers: { "X-Suppress-Toast": "true" },
      });
      if (!res.ok) return;

      const page = (await res.json()) as unknown;
      const items: Record<string, unknown>[] = Array.isArray(page)
        ? page
        : Array.isArray((page as { content?: unknown[] })?.content)
          ? ((page as { content: unknown[] }).content as Record<
              string,
              unknown
            >[])
          : [];

      const parsed = items.map((item, idx) =>
        parseSyncDatasetFromApi(item, idx),
      );

      // Announce run completions via ARIA live region
      const prevMap = prevStatusesRef.current;
      for (const ds of parsed) {
        const prevStatus = prevMap[ds.id];
        if (
          prevStatus === "running" &&
          (ds.status === "completed" ||
            ds.status === "completed_with_issues" ||
            ds.status === "failed")
        ) {
          const outcome = formatOutcomeSummary(ds);
          const statusText = STATUS_CONFIG[ds.status].label.toLowerCase();
          setLiveAnnouncement(`Sync ${statusText} for ${ds.name}: ${outcome}.`);
          break;
        }
      }
      const nextMap: Record<string, SyncJobStatus> = {};
      parsed.forEach((ds) => {
        nextMap[ds.id] = ds.status;
      });
      prevStatusesRef.current = nextMap;

      setInternalDatasets(parsed);

      // Record live throughput samples ONLY when a run is actively running
      const activeRun = parsed.find((d) => d.status === "running");
      if (activeRun && typeof activeRun.throughput === "number") {
        setSpeedHistory((h) =>
          [...h, Math.round(activeRun.throughput!)].slice(-24),
        );
      } else {
        setSpeedHistory([]);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
          syncIntervalRef.current = null;
        }
      }
    }
  }, []);

  useEffect(() => {
    if (controlledDatasets !== undefined) return;
    Promise.resolve().then(() => {
      fetchSyncJobs();
    });
    syncIntervalRef.current = setInterval(fetchSyncJobs, 5000);
    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [controlledDatasets, fetchSyncJobs]);

  // Default to the most recent dataset (index 0)
  const effectiveScope = useMemo(() => {
    if (datasets.length === 0) return null;
    if (selectedScope === "all") return "all";
    if (selectedScope && datasets.some((d) => d.id === selectedScope)) {
      return selectedScope;
    }
    return datasets[0].id;
  }, [datasets, selectedScope]);

  const isAllScope = effectiveScope === "all";
  const selectedDataset = useMemo(
    () =>
      isAllScope
        ? null
        : (datasets.find((d) => d.id === effectiveScope) ??
          datasets[0] ??
          null),
    [datasets, effectiveScope, isAllScope],
  );

  const hasActiveInScope = isAllScope
    ? datasets.some((d) => d.status === "running")
    : selectedDataset?.status === "running";

  useEffect(() => {
    if (!hasActiveInScope) return;
    const id = setInterval(() => setLiveNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasActiveInScope]);

  const handleSelectRow = useCallback(
    (ds: SyncDataset, triggerEl: HTMLButtonElement | null) => {
      setSelectedScope(ds.id);
      if (ds.rawRun && onOpenRunDetail) {
        onOpenRunDetail(ds.rawRun, triggerEl);
      }
    },
    [onOpenRunDetail],
  );

  if (datasets.length === 0) {
    return (
      <section
        aria-label="Sync progress"
        className="bg-surface border border-border rounded-lg p-8 flex flex-col items-center justify-center text-center"
      >
        <div className="w-10 h-10 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-text-secondary mb-3">
          <Database size={ICON_SIZES.header} aria-hidden="true" />
        </div>
        <p className="text-sm font-semibold text-text">
          No active sync pipeline
        </p>
        <p className="text-xs text-text-secondary mt-1 max-w-sm">
          Start a pipeline ingestion job or upload a dataset to monitor sync
          metrics here.
        </p>
      </section>
    );
  }

  // Compute scoped metrics — strictly matching the selected scope
  const scopeDatasets = isAllScope
    ? datasets
    : selectedDataset
      ? [selectedDataset]
      : [];

  const scopeStatus: SyncJobStatus = (() => {
    if (!isAllScope && selectedDataset) return selectedDataset.status;
    if (scopeDatasets.some((d) => d.status === "running")) return "running";
    if (scopeDatasets.some((d) => d.status === "failed")) return "failed";
    if (scopeDatasets.some((d) => d.status === "completed_with_issues")) {
      return "completed_with_issues";
    }
    if (scopeDatasets.some((d) => d.status === "paused")) return "paused";
    return "completed";
  })();

  const hasAnyTotal = scopeDatasets.some(
    (d) => typeof d.totalRecords === "number",
  );
  const hasAnySynced = scopeDatasets.some(
    (d) => typeof d.syncedRecords === "number",
  );
  const totalRecords = hasAnyTotal
    ? scopeDatasets.reduce((sum, d) => sum + (d.totalRecords ?? 0), 0)
    : undefined;
  const totalSynced = hasAnySynced
    ? scopeDatasets.reduce((sum, d) => sum + (d.syncedRecords ?? 0), 0)
    : undefined;

  const hasAnyRejected = scopeDatasets.some(
    (d) => typeof d.rejectedRecords === "number",
  );
  const rejectedCount = hasAnyRejected
    ? scopeDatasets.reduce((sum, d) => sum + (d.rejectedRecords ?? 0), 0)
    : undefined;

  const hasAnyQuarantined = scopeDatasets.some(
    (d) => typeof d.quarantinedRecords === "number",
  );
  const quarantinedCount = hasAnyQuarantined
    ? scopeDatasets.reduce((sum, d) => sum + (d.quarantinedRecords ?? 0), 0)
    : undefined;

  const durationSec: number | undefined = (() => {
    if (!isAllScope && selectedDataset) {
      if (selectedDataset.status === "running" && selectedDataset.startedAt) {
        return Math.max(
          0,
          Math.floor((liveNow - selectedDataset.startedAt.getTime()) / 1000),
        );
      }
      return selectedDataset.durationSeconds;
    }
    const withDur = scopeDatasets.filter(
      (d) => typeof d.durationSeconds === "number",
    );
    if (withDur.length === 0) return undefined;
    return withDur.reduce((sum, d) => sum + (d.durationSeconds ?? 0), 0);
  })();

  const throughputValues = scopeDatasets
    .map((d) => d.throughput)
    .filter((v): v is number => typeof v === "number" && v > 0);
  const avgSpeed =
    throughputValues.length > 0
      ? throughputValues.reduce((a, b) => a + b, 0) / throughputValues.length
      : undefined;
  const currentSpeed = hasActiveInScope
    ? (scopeDatasets.find((d) => d.status === "running")?.throughput ??
      avgSpeed)
    : undefined;

  const headerTitle = isAllScope
    ? "All sync activity"
    : `Sync: ${selectedDataset?.name ?? "Dataset"}`;
  const scopeCaption = isAllScope
    ? `${datasets.length} ${datasets.length === 1 ? "dataset" : "datasets"}`
    : "1 dataset";
  const cfg = STATUS_CONFIG[scopeStatus];

  const SourceIcon =
    !isAllScope && selectedDataset?.sourceType === "File"
      ? FileText
      : !isAllScope && selectedDataset?.sourceType === "API"
        ? Plug
        : Database;

  return (
    <section
      aria-label="Sync progress"
      className="bg-surface border border-border rounded-lg overflow-hidden flex flex-col gap-4 py-4 shadow-sm"
    >
      {/* ARIA live region for run completion announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {liveAnnouncement}
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 sm:px-5">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <span
            className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${cfg.dot} ${
              scopeStatus === "running"
                ? "animate-pulse motion-reduce:animate-none"
                : ""
            }`}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <h2
              className="text-sm font-semibold text-text leading-snug truncate"
              title={headerTitle}
            >
              {headerTitle}
            </h2>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs text-text-secondary">
              <span>{scopeCaption}</span>
              {!isAllScope && selectedDataset && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1">
                    <SourceIcon size={12} aria-hidden="true" />
                    <span>{selectedDataset.sourceType}</span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span
                    className="font-mono text-[11px] text-text-muted"
                    title={`Run ID: ${selectedDataset.id}`}
                  >
                    #{selectedDataset.id.slice(0, 8)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {datasets.length > 1 && (
            <button
              type="button"
              onClick={() =>
                setSelectedScope(isAllScope ? datasets[0].id : "all")
              }
              className="text-xs font-medium px-2.5 py-1 rounded-md bg-surface-subtle border border-border text-text-secondary hover:text-text hover:border-border-focus transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {isAllScope ? "Latest dataset" : "All sync activity"}
            </button>
          )}
          <span
            className={`text-xs px-2.5 py-1 rounded-full border whitespace-nowrap ${cfg.badge}`}
          >
            {cfg.label}
          </span>
          {!isAllScope &&
            selectedDataset &&
            onPause &&
            selectedDataset.status === "running" && (
              <button
                type="button"
                onClick={() => onPause(selectedDataset.id)}
                title="Pause sync"
                aria-label="Pause sync"
                className="p-1.5 rounded-lg bg-surface-subtle border border-border text-text-secondary hover:text-warning hover:border-warning-border transition-colors cursor-pointer"
              >
                Pause
              </button>
            )}
          {!isAllScope &&
            selectedDataset &&
            onResume &&
            selectedDataset.status === "paused" && (
              <button
                type="button"
                onClick={() => onResume(selectedDataset.id)}
                title="Resume sync"
                aria-label="Resume sync"
                className="p-1.5 rounded-lg bg-surface-subtle border border-border text-text-secondary hover:text-success hover:border-success-border transition-colors cursor-pointer"
              >
                Resume
              </button>
            )}
          {!isAllScope &&
            selectedDataset &&
            onCancel &&
            (selectedDataset.status === "running" ||
              selectedDataset.status === "paused") && (
              <button
                type="button"
                onClick={() => onCancel(selectedDataset.id)}
                title="Cancel sync"
                aria-label="Cancel sync"
                className="p-1.5 rounded-lg bg-surface-subtle border border-border text-text-secondary hover:text-error hover:border-error-border transition-colors cursor-pointer"
              >
                Cancel
              </button>
            )}
        </div>
      </div>

      {/* Stat Cards */}
      <SyncJobKpiCards
        status={scopeStatus}
        isAllScope={isAllScope}
        datasetCount={datasets.length}
        totalSynced={totalSynced}
        totalRecords={totalRecords}
        isActive={hasActiveInScope}
        currentSpeed={currentSpeed}
        speedHistory={speedHistory}
        avgSpeed={avgSpeed}
        rejectedCount={rejectedCount}
        quarantinedCount={quarantinedCount}
        durationSec={durationSec}
      />

      {/* Dataset Breakdown */}
      <div className="px-4 sm:px-5 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-medium text-text-secondary">
          <span>Datasets ({datasets.length})</span>
          <span className="text-[11px] text-text-muted">
            Select a dataset to view stats and run detail
          </span>
        </div>
        <div className="flex flex-col gap-2 max-h-[340px] overflow-y-auto pr-0.5">
          {datasets.map((ds) => (
            <SyncDatasetRow
              key={ds.id}
              ds={ds}
              isSelected={!isAllScope && selectedDataset?.id === ds.id}
              onSelect={handleSelectRow}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
