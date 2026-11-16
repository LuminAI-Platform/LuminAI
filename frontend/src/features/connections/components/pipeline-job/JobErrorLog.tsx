import React from "react";
import type { PipelineJob } from "./pipelineJobTypes";
import { LOG_LEVEL_CLASS, formatTime } from "./pipelineJobTypes";

interface JobErrorLogProps {
  job: PipelineJob;
  expanded: boolean;
}

export const JobErrorLog: React.FC<JobErrorLogProps> = ({ job, expanded }) => (
  <div
    className={`overflow-hidden transition-all duration-300 ease-in-out ${
      expanded ? "max-h-[320px]" : "max-h-0"
    }`}
  >
    <div className="border-t border-border bg-surface-subtle">
      {/* Accordion header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-error"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">
            Execution Error Log
          </span>
          <span className="text-[10px] text-error bg-error-bg px-1.5 py-0.5 rounded border border-error-border">
            {job.errors.length} entries
          </span>
        </div>
        <div className="text-[10px] text-text-secondary font-mono">
          {job.connectorName} · {job.id.slice(0, 8)}
        </div>
      </div>

      {/* Log entries */}
      <div className="overflow-x-auto overflow-y-auto max-h-[232px] font-mono text-[11px] divide-y divide-border scrollbar-thin">
        {job.errors.map((entry, i) => (
          <div
            key={i}
            className="flex items-start gap-3 px-4 py-2 hover:bg-surface-hover transition-colors"
          >
            <span className="text-text-secondary flex-shrink-0 pt-px w-[70px] truncate">
              {formatTime(entry.timestamp)}
            </span>
            <span
              className={`flex-shrink-0 font-bold text-[10px] uppercase w-10 pt-px ${
                LOG_LEVEL_CLASS[entry.level]
              }`}
            >
              {entry.level}
            </span>
            <span className="text-zinc-300 break-all leading-relaxed">
              {entry.message}
              {entry.record && (
                <span className="ml-2 text-zinc-500 text-[10px]">
                  [record: {entry.record}]
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  </div>
);
