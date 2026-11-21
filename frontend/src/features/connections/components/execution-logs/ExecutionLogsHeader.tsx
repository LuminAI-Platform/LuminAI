import React from "react";
import { RefreshCw, Trash2, Play, ICON_SIZES } from "../../../../lib/icons";
import type { StreamConnectionState } from "./executionLogTypes";
import { STREAM_BADGE } from "./executionLogParser";

interface ExecutionLogsHeaderProps {
  title: string;
  entryCount: number;
  streamState: StreamConnectionState;
  paused: boolean;
  onTogglePause: () => void;
  onReconnect: () => void;
  onRequestClear: () => void;
  canClear: boolean;
}

export const ExecutionLogsHeader: React.FC<ExecutionLogsHeaderProps> = ({
  title,
  entryCount,
  streamState,
  paused,
  onTogglePause,
  onReconnect,
  onRequestClear,
  canClear,
}) => {
  const streamMeta = STREAM_BADGE[streamState];

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-surface-subtle border-b border-border">
      <div className="flex items-center gap-2 min-w-0">
        <h2 className="text-sm font-semibold text-text truncate">{title}</h2>
        <span className="text-xs text-text-secondary shrink-0">
          {entryCount} {entryCount === 1 ? "entry" : "entries"}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${streamMeta.cls}`}
          data-testid="stream-status-chip"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${streamMeta.dot}`}
            aria-hidden="true"
          />
          <span>{streamMeta.label}</span>
        </span>

        {streamState === "disconnected" && (
          <button
            type="button"
            onClick={onReconnect}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface border border-border text-xs font-medium text-text hover:border-border-focus transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <RefreshCw size={12} aria-hidden="true" />
            <span>Reconnect</span>
          </button>
        )}

        <button
          type="button"
          onClick={onTogglePause}
          title={paused ? "Resume stream" : "Pause stream"}
          aria-label={paused ? "Resume stream" : "Pause stream"}
          className="p-1.5 rounded-md bg-surface border border-border text-text-secondary hover:text-text hover:border-border-focus transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {paused ? (
            <Play size={ICON_SIZES.inline} aria-hidden="true" />
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          )}
        </button>

        <button
          type="button"
          onClick={onRequestClear}
          disabled={!canClear}
          title="Clear this view"
          aria-label="Clear this view"
          className="p-1.5 rounded-md bg-surface border border-border text-text-secondary hover:text-text hover:border-border-focus disabled:opacity-40 disabled:cursor-not-allowed transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Trash2 size={ICON_SIZES.inline} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
