import React from "react";
import type { SyncJobStatus } from "./syncJobTypes";
import {
  AlertCircle,
  Clock,
  Activity,
  CheckCircle2,
  ICON_SIZES,
} from "../../../../lib/icons";
import { computeSyncJobKpiMetrics } from "./syncJobKpiMetrics";
import { SyncJobKpiCard, Sparkline } from "./SyncJobKpiCard";

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
  const m = computeSyncJobKpiMetrics({
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
  });

  const progressIconClass =
    status === "failed"
      ? "text-error shrink-0"
      : status === "completed_with_issues"
        ? "text-warning shrink-0"
        : status === "completed"
          ? "text-success shrink-0"
          : "text-primary shrink-0";

  const errorsIconClass =
    (rejectedCount ?? 0) > 0
      ? "text-error shrink-0"
      : (quarantinedCount ?? 0) > 0
        ? "text-warning shrink-0"
        : "text-text-secondary shrink-0";

  return (
    <div className="@container px-4 sm:px-5">
      <div className="grid grid-cols-2 @[560px]:grid-cols-4 gap-3 items-stretch">
        <SyncJobKpiCard
          label="Progress"
          trailing={
            <CheckCircle2
              size={ICON_SIZES.inline}
              aria-hidden="true"
              className={progressIconClass}
            />
          }
          value={m.progressValue}
          caption={m.progressCaption}
        />

        <SyncJobKpiCard
          label={m.speedLabel}
          trailing={
            isActive && speedHistory.length >= 2 ? (
              <Sparkline data={speedHistory} />
            ) : (
              <Activity
                size={ICON_SIZES.inline}
                aria-hidden="true"
                className="text-text-secondary shrink-0"
              />
            )
          }
          value={m.speedValue}
          valueClassName={
            isActive && typeof m.speedNumeric === "number" && m.speedNumeric > 0
              ? "text-primary"
              : "text-text"
          }
          caption={m.speedCaption}
        />

        <SyncJobKpiCard
          label="Errors"
          trailing={
            <AlertCircle
              size={ICON_SIZES.inline}
              aria-hidden="true"
              className={errorsIconClass}
            />
          }
          value={m.errorsValue}
          valueClassName={m.errorsValueClass}
          caption={m.errorsCaption}
          captionTitle={m.errorsCaption}
        />

        <SyncJobKpiCard
          label={m.durationLabel}
          trailing={
            <Clock
              size={ICON_SIZES.inline}
              aria-hidden="true"
              className="text-text-secondary shrink-0"
            />
          }
          value={m.formattedDuration}
          caption={m.durationCaption}
          captionTitle={m.durationCaption}
        />
      </div>
    </div>
  );
};
