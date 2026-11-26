import React from "react";
import { Search, Info, ICON_SIZES } from "../../../lib/icons";
import { Tooltip } from "../../../components/ui/Tooltip";
import type { CleanDataResponse } from "./connectionsTypes";
import { formatBreakdownTooltip } from "./cleanDataUtils";

interface CleanDataTelemetryStripProps {
  cleanData: CleanDataResponse | null;
  recordsCount: number;
  verifiedCount: number;
  needsReviewCount: number;
  rejectedCount: number;
  cleanSearchFilter: string;
  onSearchChange: (v: string) => void;
}

export const CleanDataTelemetryStrip: React.FC<
  CleanDataTelemetryStripProps
> = ({
  cleanData,
  recordsCount,
  verifiedCount,
  needsReviewCount,
  rejectedCount,
  cleanSearchFilter,
  onSearchChange,
}) => {
  const rawTotal = cleanData?.totalRawRecords ?? recordsCount;
  const afterCleaning = cleanData?.totalCleanRecords ?? null;
  const includesQuarantined =
    afterCleaning !== null &&
    rejectedCount > 0 &&
    afterCleaning === verifiedCount + needsReviewCount + rejectedCount;

  const qualityTooltip = formatBreakdownTooltip(
    cleanData?.qualityBreakdown,
    cleanData?.qualityExplanation,
  );

  return (
    <div className="px-6 py-3 bg-surface-subtle border-b border-border flex flex-wrap items-center justify-between gap-4 text-xs shrink-0">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
        <div>
          <span className="text-[11px] text-text-secondary block">
            Raw records
          </span>
          <span className="text-sm font-semibold text-text tabular-nums">
            {rawTotal.toLocaleString()}
          </span>
        </div>

        <div>
          <span className="text-[11px] text-text-secondary block">
            Records after cleaning
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold text-text tabular-nums">
              {afterCleaning !== null ? afterCleaning.toLocaleString() : "—"}
            </span>
            {includesQuarantined && (
              <span className="text-[11px] text-text-muted">
                (includes {rejectedCount.toLocaleString()} quarantined)
              </span>
            )}
          </div>
        </div>

        <div>
          <span className="text-[11px] text-text-secondary block">
            Duplicates merged
          </span>
          <span className="text-sm font-semibold text-text tabular-nums">
            {cleanData
              ? (cleanData.duplicatesMerged ?? 0).toLocaleString()
              : "—"}
          </span>
        </div>

        <div>
          <span className="text-[11px] text-text-secondary block">
            Verified
          </span>
          <span className="text-sm font-semibold text-text tabular-nums">
            {cleanData ? verifiedCount.toLocaleString() : "—"}
          </span>
        </div>

        <div>
          <span className="text-[11px] text-text-secondary block">
            Needs review
          </span>
          <span
            className={`text-sm font-semibold tabular-nums ${
              cleanData && needsReviewCount > 0 ? "text-warning" : "text-text"
            }`}
          >
            {cleanData ? needsReviewCount.toLocaleString() : "—"}
          </span>
        </div>

        <div>
          <span className="text-[11px] text-text-secondary block">
            Quarantined
          </span>
          <span
            className={`text-sm font-semibold tabular-nums ${
              cleanData && rejectedCount > 0 ? "text-warning" : "text-text"
            }`}
          >
            {cleanData ? rejectedCount.toLocaleString() : "—"}
          </span>
        </div>

        <div>
          <span className="text-[11px] text-text-secondary flex items-center gap-1">
            Quality score
            <Tooltip label={qualityTooltip} side="bottom">
              <button
                type="button"
                aria-label="Quality score explanation"
                className="text-text-muted hover:text-text cursor-pointer inline-flex items-center focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary rounded"
              >
                <Info size={12} aria-hidden="true" />
              </button>
            </Tooltip>
          </span>
          <span className="text-sm font-semibold text-text tabular-nums">
            {cleanData?.dataQualityScore != null
              ? `${Math.round(cleanData.dataQualityScore)}%`
              : "—"}
          </span>
        </div>
      </div>

      <div className="relative w-56">
        <Search
          size={ICON_SIZES.inline}
          className="text-text-secondary absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          aria-label="Filter loaded rows"
          placeholder="Filter loaded rows"
          value={cleanSearchFilter}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-surface border border-border text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-border-focus"
        />
      </div>
    </div>
  );
};
