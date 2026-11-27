import React, { useEffect, useCallback, useMemo, useState } from "react";
import { Database, ICON_SIZES } from "../../../lib/icons";
import { Dialog } from "../../../components/ui/Dialog";
import type { PipelineRunItem } from "./pipeline-analysis/pipelineAnalysisTypes";
import type {
  SyncJobStatus,
  SyncDataset,
  SyncJob,
} from "./sync-job/syncJobTypes";
import {
  SyncJobKpiCards,
  type CountDiscrepancy,
} from "./sync-job/SyncJobKpiCards";
import { SyncDatasetRow } from "./sync-job/SyncDatasetRow";
import { useSyncJobsData } from "./sync-job/useSyncJobsData";
import { SyncJobHeader } from "./sync-job/SyncJobHeader";

const MAX_INLINE_DATASETS = 6;

export type { SyncJobStatus, SyncDataset, SyncJob };

interface SyncJobDetailsProps {
  datasets?: SyncDataset[];
  cleanViewQuarantinedByConnection?: Record<string, number>;
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
  cleanViewQuarantinedByConnection,
  onOpenRunDetail,
  onPause,
  onResume,
  onCancel,
}) => {
  const [allDatasetsOpen, setAllDatasetsOpen] = useState(false);
  const {
    datasets,
    selectedScope,
    setSelectedScope,
    speedHistory,
    liveNow,
    setLiveNow,
    liveAnnouncement,
  } = useSyncJobsData(controlledDatasets);

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
  }, [hasActiveInScope, setLiveNow]);

  const handleSelectRow = useCallback(
    (ds: SyncDataset, triggerEl: HTMLButtonElement | null) => {
      setSelectedScope(ds.id);
      if (ds.rawRun && onOpenRunDetail) {
        onOpenRunDetail(ds.rawRun, triggerEl);
      }
    },
    [onOpenRunDetail, setSelectedScope],
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
    if (
      scopeDatasets.length > 0 &&
      scopeDatasets.every((d) => d.status === "completed_no_records")
    ) {
      return "completed_no_records";
    }
    return "completed";
  })();

  const totalRecords = scopeDatasets.some(
    (d) => typeof d.totalRecords === "number",
  )
    ? scopeDatasets.reduce((sum, d) => sum + (d.totalRecords ?? 0), 0)
    : undefined;
  const totalSynced = scopeDatasets.some(
    (d) => typeof d.syncedRecords === "number",
  )
    ? scopeDatasets.reduce((sum, d) => sum + (d.syncedRecords ?? 0), 0)
    : undefined;
  const rejectedCount = scopeDatasets.some(
    (d) => typeof d.rejectedRecords === "number",
  )
    ? scopeDatasets.reduce((sum, d) => sum + (d.rejectedRecords ?? 0), 0)
    : undefined;
  const quarantinedCount = scopeDatasets.some(
    (d) => typeof d.quarantinedRecords === "number",
  )
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

  const countDiscrepancy: CountDiscrepancy | null = (() => {
    if (
      isAllScope ||
      !selectedDataset?.connectionId ||
      !cleanViewQuarantinedByConnection
    ) {
      return null;
    }
    const cleanViewCount =
      cleanViewQuarantinedByConnection[selectedDataset.connectionId];
    if (typeof cleanViewCount !== "number") return null;
    const syncCount =
      (selectedDataset.quarantinedRecords ?? 0) +
      (selectedDataset.rejectedRecords ?? 0);
    if (syncCount !== cleanViewCount) {
      if (import.meta.env.DEV) {
        console.warn(
          `[SyncJobDetails] Count discrepancy for connection ${selectedDataset.connectionId}: pipeline run reports ${syncCount}, clean-preview reports ${cleanViewCount}`,
        );
      }
      return { syncCount, cleanViewCount };
    }
    return null;
  })();

  const headerTitle = isAllScope
    ? "All sync activity"
    : `Sync: ${selectedDataset?.name ?? "Dataset"}`;
  const scopeCaption = isAllScope
    ? `${datasets.length} ${datasets.length === 1 ? "dataset" : "datasets"}`
    : "1 dataset selected";
  const visibleDatasets = datasets.slice(0, MAX_INLINE_DATASETS);
  const hasMoreDatasets = datasets.length > MAX_INLINE_DATASETS;

  return (
    <section
      aria-label="Sync progress"
      className="bg-surface border border-border rounded-lg overflow-hidden flex flex-col gap-4 py-4 shadow-sm"
    >
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {liveAnnouncement}
      </div>

      <SyncJobHeader
        headerTitle={headerTitle}
        scopeCaption={scopeCaption}
        isAllScope={isAllScope}
        selectedDataset={selectedDataset}
        scopeStatus={scopeStatus}
        datasetsCount={datasets.length}
        onToggleScope={() =>
          setSelectedScope(isAllScope ? datasets[0].id : "all")
        }
        onPause={onPause}
        onResume={onResume}
        onCancel={onCancel}
      />

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
        countDiscrepancy={countDiscrepancy}
        durationSec={durationSec}
      />

      <div className="px-4 sm:px-5 flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-text-secondary">
          <span>
            {hasMoreDatasets
              ? `Showing ${visibleDatasets.length} of ${datasets.length}`
              : `Datasets (${datasets.length})`}
          </span>
          {hasMoreDatasets ? (
            <button
              type="button"
              onClick={() => setAllDatasetsOpen(true)}
              className="text-xs font-medium text-primary hover:underline cursor-pointer bg-transparent border-none p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded"
            >
              View all
            </button>
          ) : (
            <span className="text-[11px] text-text-muted">
              Select a dataset to view stats and run detail
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {visibleDatasets.map((ds) => (
            <SyncDatasetRow
              key={ds.id}
              ds={ds}
              isSelected={!isAllScope && selectedDataset?.id === ds.id}
              onSelect={handleSelectRow}
            />
          ))}
        </div>
      </div>

      <Dialog
        open={allDatasetsOpen}
        onOpenChange={setAllDatasetsOpen}
        variant="form"
        title={`All synced datasets (${datasets.length})`}
        description="Select a dataset run to inspect its stats and run details."
      >
        <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1">
          {datasets.map((ds) => (
            <SyncDatasetRow
              key={ds.id}
              ds={ds}
              isSelected={!isAllScope && selectedDataset?.id === ds.id}
              onSelect={(selected, el) => {
                setAllDatasetsOpen(false);
                handleSelectRow(selected, el);
              }}
            />
          ))}
        </div>
      </Dialog>
    </section>
  );
};
