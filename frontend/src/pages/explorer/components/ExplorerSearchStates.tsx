import React, { useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  RotateCcw,
} from "../../../lib/icons";
import type { ViewMode } from "../types";

interface ExplorerLoadingStateProps {
  viewMode?: ViewMode;
  count?: number;
}

/**
 * Skeleton cards (or table rows) matching the exact Entity Explorer result layout.
 */
export const ExplorerLoadingState: React.FC<ExplorerLoadingStateProps> = ({
  viewMode = "cards",
  count = 6,
}) => {
  if (viewMode === "table") {
    return (
      <div
        aria-busy="true"
        aria-label="Loading entities"
        className="bg-surface border border-border rounded-xl overflow-hidden"
      >
        <div className="h-10 bg-surface-subtle/60 border-b border-border" />
        <div className="divide-y divide-border-subtle">
          {Array.from({ length: count }).map((_, idx) => (
            <div
              key={idx}
              className="flex items-center gap-4 px-4 py-3.5 animate-pulse motion-reduce:animate-none"
            >
              <div className="w-7 h-7 rounded-lg bg-surface-subtle shrink-0" />
              <div className="h-3.5 w-36 rounded bg-surface-subtle" />
              <div className="h-5 w-20 rounded-md bg-surface-subtle" />
              <div className="h-3.5 w-28 rounded bg-surface-subtle hidden sm:block" />
              <div className="h-3.5 w-20 rounded bg-surface-subtle ml-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      aria-busy="true"
      aria-label="Loading entities"
      className="grid grid-cols-1 md:grid-cols-2 gap-4"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-4 animate-pulse motion-reduce:animate-none"
        >
          {/* Title Row Skeleton */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-lg bg-surface-subtle shrink-0" />
              <div className="flex flex-col gap-1.5 flex-1">
                <div className="h-4 w-3/5 rounded bg-surface-subtle" />
                <div className="h-3 w-1/4 rounded bg-surface-subtle" />
              </div>
            </div>
            <div className="h-5 w-16 rounded-md bg-surface-subtle shrink-0" />
          </div>

          {/* 4 Key Fields Skeleton */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 py-3 border-t border-b border-border-subtle">
            {Array.from({ length: 4 }).map((__, fIdx) => (
              <div key={fIdx} className="flex flex-col gap-1">
                <div className="h-2.5 w-14 rounded bg-surface-subtle" />
                <div className="h-3.5 w-24 rounded bg-surface-subtle" />
              </div>
            ))}
          </div>

          {/* Footer Skeleton */}
          <div className="flex items-center justify-between gap-2">
            <div className="h-3.5 w-32 rounded bg-surface-subtle" />
            <div className="h-5 w-12 rounded-md bg-surface-subtle" />
          </div>
        </div>
      ))}
    </div>
  );
};

interface ExplorerErrorStateProps {
  error: string;
  details?: string | null;
  onRetry: () => void;
}

export const ExplorerErrorState: React.FC<ExplorerErrorStateProps> = ({
  error,
  details,
  onRetry,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center py-14 px-6 bg-error-bg border border-error-border rounded-xl text-center"
    >
      <div className="w-11 h-11 rounded-xl bg-surface border border-error-border flex items-center justify-center text-error mb-3">
        <AlertCircle size={20} aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-text">
        {error || "Couldn't load entities"}
      </h3>
      <p className="text-xs text-text-secondary max-w-sm mt-1">
        The search request could not be completed. Check your connection and try
        again.
      </p>

      <div className="flex items-center gap-2 mt-4">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-primary-text bg-primary hover:bg-primary-hover rounded-lg transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
        >
          <RotateCcw size={13} aria-hidden="true" />
          <span>Retry</span>
        </button>

        {details && (
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            aria-expanded={showDetails}
            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-text-secondary hover:text-text bg-surface border border-border rounded-lg transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
          >
            {showDetails ? (
              <ChevronDown size={13} aria-hidden="true" />
            ) : (
              <ChevronRight size={13} aria-hidden="true" />
            )}
            <span>Details</span>
          </button>
        )}
      </div>

      {details && showDetails && (
        <pre className="mt-4 max-w-md w-full text-left text-[11px] font-mono text-error bg-surface border border-error-border rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
          {details}
        </pre>
      )}
    </div>
  );
};
