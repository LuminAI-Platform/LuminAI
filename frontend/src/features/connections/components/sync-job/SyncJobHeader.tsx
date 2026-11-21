import React from "react";
import { Database, FileText, Plug } from "../../../../lib/icons";
import type { SyncDataset, SyncJobStatus } from "./syncJobTypes";
import { STATUS_CONFIG } from "./syncJobTypes";

interface SyncJobHeaderProps {
  datasetsCount: number;
  isAllScope: boolean;
  selectedDataset: SyncDataset | null;
  scopeStatus: SyncJobStatus;
  onToggleScope: () => void;
  onPause?: (jobId: string) => void;
  onResume?: (jobId: string) => void;
  onCancel?: (jobId: string) => void;
}

export const SyncJobHeader: React.FC<SyncJobHeaderProps> = ({
  datasetsCount,
  isAllScope,
  selectedDataset,
  scopeStatus,
  onToggleScope,
  onPause,
  onResume,
  onCancel,
}) => {
  const headerTitle = isAllScope
    ? "All sync activity"
    : `Sync: ${selectedDataset?.name ?? "Dataset"}`;
  const scopeCaption = isAllScope
    ? `${datasetsCount} ${datasetsCount === 1 ? "dataset" : "datasets"}`
    : "1 dataset";
  const cfg = STATUS_CONFIG[scopeStatus];

  const SourceIcon =
    !isAllScope && selectedDataset?.sourceType === "File"
      ? FileText
      : !isAllScope && selectedDataset?.sourceType === "API"
        ? Plug
        : Database;

  return (
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
        {datasetsCount > 1 && (
          <button
            type="button"
            onClick={onToggleScope}
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
  );
};
