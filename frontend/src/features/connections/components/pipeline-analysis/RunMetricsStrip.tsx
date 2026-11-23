import React from "react";
import type { PipelineRunItem } from "./pipelineAnalysisTypes";

interface RunMetricsStripProps {
  run: PipelineRunItem;
}

export const RunMetricsStrip: React.FC<RunMetricsStripProps> = ({ run }) => {
  return (
    <div className="grid grid-cols-4 gap-2 bg-surface-subtle border border-border rounded-lg p-3 text-center">
      <div>
        <span className="text-[10px] text-text-secondary uppercase">
          Records In
        </span>
        <div className="text-sm font-bold text-text mt-0.5">
          {run.recordsInput.toLocaleString()}
        </div>
      </div>
      <div>
        <span className="text-[10px] text-text-secondary uppercase">
          Output
        </span>
        <div className="text-sm font-bold text-success mt-0.5">
          {run.recordsOutput.toLocaleString()}
        </div>
      </div>
      <div>
        <span className="text-[10px] text-text-secondary uppercase">
          Rejected
        </span>
        <div
          className={`text-sm font-bold mt-0.5 ${
            run.recordsFailed > 0 ? "text-error" : "text-text"
          }`}
        >
          {run.recordsFailed.toLocaleString()}
        </div>
      </div>
      <div>
        <span className="text-[10px] text-text-secondary uppercase">
          Duration
        </span>
        <div className="text-sm font-bold text-text mt-0.5">
          {run.durationSeconds}s
        </div>
      </div>
    </div>
  );
};
