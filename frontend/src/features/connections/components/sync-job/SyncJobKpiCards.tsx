import React from "react";
import type { SyncJobStatus } from "./syncJobTypes";
import { formatNumber, formatDuration } from "./syncJobHelpers";
import {
  AlertCircle,
  Clock,
  Activity,
  CheckCircle2,
  ICON_SIZES,
} from "../../../../lib/icons";

const Sparkline: React.FC<{
  data: number[];
  width?: number;
  height?: number;
}> = ({ data, width = 56, height = 20 }) => {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      className="overflow-visible shrink-0 text-primary"
      aria-hidden="true"
    >
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export interface SyncJobKpiCardsProps {
  status: SyncJobStatus;
  isAllScope: boolean;
  datasetCount: number;
  totalSynced?: number;
  totalRecords?: number;
  isActive: boolean;
  currentSpeed?: number;
  speedHistory: number[];
  avgSpeed?: number;
  rejectedCount?: number;
  quarantinedCount?: number;
  durationSec?: number;
}

export const SyncJobKpiCards: React.FC<SyncJobKpiCardsProps> = ({
  status,
  isAllScope,
  datasetCount,
  totalSynced,
  totalRecords,
  isActive,
  currentSpeed,
  speedHistory,
  avgSpeed,
  rejectedCount,
  quarantinedCount,
  durationSec,
}) => {
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

  // Speed card: sparkline ONLY while active; plain "Avg speed" when finished
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

  // Errors card: show 0 ONLY when API explicitly reports 0 errors, always with rejected counts
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

  // Duration card: "Total processing time" for totals view, "Duration" for single dataset
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

  return (
    <div className="@container px-4 sm:px-5">
      <div className="grid grid-cols-2 @[560px]:grid-cols-4 gap-3 items-stretch">
        {/* Progress */}
        <div className="bg-surface-subtle border border-border rounded-lg p-3.5 flex flex-col justify-between gap-2 min-w-0 h-full">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-text-secondary truncate">
              Progress
            </span>
            <CheckCircle2
              size={ICON_SIZES.inline}
              aria-hidden="true"
              className={
                status === "failed"
                  ? "text-error shrink-0"
                  : status === "completed_with_issues"
                    ? "text-warning shrink-0"
                    : status === "completed"
                      ? "text-success shrink-0"
                      : "text-primary shrink-0"
              }
            />
          </div>
          <div className="min-w-0">
            <div
              className="text-sm font-semibold text-text leading-snug line-clamp-2 break-words"
              title={progressValue}
            >
              {progressValue}
            </div>
            <div className="text-xs text-text-secondary leading-snug line-clamp-2 mt-0.5">
              {progressCaption}
            </div>
          </div>
        </div>

        {/* Speed / Avg speed */}
        <div className="bg-surface-subtle border border-border rounded-lg p-3.5 flex flex-col justify-between gap-2 min-w-0 h-full">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-text-secondary truncate">
              {speedLabel}
            </span>
            {isActive && speedHistory.length >= 2 ? (
              <Sparkline data={speedHistory} />
            ) : (
              <Activity
                size={ICON_SIZES.inline}
                aria-hidden="true"
                className="text-text-secondary shrink-0"
              />
            )}
          </div>
          <div className="min-w-0">
            <div
              className={`text-sm font-semibold leading-snug line-clamp-2 break-words ${
                isActive && typeof speedNumeric === "number" && speedNumeric > 0
                  ? "text-primary"
                  : "text-text"
              }`}
              title={speedValue}
            >
              {speedValue}
            </div>
            <div className="text-xs text-text-secondary leading-snug line-clamp-2 mt-0.5">
              {speedCaption}
            </div>
          </div>
        </div>

        {/* Errors */}
        <div className="bg-surface-subtle border border-border rounded-lg p-3.5 flex flex-col justify-between gap-2 min-w-0 h-full">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-text-secondary truncate">
              Errors
            </span>
            <AlertCircle
              size={ICON_SIZES.inline}
              aria-hidden="true"
              className={
                (rejectedCount ?? 0) > 0
                  ? "text-error shrink-0"
                  : (quarantinedCount ?? 0) > 0
                    ? "text-warning shrink-0"
                    : "text-text-secondary shrink-0"
              }
            />
          </div>
          <div className="min-w-0">
            <div
              className={`text-sm font-semibold leading-snug line-clamp-2 break-words ${errorsValueClass}`}
              title={errorsValue}
            >
              {errorsValue}
            </div>
            <div
              className="text-xs text-text-secondary leading-snug line-clamp-2 mt-0.5"
              title={errorsCaption}
            >
              {errorsCaption}
            </div>
          </div>
        </div>

        {/* Duration / Total processing time */}
        <div className="bg-surface-subtle border border-border rounded-lg p-3.5 flex flex-col justify-between gap-2 min-w-0 h-full">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-text-secondary truncate">
              {durationLabel}
            </span>
            <Clock
              size={ICON_SIZES.inline}
              aria-hidden="true"
              className="text-text-secondary shrink-0"
            />
          </div>
          <div className="min-w-0">
            <div
              className="text-sm font-semibold text-text leading-snug line-clamp-2 break-words"
              title={formattedDuration}
            >
              {formattedDuration}
            </div>
            <div
              className="text-xs text-text-secondary leading-snug line-clamp-2 mt-0.5"
              title={durationCaption}
            >
              {durationCaption}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
