import React, { useState } from "react";
import {
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sliders,
  Copy,
  Check,
  ArrowDown,
} from "../../../../lib/icons";
import type { LogEntry, LogLevel } from "./executionLogTypes";
import {
  LEVEL_STYLES,
  formatTs,
  formatFullDateTime,
  getLocalDateKey,
  formatDateSeparator,
  formatRowCountsFragment,
  formatLogLineForCopy,
} from "./executionLogTypes";

const LevelIcon: React.FC<{ level: LogLevel }> = ({ level }) => {
  switch (level) {
    case "INFO":
      return <Info size={12} aria-hidden="true" className="shrink-0" />;
    case "SUCCESS":
      return <CheckCircle2 size={12} aria-hidden="true" className="shrink-0" />;
    case "WARN":
      return (
        <AlertTriangle size={12} aria-hidden="true" className="shrink-0" />
      );
    case "ERROR":
      return <XCircle size={12} aria-hidden="true" className="shrink-0" />;
    case "DEBUG":
      return <Sliders size={12} aria-hidden="true" className="shrink-0" />;
  }
};

interface LogConsoleProps {
  logs: LogEntry[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  isFollowing: boolean;
  onJumpToLatest: () => void;
  onOpenRunDetail?: (runId: string, triggerEl: HTMLElement | null) => void;
}

export const LogConsole: React.FC<LogConsoleProps> = ({
  logs,
  scrollRef,
  onScroll,
  isFollowing,
  onJumpToLatest,
  onOpenRunDetail,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyLine = async (log: LogEntry) => {
    const text = formatLogLineForCopy(log);
    try {
      await navigator.clipboard?.writeText(text);
      setCopiedId(log.id);
      setTimeout(() => {
        setCopiedId((curr) => (curr === log.id ? null : curr));
      }, 1500);
    } catch {
      // Clipboard may be unavailable in restricted contexts
    }
  };

  return (
    <div className="relative flex-1 flex flex-col min-h-0">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        role="log"
        aria-label="Pipeline execution log entries"
        style={{ minHeight: "240px", maxHeight: "420px" }}
        className="font-mono text-[11px] leading-relaxed overflow-y-auto bg-page flex flex-col"
      >
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 py-12 text-text-muted font-sans text-xs select-none">
            <p>No log entries to display</p>
          </div>
        ) : (
          <div className="p-3 flex flex-col gap-0.5">
            {logs.map((log, idx) => {
              const meta = LEVEL_STYLES[log.level];
              const dateKey = getLocalDateKey(log.ts);
              const prevDateKey =
                idx > 0 ? getLocalDateKey(logs[idx - 1].ts) : null;
              const showDateSep = dateKey !== prevDateKey;
              const rowCounts = formatRowCountsFragment(log);
              const fullDateTooltip = formatFullDateTime(log.ts);

              return (
                <React.Fragment key={log.id}>
                  {showDateSep && (
                    <div
                      className="flex items-center gap-2 py-1.5 my-1 select-none font-sans"
                      role="separator"
                      aria-label={formatDateSeparator(log.ts)}
                    >
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-[11px] font-medium text-text-muted px-2 py-0.5 rounded bg-surface-subtle border border-border-subtle">
                        {formatDateSeparator(log.ts)}
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  )}

                  <div className="group py-1.5 px-2 rounded hover:bg-surface-hover flex items-start gap-2 border border-transparent hover:border-border-subtle transition-colors motion-reduce:transition-none">
                    <span
                      className="text-text-muted shrink-0 select-none tabular-nums"
                      title={fullDateTooltip}
                    >
                      {formatTs(log.ts)}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1 shrink-0 font-semibold px-1.5 py-0.2 rounded border text-[10px] ${meta.badgeCls}`}
                    >
                      <LevelIcon level={log.level} />
                      <span>{meta.label}</span>
                    </span>

                    <span
                      className="shrink-0 text-primary font-semibold max-w-[140px] truncate"
                      title={log.source}
                    >
                      [{log.source}]
                    </span>

                    {log.runId && (
                      <button
                        type="button"
                        onClick={(e) =>
                          onOpenRunDetail?.(log.runId!, e.currentTarget)
                        }
                        title={`Open run ${log.runId}`}
                        className="shrink-0 text-primary hover:underline cursor-pointer bg-primary-tint/50 border border-primary-border/60 rounded px-1.5 py-0 text-[10px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
                      >
                        #{log.runId.slice(0, 8)}
                      </button>
                    )}

                    <span className="text-text flex-1 min-w-0 break-words">
                      {log.message}
                      {rowCounts && (
                        <span className="ml-2 text-text-secondary">
                          ({rowCounts})
                        </span>
                      )}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleCopyLine(log)}
                      aria-label={`Copy log line from ${log.source}`}
                      title="Copy line"
                      className="shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-sans font-medium bg-surface border border-border text-text-secondary hover:text-text cursor-pointer transition-opacity motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
                    >
                      {copiedId === log.id ? (
                        <>
                          <Check
                            size={11}
                            className="text-success"
                            aria-hidden="true"
                          />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={11} aria-hidden="true" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {!isFollowing && logs.length > 0 && (
        <div className="absolute bottom-3 right-4 z-10">
          <button
            type="button"
            onClick={onJumpToLatest}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary hover:bg-primary-hover text-primary-text text-xs font-medium shadow-md cursor-pointer transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <ArrowDown size={13} aria-hidden="true" />
            <span>Jump to latest</span>
          </button>
        </div>
      )}
    </div>
  );
};
