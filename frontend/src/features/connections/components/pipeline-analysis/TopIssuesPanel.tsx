import React from "react";
import {
  AlertTriangle,
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
} from "lucide-react";
import type {
  RejectionReasonItem,
  FailingPipelineItem,
} from "./pipelineAnalysisTypes";

interface TopIssuesPanelProps {
  topReasons: RejectionReasonItem[];
  failingPipelines: FailingPipelineItem[];
  onSelectRun?: (runId: string) => void;
}

export const TopIssuesPanel: React.FC<TopIssuesPanelProps> = ({
  topReasons = [],
  failingPipelines = [],
  onSelectRun,
}) => {
  const hasReasons = topReasons.length > 0;
  const hasFailingPipelines = failingPipelines.length > 0;
  const isAllClean = !hasReasons && !hasFailingPipelines;

  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-xs transition-colors select-none">
      <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-error">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text">
              Top Issues & Failure Diagnostics
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Primary rejection causes, quarantine reasons, and pipelines
              requiring attention
            </p>
          </div>
        </div>
      </div>

      {isAllClean ? (
        <div className="flex flex-col items-center justify-center py-8 text-center bg-surface-subtle/30 border border-dashed border-border rounded-lg">
          <div className="w-8 h-8 rounded-full bg-success-bg border border-success-border flex items-center justify-center text-success mb-2">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-text">
            No rejection issues or failed runs
          </span>
          <p className="text-[11px] text-text-secondary mt-0.5 max-w-sm">
            All executed pipeline batches have passed schema validation and
            entity resolution cleanly.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Top Rejection Reasons */}
          <div className="bg-surface-subtle border border-border rounded-lg p-3.5">
            <h4 className="text-xs font-bold text-text mb-2 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-warning" />
              <span>Top Rejection & Quarantine Reasons</span>
            </h4>
            {!hasReasons ? (
              <p className="text-xs text-text-secondary py-3">
                No rejected records detected.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {topReasons.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-md bg-surface border border-border text-xs"
                  >
                    <span
                      className="text-text font-medium truncate max-w-[280px]"
                      title={item.reason}
                    >
                      {item.reason}
                    </span>
                    <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-error-bg text-error border border-error-border shrink-0 ml-2">
                      {item.count.toLocaleString()} dropped
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pipelines that Fail Most */}
          <div className="bg-surface-subtle border border-border rounded-lg p-3.5">
            <h4 className="text-xs font-bold text-text mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-error" />
              <span>Pipelines with Highest Failures</span>
            </h4>
            {!hasFailingPipelines ? (
              <p className="text-xs text-text-secondary py-3">
                No pipelines with recorded failures.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {failingPipelines.map((pipe) => (
                  <div
                    key={pipe.pipelineId}
                    className="flex items-center justify-between p-2 rounded-md bg-surface border border-border text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold text-text truncate">
                        {pipe.pipelineName}
                      </div>
                      {pipe.lastError && (
                        <div
                          className="text-[10px] text-text-secondary truncate mt-0.5"
                          title={pipe.lastError}
                        >
                          {pipe.lastError}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-error-bg text-error border border-error-border">
                        {pipe.failureCount} failed
                      </span>
                      {pipe.lastRunId && onSelectRun && (
                        <button
                          type="button"
                          onClick={() => onSelectRun(pipe.lastRunId!)}
                          className="p-1 text-text-secondary hover:text-text hover:bg-surface-subtle rounded transition-colors cursor-pointer"
                          title="View run detail"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
