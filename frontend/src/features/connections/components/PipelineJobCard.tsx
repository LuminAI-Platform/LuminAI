import React, { useState } from "react";
import {
  type PipelineJob,
  STATUS_META,
  formatNumber,
  formatDuration,
  formatTime,
} from "./pipeline-job/pipelineJobTypes";
import { ConnectorIcon } from "./pipeline-job/ConnectorIcon";
import { JobErrorLog } from "./pipeline-job/JobErrorLog";

export type {
  PipelineJobStatus,
  PipelineErrorEntry,
  PipelineJob,
} from "./pipeline-job/pipelineJobTypes";

interface PipelineJobCardProps {
  job: PipelineJob;
}

export const PipelineJobCard: React.FC<PipelineJobCardProps> = ({ job }) => {
  const [expanded, setExpanded] = useState(false);
  const meta = STATUS_META[job.status];
  const hasErrors = job.errors.length > 0;

  return (
    <div
      id={`pipeline-job-${job.id}`}
      className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden transition-all duration-200 hover:border-zinc-700"
    >
      {/* ── Main Row ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-12 items-center gap-3 px-4 py-3.5 select-none">
        {/* Connector name + type */}
        <div className="col-span-3 flex items-center gap-2.5 min-w-0">
          <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-400">
            <ConnectorIcon type={job.connectorType} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-zinc-100 truncate leading-tight">
              {job.connectorName}
            </div>
            <div className="text-[10px] text-zinc-500 font-mono truncate mt-0.5">
              {job.connectorType}
            </div>
          </div>
        </div>

        {/* Status badge */}
        <div className="col-span-2 flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${meta.dotClass}`}
          />
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border tracking-wide ${meta.badgeClass}`}
          >
            {meta.label}
          </span>
        </div>

        {/* Progress bar */}
        <div className="col-span-3 flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-zinc-500">
              {Math.round(job.progress)}%
            </span>
            <span className="text-[10px] text-zinc-600">
              {formatNumber(job.recordsOutput)}/{formatNumber(job.recordsInput)}
            </span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${Math.min(job.progress, 100)}%`,
                backgroundColor: meta.barColor,
                boxShadow:
                  job.status === "RUNNING"
                    ? `0 0 6px ${meta.barColor}66`
                    : undefined,
              }}
            />
          </div>
        </div>

        {/* Throughput */}
        <div className="col-span-2 flex flex-col items-start">
          <div className="text-xs font-bold text-zinc-200 leading-tight">
            {formatNumber(job.throughput)}
            <span className="text-zinc-500 font-normal text-[10px]">
              {" "}
              rec/s
            </span>
          </div>
          <div className="text-[10px] text-zinc-600 mt-0.5">
            {formatDuration(job.durationSeconds)}
          </div>
        </div>

        {/* Start time + expand button */}
        <div className="col-span-2 flex items-center justify-between">
          <div className="text-[10px] text-zinc-500">
            {formatTime(job.startedAt)}
          </div>
          <button
            id={`pipeline-job-expand-${job.id}`}
            onClick={() => setExpanded((v) => !v)}
            disabled={!hasErrors}
            title={hasErrors ? "Toggle error log" : "No errors"}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer border ${
              hasErrors
                ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
                : "bg-zinc-800/50 border-zinc-800 text-zinc-600 cursor-not-allowed"
            }`}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              {hasErrors ? (
                <>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </>
              ) : (
                <>
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="9 12 11 14 15 10" />
                </>
              )}
            </svg>
            {hasErrors ? `${job.errors.length} err` : "Clean"}
            {hasErrors && (
              <svg
                width="9"
                height="9"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ── Error Log Accordion ───────────────────────────────────────────────── */}
      {hasErrors && <JobErrorLog job={job} expanded={expanded} />}
    </div>
  );
};
