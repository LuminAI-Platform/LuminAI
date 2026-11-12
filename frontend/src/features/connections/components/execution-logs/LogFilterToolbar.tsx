import React from "react";
import type { LogLevel } from "./executionLogTypes";

const LEVEL_FILTERS: (LogLevel | "ALL")[] = [
  "ALL",
  "INFO",
  "SUCCESS",
  "WARN",
  "ERROR",
  "DEBUG",
];

interface LogFilterToolbarProps {
  filter: LogLevel | "ALL";
  setFilter: (f: LogLevel | "ALL") => void;
  searchTerm: string;
  setSearchTerm: (s: string) => void;
}

export const LogFilterToolbar: React.FC<LogFilterToolbarProps> = ({
  filter,
  setFilter,
  searchTerm,
  setSearchTerm,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-zinc-900/30 border-b border-zinc-800/60 select-none">
      <div className="flex items-center gap-1">
        {LEVEL_FILTERS.map((lvl) => (
          <button
            key={lvl}
            onClick={() => setFilter(lvl)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer ${
              filter === lvl
                ? "bg-zinc-800 text-zinc-100 border border-zinc-700"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {lvl}
          </button>
        ))}
      </div>

      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Filter messages or source..."
        className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-[11px] text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-700 w-48 transition-colors"
      />
    </div>
  );
};
