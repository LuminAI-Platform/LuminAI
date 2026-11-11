import React from "react";
import type { ColumnConfig } from "../DataPreviewTable";
import type { ColumnMappingConfig, IngestionLog } from "./fileUploadTypes";

interface StepIngestingProps {
  file: File | null;
  parsedRowsCount: number;
  columnsConfig: ColumnConfig[];
  mappings: Record<string, ColumnMappingConfig>;
  ingesting: boolean;
  ingestionProgress: number;
  ingestionLogs: IngestionLog[];
  ingestedCount: number;
  ingestionFinished: boolean;
  ingestionFailed: boolean;
  errorMessage: string | null;
  startIngestion: () => void;
}

export const StepIngesting: React.FC<StepIngestingProps> = ({
  file,
  parsedRowsCount,
  columnsConfig,
  mappings,
  ingesting,
  ingestionProgress,
  ingestionLogs,
  ingestedCount,
  ingestionFinished,
  ingestionFailed,
  errorMessage,
  startIngestion,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 h-full min-h-0 overflow-y-auto">
      {/* Left pane: file summary */}
      <div className="md:col-span-2 flex flex-col gap-4">
        <div className="bg-zinc-950/40 border border-zinc-800 p-5 rounded-lg flex flex-col gap-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 select-none">
            Ingestion Summary
          </h3>

          <div className="flex flex-col gap-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-zinc-900">
              <span className="text-zinc-500">File Name:</span>
              <span
                className="font-semibold text-zinc-200 truncate max-w-[160px]"
                title={file?.name}
              >
                {file?.name}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-900">
              <span className="text-zinc-500">File Size:</span>
              <span className="text-zinc-300">
                {Math.round((file?.size || 0) / 1024)} KB
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-900">
              <span className="text-zinc-500">Records Count:</span>
              <span className="text-zinc-300">{parsedRowsCount} rows</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-900">
              <span className="text-zinc-500">Active Mappings:</span>
              <span className="font-semibold text-blue-500">
                {columnsConfig.filter((c) => c.active).length} fields
              </span>
            </div>
          </div>

          {!ingesting && !ingestionFinished && !ingestionFailed && (
            <button
              onClick={startIngestion}
              className="w-full mt-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="22 2 11 13 2 9 22 2 22 2" />
                <polygon points="22 2 15 22 11 13 22 2" />
              </svg>
              Initialize Ingestion Sync
            </button>
          )}

          {ingestionFailed && (
            <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-center select-none">
              <span className="text-xs font-semibold text-rose-400 block mb-1">
                Ingestion Failed
              </span>
              <span className="text-[10px] text-zinc-400 block mb-2">
                {errorMessage ||
                  "An unexpected error occurred during ingestion."}
              </span>
              <button
                onClick={startIngestion}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold transition-colors cursor-pointer"
              >
                Retry Ingestion
              </button>
            </div>
          )}

          {ingestionFinished && (
            <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-center select-none">
              <span className="text-xs font-semibold text-emerald-400 block mb-1">
                Ingestion Complete
              </span>
              <span className="text-[10px] text-zinc-400">
                {ingestedCount} records successfully loaded into staging and
                semantic graph ontology!
              </span>
            </div>
          )}
        </div>

        {/* mini mapping preview list */}
        <div className="bg-zinc-950/40 border border-zinc-800/80 p-4 rounded-lg flex-1 max-h-[180px] overflow-y-auto">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2.5 select-none">
            Ontology Actions
          </h4>
          <div className="flex flex-col gap-2">
            {columnsConfig
              .filter((c) => c.active)
              .slice(0, 5)
              .map((c) => {
                const m = mappings[c.name];
                return (
                  <div
                    key={c.name}
                    className="flex justify-between items-center text-[10px]"
                  >
                    <span className="font-mono text-zinc-400 truncate max-w-[90px]">
                      {c.name}
                    </span>
                    <span className="text-zinc-600">➔</span>
                    <span className="font-semibold text-zinc-300">
                      {m?.targetEntityType}.{m?.targetProperty}
                    </span>
                  </div>
                );
              })}
            {columnsConfig.filter((c) => c.active).length > 5 && (
              <div className="text-[10px] text-center text-zinc-500 italic mt-1">
                + {columnsConfig.filter((c) => c.active).length - 5} more
                columns
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right pane: console logs and progress */}
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
          <div className="w-full h-1.5 bg-zinc-900 relative">
            <div
              className="absolute top-0 left-0 bottom-0 bg-blue-500 transition-all duration-300"
              style={{ width: `${ingestionProgress}%` }}
            />
          </div>
        )}

        {/* Ingestion Console Screen */}
        <div className="flex-1 bg-black p-4 font-mono text-[10px] overflow-y-auto flex flex-col gap-2 min-h-[220px]">
          {ingestionLogs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-zinc-600 italic select-none">
              Console waiting to initialize... click "Initialize Ingestion Sync"
            </div>
          ) : (
            ingestionLogs.map((log, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-zinc-600 select-none">
                  [{log.timestamp}]
                </span>
                <span
                  className={`font-bold select-none ${
                    log.level === "SUCCESS"
                      ? "text-emerald-500"
                      : log.level === "WARN"
                        ? "text-amber-500"
                        : log.level === "ERROR"
                          ? "text-rose-500"
                          : "text-blue-500"
                  }`}
                >
                  {log.level}
                </span>
                <span className="text-zinc-300 whitespace-pre-wrap">
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
