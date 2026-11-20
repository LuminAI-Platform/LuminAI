import React from "react";
import { Search, Copy, Check, ICON_SIZES } from "../../../../lib/icons";
import type { LogLevel } from "./executionLogTypes";

const LEVEL_FILTERS: { id: LogLevel | "ALL"; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "INFO", label: "Info" },
  { id: "SUCCESS", label: "Success" },
  { id: "WARN", label: "Warn" },
  { id: "ERROR", label: "Error" },
  { id: "DEBUG", label: "Debug" },
];

interface LogFilterToolbarProps {
  filter: LogLevel | "ALL";
  setFilter: (f: LogLevel | "ALL") => void;
  counts: Record<LogLevel | "ALL", number>;
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  visibleCount: number;
  copiedAll: boolean;
  onCopyVisible: () => void;
}

export const LogFilterToolbar: React.FC<LogFilterToolbarProps> = ({
  filter,
  setFilter,
  counts,
  searchTerm,
  setSearchTerm,
  visibleCount,
  copiedAll,
  onCopyVisible,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-surface-subtle/60 border-b border-border">
      <div
        role="tablist"
        aria-label="Filter log levels"
        className="flex flex-wrap items-center gap-1"
      >
        {LEVEL_FILTERS.map((lvl) => {
          const isSelected = filter === lvl.id;
          return (
            <button
              key={lvl.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setFilter(lvl.id)}
              className={`px-2 py-1 rounded-md text-xs font-medium transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                isSelected
                  ? "bg-surface text-text border border-border shadow-2xs"
                  : "text-text-secondary hover:text-text border border-transparent hover:bg-surface/60"
              }`}
            >
              {lvl.label}{" "}
              <span className="text-[11px] text-text-muted">
                ({counts[lvl.id]})
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 flex-1 sm:flex-initial justify-end">
        <div className="flex items-center gap-1.5 bg-surface border border-border rounded-lg px-2.5 py-1 focus-within:border-border-focus min-w-[180px] flex-1 sm:flex-initial sm:w-52">
          <Search
            size={ICON_SIZES.inline}
            className="text-text-muted shrink-0"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter message, source, or run ID..."
            aria-label="Filter logs by message, source, or run ID"
            className="bg-transparent border-none outline-none text-xs text-text placeholder:text-text-muted w-full"
          />
        </div>

        <button
          type="button"
          onClick={onCopyVisible}
          disabled={visibleCount === 0}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-border text-xs font-medium text-text-secondary hover:text-text hover:border-border-focus disabled:opacity-40 disabled:cursor-not-allowed transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {copiedAll ? (
            <>
              <Check
                size={12}
                className="text-success shrink-0"
                aria-hidden="true"
              />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy size={12} className="shrink-0" aria-hidden="true" />
              <span>Copy visible lines</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
