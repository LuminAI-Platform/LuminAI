import React from "react";
import { FileText, ShieldCheck } from "../../../../lib/icons";
import type { PipelineRunItem, EngineJobDetail } from "./pipelineAnalysisTypes";

interface RunExecutionQualityAndLogsProps {
  run: PipelineRunItem;
  jobDetail: EngineJobDetail | null;
  isFailed: boolean;
  errorMessage: string | null;
}

export const RunExecutionQualityAndLogs: React.FC<
  RunExecutionQualityAndLogsProps
> = ({ run, jobDetail, isFailed, errorMessage }) => {
  return (
    <>
      {/* Quality Scores */}
      <div className="bg-surface-subtle border border-border rounded-xl p-4">
        <h4 className="text-xs font-bold text-text mb-2 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-success" />
          <span>Evaluated Quality Scores</span>
        </h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded bg-surface border border-border flex justify-between">
            <span className="text-text-secondary">Completeness</span>
            <span className="font-bold text-text">
              {jobDetail?.quality_scores?.completeness !== undefined
                ? `${jobDetail.quality_scores.completeness.toFixed(1)}%`
                : run.recordsInput > 0
                  ? `${(((run.recordsInput - run.recordsFailed) / run.recordsInput) * 100).toFixed(1)}%`
                  : "–"}
            </span>
          </div>
          <div className="p-2 rounded bg-surface border border-border flex justify-between">
            <span className="text-text-secondary">Uniqueness</span>
            <span className="font-bold text-text">
              {jobDetail?.quality_scores?.uniqueness !== undefined
                ? `${jobDetail.quality_scores.uniqueness.toFixed(1)}%`
                : "–"}
            </span>
          </div>
          <div className="p-2 rounded bg-surface border border-border flex justify-between">
            <span className="text-text-secondary">Consistency</span>
            <span className="font-bold text-text">
              {jobDetail?.quality_scores?.consistency !== undefined
                ? `${jobDetail.quality_scores.consistency.toFixed(1)}%`
                : "–"}
            </span>
          </div>
          <div className="p-2 rounded bg-surface border border-border flex justify-between">
            <span className="text-text-secondary">Timeliness</span>
            <span className="font-bold text-text">
              {jobDetail?.quality_scores?.timeliness !== undefined
                ? `${jobDetail.quality_scores.timeliness.toFixed(1)}%`
                : run.durationSeconds > 0
                  ? `${run.durationSeconds}s`
                  : "–"}
            </span>
          </div>
        </div>
      </div>

      {/* Logs */}
      <div className="bg-surface-subtle border border-border rounded-xl p-4">
        <h4 className="text-xs font-bold text-text mb-2 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-text-secondary" />
          <span>Execution Logs</span>
        </h4>
        <div className="bg-page border border-border rounded-lg p-3 font-mono text-[11px] text-text-secondary max-h-48 overflow-y-auto space-y-1">
          {jobDetail?.logs && jobDetail.logs.length > 0 ? (
            jobDetail.logs.map((logLine, idx) => <div key={idx}>{logLine}</div>)
          ) : (
            <>
              <div>
                [{new Date(run.startedAt).toISOString()}] Pipeline run initiated
                for source: {run.connectorName}
              </div>
              <div>
                [{new Date(run.startedAt).toISOString()}] Total input records:{" "}
                {run.recordsInput.toLocaleString()}
              </div>
              {isFailed ? (
                <div className="text-error">
                  [{new Date(run.completedAt || run.startedAt).toISOString()}]
                  ERROR: {errorMessage}
                </div>
              ) : (
                <div className="text-success">
                  [{new Date(run.completedAt || run.startedAt).toISOString()}]
                  Completed: {run.recordsOutput.toLocaleString()} records
                  processed
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};
