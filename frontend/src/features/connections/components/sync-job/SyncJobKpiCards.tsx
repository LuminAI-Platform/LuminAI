import React from "react";
import type { SyncJob } from "./syncJobTypes";
import { formatNumber, formatDuration } from "./syncJobHelpers";

const ProgressRing: React.FC<{
  pct: number;
  color?: string;
  size?: number;
}> = ({ pct, color = "#3b82f6", size = 40 }) => {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="#27272a"
        strokeWidth="3"
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth="3"
        fill="none"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-500 ease-out"
      />
    </svg>
  );
};

const Sparkline: React.FC<{
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}> = ({ data, color = "#3b82f6", width = 64, height = 24 }) => {
  if (data.length < 2) return <div style={{ width, height }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

interface SyncJobKpiCardsProps {
  job: SyncJob;
  overallPct: number;
  totalSynced: number;
  totalRecords: number;
  currentSpeed: number;
  speedHistory: number[];
  avgSpeed: number;
  totalErrors: number;
  durationSec: number;
}

export const SyncJobKpiCards: React.FC<SyncJobKpiCardsProps> = ({
  job,
  overallPct,
  totalSynced,
  totalRecords,
  currentSpeed,
  speedHistory,
  avgSpeed,
  totalErrors,
  durationSec,
}) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5">
      {/* Progress */}
      <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-3">
        <div className="relative flex-shrink-0">
          <ProgressRing
            pct={overallPct}
            color={job.status === "failed" ? "#ef4444" : "#3b82f6"}
          />
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-zinc-300">
            {Math.floor(overallPct)}%
          </span>
        </div>
        <div>
          <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide">
            Progress
          </div>
          <div className="text-xs text-zinc-200 font-semibold leading-tight mt-0.5">
            {formatNumber(totalSynced)}
            <span className="text-zinc-500 font-normal">
              /{formatNumber(totalRecords)}
            </span>
          </div>
        </div>
      </div>

      {/* Speed */}
      <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-3">
        <div className="flex-shrink-0">
          <Sparkline data={speedHistory} color="#3b82f6" />
        </div>
        <div>
          <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide">
            Speed
          </div>
          <div className="text-xs text-blue-400 font-bold leading-tight mt-0.5">
            {formatNumber(currentSpeed)}
            <span className="text-zinc-500 font-normal text-[10px]">
              {" "}
              rec/s
            </span>
          </div>
          <div className="text-[10px] text-zinc-500">
            avg {formatNumber(avgSpeed)}/s
          </div>
        </div>
      </div>

      {/* Errors */}
      <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-3">
        <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center flex-shrink-0">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={totalErrors > 0 ? "text-red-400" : "text-zinc-500"}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div>
          <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide">
            Errors
          </div>
          <div
            className={`text-xs font-bold leading-tight mt-0.5 ${totalErrors > 0 ? "text-red-400" : "text-zinc-300"}`}
          >
            {formatNumber(totalErrors)}
          </div>
          <div className="text-[10px] text-zinc-500">
            {totalRecords > 0
              ? ((totalErrors / totalRecords) * 100).toFixed(2)
              : "0.00"}
            % rate
          </div>
        </div>
      </div>

      {/* Duration */}
      <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-3">
        <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center flex-shrink-0">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-zinc-400"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <div>
          <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide">
            Duration
          </div>
          <div className="text-xs text-zinc-200 font-semibold leading-tight mt-0.5">
            {formatDuration(durationSec)}
          </div>
          {job.estimatedEnd && (
            <div className="text-[10px] text-zinc-500">
              eta{" "}
              {job.estimatedEnd.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
