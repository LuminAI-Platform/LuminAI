import type { SyncJobStatus } from "./syncJobTypes";
import { formatNumber, formatDuration } from "./syncJobHelpers";

export interface SyncJobKpiMetricInput {
  status: SyncJobStatus;
  isAllScope: boolean;
  datasetCount: number;
  totalSynced?: number;
  totalRecords?: number;
  isActive: boolean;
  currentSpeed?: number;
  avgSpeed?: number;
  rejectedCount?: number;
  quarantinedCount?: number;
  durationSec?: number;
}

export function computeSyncJobKpiMetrics({
  status,
  isAllScope,
  datasetCount,
  totalSynced,
  totalRecords,
  isActive,
  currentSpeed,
  avgSpeed,
  rejectedCount,
  quarantinedCount,
  durationSec,
}: SyncJobKpiMetricInput) {
  const hasProgress =
    typeof totalSynced === "number" && typeof totalRecords === "number";
  const pct =
    hasProgress && totalRecords > 0
      ? Math.min(100, Math.round((totalSynced / totalRecords) * 100))
      : status === "completed" || status === "completed_with_issues"
        ? 100
        : undefined;

  const progressValue = hasProgress
    ? `${formatNumber(totalSynced)} of ${formatNumber(totalRecords)} records`
    : typeof totalSynced === "number"
      ? `${formatNumber(totalSynced)} records`
      : "–";

  const progressCaption =
    pct !== undefined
      ? `${pct}% complete`
      : isAllScope
        ? `${datasetCount} ${datasetCount === 1 ? "dataset" : "datasets"}`
        : "–";

  const speedLabel = isActive ? "Speed" : "Avg speed";
  const speedNumeric = isActive ? (currentSpeed ?? avgSpeed) : avgSpeed;
  const speedValue =
    typeof speedNumeric === "number" && speedNumeric > 0
      ? `${formatNumber(Math.round(speedNumeric))} rec/s`
      : "–";
  const speedCaption = isActive
    ? typeof avgSpeed === "number" && avgSpeed > 0
      ? `Avg ${formatNumber(Math.round(avgSpeed))} rec/s`
      : "Live throughput"
    : typeof speedNumeric === "number" && speedNumeric > 0
      ? isAllScope
        ? `Across ${datasetCount} ${datasetCount === 1 ? "dataset" : "datasets"}`
        : "Run average"
      : "Unavailable";

  const hasRejected = typeof rejectedCount === "number";
  const hasQuarantined = typeof quarantinedCount === "number";
  const totalIssues =
    hasRejected || hasQuarantined
      ? (rejectedCount ?? 0) + (quarantinedCount ?? 0)
      : undefined;

  const errorsValue =
    totalIssues !== undefined ? formatNumber(totalIssues) : "–";

  const errorsCaption = (() => {
    if (!hasRejected && !hasQuarantined) return "Not reported";
    if (hasRejected && hasQuarantined) {
      return `${formatNumber(rejectedCount)} rejected, ${formatNumber(quarantinedCount)} quarantined`;
    }
    if (hasRejected) {
      return `${formatNumber(rejectedCount)} rejected`;
    }
    return `${formatNumber(quarantinedCount!)} quarantined`;
  })();

  const errorsValueClass =
    (rejectedCount ?? 0) > 0
      ? "text-error"
      : (quarantinedCount ?? 0) > 0
        ? "text-warning"
        : "text-text";

  const durationLabel = isAllScope ? "Total processing time" : "Duration";
  const formattedDuration = formatDuration(durationSec);
  const durationCaption = (() => {
    if (isAllScope) {
      return `Across ${datasetCount} ${datasetCount === 1 ? "dataset" : "datasets"}`;
    }
    if (status === "running") return "In progress";
    if (status === "paused") return "Paused";
    if (status === "failed") {
      return formattedDuration !== "–"
        ? `Failed after ${formattedDuration}`
        : "Failed";
    }
    return formattedDuration !== "–"
      ? `Completed in ${formattedDuration}`
      : "Unavailable";
  })();

  return {
    progressValue,
    progressCaption,
    speedLabel,
    speedNumeric,
    speedValue,
    speedCaption,
    errorsValue,
    errorsCaption,
    errorsValueClass,
    durationLabel,
    formattedDuration,
    durationCaption,
  };
}
