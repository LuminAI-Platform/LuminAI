import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Database, ICON_SIZES } from "../../../lib/icons";
import type { PipelineRunItem } from "./pipeline-analysis/pipelineAnalysisTypes";
import type {
  SyncJobStatus,
  SyncDataset,
  SyncJob,
} from "./sync-job/syncJobTypes";
import { SyncJobKpiCards } from "./sync-job/SyncJobKpiCards";
import { SyncDatasetRow } from "./sync-job/SyncDatasetRow";
import { SyncJobHeader } from "./sync-job/SyncJobHeader";
import { useSyncJobPolling } from "./sync-job/useSyncJobPolling";
import { computeSyncScopeMetrics } from "./sync-job/computeSyncScopeMetrics";

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
  // "all" shows totals across all datasets; otherwise holds the selected dataset/run ID
  const [selectedScope, setSelectedScope] = useState<string | null>(null);
  const [liveNow, setLiveNow] = useState<number>(() => Date.now());

  const { datasets, speedHistory, liveAnnouncement } =
    useSyncJobPolling(controlledDatasets);

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

  const metrics = computeSyncScopeMetrics(
    datasets,
    selectedDataset,
    isAllScope,
    hasActiveInScope,
    liveNow,
  );

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

      <SyncJobHeader
        datasetsCount={datasets.length}
        isAllScope={isAllScope}
        selectedDataset={selectedDataset}
        scopeStatus={metrics.scopeStatus}
        onToggleScope={() =>
          setSelectedScope(isAllScope ? datasets[0].id : "all")
        }
        onPause={onPause}
        onResume={onResume}
        onCancel={onCancel}
      />

      <SyncJobKpiCards
        status={metrics.scopeStatus}
        isAllScope={isAllScope}
        datasetCount={datasets.length}
        totalSynced={metrics.totalSynced}
        totalRecords={metrics.totalRecords}
        isActive={hasActiveInScope}
        currentSpeed={metrics.currentSpeed}
        speedHistory={speedHistory}
        avgSpeed={metrics.avgSpeed}
        rejectedCount={metrics.rejectedCount}
        quarantinedCount={metrics.quarantinedCount}
        durationSec={metrics.durationSec}
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
