import React from "react";
import type { SyncJobStatus, SyncDataset } from "./syncJobTypes";
import { STATUS_CONFIG } from "./syncJobTypes";

interface SyncJobHeaderProps {
  headerTitle: string;
  scopeCaption: string;
  isAllScope: boolean;
  selectedDataset: SyncDataset | null;
  scopeStatus: SyncJobStatus;
  datasetsCount: number;
  onToggleScope: () => void;
  onPause?: (jobId: string) => void;
  onResume?: (jobId: string) => void;
  onCancel?: (jobId: string) => void;
}

export const SyncJobHeader: React.FC<SyncJobHeaderProps> = ({
  headerTitle,
  scopeCaption,
  isAllScope,
  selectedDataset,
  scopeStatus,
  datasetsCount,
  onToggleScope,
  onPause,
  onResume,
  onCancel,
}) => {
  const cfg = STATUS_CONFIG[scopeStatus];

  return (
    <div className="flex flex-col gap-2 px-4 sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <span
            className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${cfg.dot} ${
              scopeStatus === "running"
                ? "animate-pulse motion-reduce:animate-none"
                : ""
            }`}
            aria-hidden="true"
          />
          <h2
            className="text-sm font-semibold text-text leading-snug line-clamp-2 break-words min-w-0"
            title={headerTitle}
          >
            {headerTitle}
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
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
                className="px-2 py-1 text-xs rounded-lg bg-surface-subtle border border-border text-text-secondary hover:text-warning hover:border-warning-border transition-colors cursor-pointer"
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
                className="px-2 py-1 text-xs rounded-lg bg-surface-subtle border border-border text-text-secondary hover:text-success hover:border-success-border transition-colors cursor-pointer"
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
                className="px-2 py-1 text-xs rounded-lg bg-surface-subtle border border-border text-text-secondary hover:text-error hover:border-error-border transition-colors cursor-pointer"
              >
                Cancel
              </button>
            )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-4 text-xs text-text-secondary">
        <span>
          {scopeCaption}
          {!isAllScope && selectedDataset && (
            <>
              {" "}
              - Run{" "}
              <span
                className="font-mono text-[11px] text-text-muted"
                title={`Run ID: ${selectedDataset.id}`}
              >
                #{selectedDataset.id.slice(0, 8)}
              </span>
            </>
          )}
        </span>
        {datasetsCount > 1 && (
          <>
            <span aria-hidden="true" className="text-text-muted">
              ·
            </span>
            <button
              type="button"
              onClick={onToggleScope}
              className="text-xs font-medium text-primary hover:underline cursor-pointer bg-transparent border-none p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded"
            >
              {isAllScope ? "Show latest dataset" : "Show all sync activity"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
