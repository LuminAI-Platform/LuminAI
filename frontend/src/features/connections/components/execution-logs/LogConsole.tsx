import React from "react";
import type { LogEntry } from "./executionLogTypes";
import { LEVEL_STYLES, formatTs } from "./executionLogTypes";

const SOURCE_CLS = "text-violet-400/80 font-semibold";

interface LogConsoleProps {
  logs: LogEntry[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
}

export const LogConsole: React.FC<LogConsoleProps> = ({
  logs,
  scrollRef,
  onScroll,
}) => {
  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      style={{ minHeight: "220px", maxHeight: "380px" }}
      className="font-mono text-[10px] leading-relaxed overflow-y-auto bg-black/70 flex flex-col"
    >
      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-12 text-zinc-600 select-none">
          <p>No log records in buffer</p>
        </div>
      ) : (
        <div className="p-3 divide-y divide-zinc-900/60 flex flex-col">
          {logs.map((log) => {
            const meta = LEVEL_STYLES[log.level];
            return (
              <div
                key={log.id}
                className="py-1 flex items-start gap-2 hover:bg-zinc-900/40 px-1.5 rounded"
              >
                <span className="text-zinc-600 shrink-0 select-none">
                  {formatTs(log.ts)}
                </span>
                <span className={`shrink-0 font-bold ${meta.cls}`}>
                  {meta.label}
                </span>
                <span className={`shrink-0 ${SOURCE_CLS}`}>[{log.source}]</span>
                <span className="text-zinc-300 break-all">{log.message}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
