import React, { useState } from "react";
import { AlertCircle, X } from "../../../../lib/icons";
import type { ExecutionError } from "./executionLogTypes";

interface ErrorBlockProps {
  error: ExecutionError;
  onDismiss?: (id: string) => void;
}

export const ErrorBlock: React.FC<ErrorBlockProps> = ({ error, onDismiss }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-colors motion-reduce:transition-none ${
        error.retryable
          ? "border-warning-border bg-warning-bg"
          : "border-error-border bg-error-bg"
      }`}
    >
      <div className="flex items-start gap-3 p-3">
        <div
          className={`mt-0.5 shrink-0 ${error.retryable ? "text-warning" : "text-error"}`}
        >
          <AlertCircle size={15} aria-hidden="true" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[11px] font-semibold px-1.5 py-0.5 rounded border ${
                error.retryable
                  ? "bg-warning-bg text-warning border-warning-border"
                  : "bg-error-bg text-error border-error-border"
              }`}
            >
              {error.code}
            </span>
            <span className="text-xs text-text-secondary">{error.source}</span>
            {error.retryable && (
              <span className="text-[11px] text-warning bg-surface px-1.5 py-0.5 rounded border border-warning-border">
                Retryable
              </span>
            )}
          </div>
          <p className="text-xs text-text mt-1 leading-snug">{error.message}</p>
          {error.detail && expanded && (
            <p className="text-[11px] text-text-secondary leading-relaxed mt-2 border-l-2 border-border pl-3 font-mono break-words">
              {error.detail}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {error.detail && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-text-secondary hover:text-text px-2 py-0.5 rounded hover:bg-surface transition-colors cursor-pointer"
            >
              {expanded ? "Less" : "Details"}
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={() => onDismiss(error.id)}
              aria-label="Dismiss error"
              className="p-1 text-text-secondary hover:text-text rounded hover:bg-surface transition-colors cursor-pointer"
            >
              <X size={13} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
