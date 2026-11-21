import React from "react";
import type { IngestionLog } from "./fileUploadTypes";

interface IngestionConsolePanelProps {
  ingesting: boolean;
  ingestionProgress: number;
  ingestionLogs: IngestionLog[];
}

export const IngestionConsolePanel: React.FC<IngestionConsolePanelProps> = ({
  ingesting,
  ingestionProgress,
  ingestionLogs,
}) => {
  return (
    <div className="md:col-span-3 flex flex-col border border-zinc-850 rounded-lg overflow-hidden bg-zinc-950 h-full">
      {/* Console Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-850 bg-zinc-900/60 select-none">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-zinc-400" />
          <span className="text-[10px] font-semibold tracking-wider uppercase text-zinc-300">
            Sync Progress Console
          </span>
        </div>
        {ingesting && (
          <span className="text-[10px] text-zinc-300">
            {ingestionProgress}%
          </span>
        )}
      </div>

      {/* Progress bar */}
      {ingesting && (
        <div className="w-full h-1.5 bg-surface-muted relative">
          <div
            className="absolute top-0 left-0 bottom-0 bg-primary transition-all duration-300"
            style={{ width: `${ingestionProgress}%` }}
          />
        </div>
      )}

      {/* Ingestion Console Screen */}
      <div className="flex-1 bg-surface-subtle p-4 font-mono text-[10px] overflow-y-auto flex flex-col gap-2 min-h-[220px]">
        {ingestionLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-text-secondary italic select-none">
            Console waiting to initialize... click "Initialize Ingestion Sync"
          </div>
        ) : (
          ingestionLogs.map((log, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-text-secondary select-none">
                [{log.timestamp}]
              </span>
              <span
                className={`font-bold select-none ${
                  log.level === "SUCCESS"
                    ? "text-success"
                    : log.level === "WARN"
                      ? "text-warning"
                      : log.level === "ERROR"
                        ? "text-error"
                        : "text-primary"
                }`}
              >
                {log.level}
              </span>
              <span className="text-text whitespace-pre-wrap">
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
