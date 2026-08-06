import React, { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PipelineJobStatus = "RUNNING" | "CLEANED" | "COMPLETED" | "FAILED";

export interface PipelineErrorEntry {
  timestamp: string;
  level: "ERROR" | "WARN" | "INFO";
  message: string;
  record?: string;
}

export interface PipelineJob {
  id: string;
  connectorName: string;
  connectorType: string;
  status: PipelineJobStatus;
  progress: number; // 0–100
  recordsInput: number;
  recordsOutput: number;
  recordsFailed: number;
  throughput: number; // records/sec
  startedAt: string; // ISO 8601
  durationSeconds: number;
  errors: PipelineErrorEntry[];
}

interface PipelineJobCardProps {
  job: PipelineJob;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_META: Record<
  PipelineJobStatus,
  {
    label: string;
    dotClass: string;
    badgeClass: string;
    barColor: string;
  }
> = {
  RUNNING: {
    label: "RUNNING",
    dotClass: "bg-blue-500 animate-pulse",
    badgeClass:
      "bg-blue-500/10 border-blue-500/30 text-blue-400",
    barColor: "#3b82f6",
  },
  CLEANED: {
    label: "CLEANED",
    dotClass: "bg-violet-500",
    badgeClass:
      "bg-violet-500/10 border-violet-500/30 text-violet-400",
    barColor: "#8b5cf6",
  },
  COMPLETED: {
    label: "COMPLETED",
    dotClass: "bg-emerald-500",
    badgeClass:
      "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
    barColor: "#10b981",
  },
  FAILED: {
    label: "FAILED",
    dotClass: "bg-red-500",
    badgeClass:
      "bg-red-500/10 border-red-500/30 text-red-400",
    barColor: "#ef4444",
  },
};

const LOG_LEVEL_CLASS: Record<PipelineErrorEntry["level"], string> = {
  ERROR: "text-red-400",
  WARN: "text-amber-400",
  INFO: "text-zinc-400",
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ─── Connector Type Icon ──────────────────────────────────────────────────────

const ConnectorIcon: React.FC<{ type: string }> = ({ type }) => {
  const t = type.toLowerCase();
  if (t.includes("postgres") || t.includes("mysql") || t.includes("sql")) {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v14c0 1.657 4.03 3 9 3s9-1.343 9-3V5" />
        <path d="M3 12c0 1.657 4.03 3 9 3s9-1.343 9-3" />
      </svg>
    );
  }
  if (t.includes("snowflake")) {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="12" y1="2" x2="12" y2="22" />
        <path d="m20 10-8-8-8 8" />
        <path d="m4 14 8 8 8-8" />
      </svg>
    );
  }
  if (t.includes("kafka") || t.includes("stream")) {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v3m0 12v3M3 12h3m12 0h3" />
      </svg>
    );
  }
  if (t.includes("s3") || t.includes("file") || t.includes("csv")) {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    );
  }
  // Default: generic database
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
};

// ─── PipelineJobCard ──────────────────────────────────────────────────────────

export const PipelineJobCard: React.FC<PipelineJobCardProps> = ({ job }) => {
  const [expanded, setExpanded] = useState(false);
  const meta = STATUS_META[job.status];
  const hasErrors = job.errors.length > 0;

  return (
    <div
      id={`pipeline-job-${job.id}`}
      className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl overflow-hidden transition-all duration-200 hover:border-zinc-700/80"
    >
      {/* ── Main Row ─────────────────────────────────────────────────────────── */}
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
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${meta.dotClass}`} />
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border tracking-wide ${meta.badgeClass}`}
          >
            {meta.label}
          </span>
        </div>

        {/* Progress bar */}
        <div className="col-span-3 flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-zinc-500 font-mono">
              {Math.round(job.progress)}%
            </span>
            <span className="text-[10px] text-zinc-600 font-mono">
              {formatNumber(job.recordsOutput)}/{formatNumber(job.recordsInput)}
            </span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${Math.min(job.progress, 100)}%`,
                backgroundColor: meta.barColor,
                boxShadow: job.status === "RUNNING"
                  ? `0 0 6px ${meta.barColor}66`
                  : undefined,
              }}
            />
          </div>
        </div>

        {/* Throughput */}
        <div className="col-span-2 flex flex-col items-start">
          <div className="text-xs font-mono font-bold text-blue-400 leading-tight">
            {formatNumber(job.throughput)}
            <span className="text-zinc-500 font-normal text-[10px]"> rec/s</span>
          </div>
          <div className="text-[10px] text-zinc-600 mt-0.5 font-mono">
            {formatDuration(job.durationSeconds)}
          </div>
        </div>

        {/* Start time + expand button */}
        <div className="col-span-2 flex items-center justify-between">
          <div className="text-[10px] text-zinc-500 font-mono">
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
      {hasErrors && (
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            expanded ? "max-h-[320px]" : "max-h-0"
          }`}
        >
          <div className="border-t border-zinc-800/80 bg-zinc-950/60">
            {/* Accordion header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800/50">
              <div className="flex items-center gap-2">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Execution Error Log
                </span>
                <span className="text-[10px] font-mono text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                  {job.errors.length} entries
                </span>
              </div>
              <div className="text-[10px] text-zinc-600 font-mono">
                {job.connectorName} · {job.id.slice(0, 8)}
              </div>
            </div>

            {/* Log entries */}
            <div className="overflow-y-auto max-h-[232px] font-mono text-[11px] divide-y divide-zinc-900/60">
              {job.errors.map((entry, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 px-4 py-2 hover:bg-zinc-900/30 transition-colors"
                >
                  <span className="text-zinc-600 flex-shrink-0 pt-px w-[70px] truncate">
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
      )}
    </div>
  );
};
