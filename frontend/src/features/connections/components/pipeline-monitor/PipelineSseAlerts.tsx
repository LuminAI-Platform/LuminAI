import React from "react";
import type { PipelineErrorEvent } from "../../hooks/usePipelineStream";

interface PipelineSseAlertsProps {
  errors: PipelineErrorEvent[];
  onClearErrors: () => void;
}

export const PipelineSseAlerts: React.FC<PipelineSseAlertsProps> = ({
  errors,
  onClearErrors,
}) => {
  if (errors.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {errors.slice(0, 3).map((err, idx) => (
        <div
          key={`${err.runId}-${idx}`}
          className={`p-3 rounded-lg border text-xs flex items-center justify-between font-medium ${
            err.severity === "error"
              ? "bg-error-bg border-error-border text-error"
              : "bg-warning-bg border-warning-border text-warning"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/40 border border-current opacity-80 uppercase">
              {err.step}
            </span>
            <span>{err.error}</span>
            {err.timestamp && (
              <span className="text-[10px] opacity-60">· {err.timestamp}</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClearErrors}
            className="opacity-70 hover:opacity-100 text-[11px] underline cursor-pointer ml-3"
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
};
