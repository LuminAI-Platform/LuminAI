import type { SyncDataset, SyncJobStatus } from "./syncJobTypes";

export interface SyncScopeMetrics {
  scopeStatus: SyncJobStatus;
  totalRecords?: number;
  totalSynced?: number;
  rejectedCount?: number;
  quarantinedCount?: number;
  durationSec?: number;
  avgSpeed?: number;
  currentSpeed?: number;
}

export function computeSyncScopeMetrics(
  datasets: SyncDataset[],
  selectedDataset: SyncDataset | null,
  isAllScope: boolean,
  hasActiveInScope: boolean,
  liveNow: number,
): SyncScopeMetrics {
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

  return {
    scopeStatus,
    totalRecords,
    totalSynced,
    rejectedCount,
    quarantinedCount,
    durationSec,
    avgSpeed,
    currentSpeed,
  };
}
