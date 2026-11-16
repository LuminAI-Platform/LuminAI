import React, { useState } from "react";
import type { ExecutionError } from "./executionLogTypes";

interface ErrorBlockProps {
  error: ExecutionError;
  onDismiss?: (id: string) => void;
}

export const ErrorBlock: React.FC<ErrorBlockProps> = ({ error, onDismiss }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-all ${
        error.retryable
          ? "border-warning-border bg-warning-bg"
          : "border-error-border bg-error-bg"
      }`}
    >
      <div className="flex items-start gap-3 p-3">
        <div
          className={`mt-0.5 flex-shrink-0 ${error.retryable ? "text-warning" : "text-error"}`}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                error.retryable
                  ? "bg-warning-bg text-warning border-warning-border"
                  : "bg-error-bg text-error border-error-border"
              }`}
            >
              {error.code}
            </span>
            <span className="text-[10px] text-text-secondary">
              {error.source}
            </span>
            {error.retryable && (
              <span className="text-[9px] text-warning bg-warning-bg px-1 rounded">
                RETRYABLE
              </span>
            )}
          </div>
          <p className="text-xs text-text mt-1 leading-snug">{error.message}</p>
          {error.detail && expanded && (
            <p className="text-[11px] text-text-secondary leading-relaxed mt-2 border-l-2 border-border pl-3 font-mono">
              {error.detail}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {error.detail && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 px-1.5 py-0.5 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              {expanded ? "Less" : "Detail"}
            </button>
          )}
          {onDismiss && (
            <button
              onClick={() => onDismiss(error.id)}
              className="p-1 text-zinc-600 hover:text-zinc-400 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
