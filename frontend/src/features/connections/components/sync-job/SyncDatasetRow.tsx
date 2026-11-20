import React from "react";
import type { SyncDataset } from "./syncJobTypes";
import { STATUS_CONFIG } from "./syncJobTypes";
import { formatOutcomeSummary, formatStartTime } from "./syncJobHelpers";

interface SyncDatasetRowProps {
  ds: SyncDataset;
  isSelected?: boolean;
  onSelect?: (ds: SyncDataset, triggerEl: HTMLButtonElement | null) => void;
}

export const SyncDatasetRow: React.FC<SyncDatasetRowProps> = ({
  ds,
  isSelected = false,
  onSelect,
}) => {
  const pct =
    typeof ds.totalRecords === "number" &&
    ds.totalRecords > 0 &&
    typeof ds.syncedRecords === "number"
      ? Math.min(100, Math.round((ds.syncedRecords / ds.totalRecords) * 100))
      : ds.status === "completed" || ds.status === "completed_with_issues"
        ? 100
        : 0;
  const dsCfg = STATUS_CONFIG[ds.status];
  const outcomeSummary = formatOutcomeSummary(ds);
  const startLabel = formatStartTime(ds.startedAt);
  const shortRunId = ds.id.slice(0, 8);
  const showFileName =
    Boolean(ds.fileName) &&
    ds.fileName!.toLowerCase() !== ds.name.toLowerCase();

  return (
    <button
      type="button"
      onClick={(e) => onSelect?.(ds, e.currentTarget)}
      aria-pressed={isSelected}
      className={`w-full text-left rounded-lg p-3 border transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        isSelected
          ? "bg-primary-tint/40 border-primary"
          : "bg-surface border-border hover:bg-surface-hover hover:border-border-focus/60"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center flex-wrap gap-1.5 min-w-0">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${dsCfg.dot}`}
            aria-hidden="true"
          />
          <span
            className="text-xs font-semibold text-text truncate max-w-[200px] sm:max-w-[260px]"
            title={ds.name}
          >
            {ds.name}
          </span>
          {ds.pipelineTypeLabel && (
            <span className="text-[11px] text-text-secondary bg-surface-subtle border border-border-subtle px-1.5 py-0.5 rounded shrink-0">
              {ds.pipelineTypeLabel}
            </span>
          )}
          <span className="text-[11px] text-text-secondary bg-surface-subtle border border-border px-1.5 py-0.5 rounded font-medium shrink-0">
            {ds.sourceType}
          </span>
        </div>

        <span
          className={`text-[11px] px-2 py-0.5 rounded-full border shrink-0 whitespace-nowrap ${dsCfg.badge}`}
        >
          {dsCfg.label}
        </span>
      </div>

      <div className="w-full bg-surface-muted rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 motion-reduce:transition-none ${dsCfg.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mt-2 text-xs text-text-secondary">
        <span className="truncate" title={outcomeSummary}>
          {outcomeSummary}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {showFileName && (
            <span
              className="text-[11px] text-text-muted truncate max-w-[140px]"
              title={ds.fileName}
            >
              {ds.fileName}
            </span>
          )}
          <span
            className="font-mono text-[11px] text-text-muted"
            title={`Run ID: ${ds.id}`}
          >
            #{shortRunId}
          </span>
          <span
            className="text-[11px] text-text-secondary"
            title={ds.startedAt ? ds.startedAt.toLocaleString() : undefined}
          >
            {startLabel}
          </span>
        </div>
      </div>
    </button>
  );
};
