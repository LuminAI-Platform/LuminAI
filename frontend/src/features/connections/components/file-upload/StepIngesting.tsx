import React from "react";
import type { ColumnConfig } from "../DataPreviewTable";
import type { ColumnMappingConfig, IngestionLog } from "./fileUploadTypes";
import { IngestionConsolePanel } from "./IngestionConsolePanel";

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
  const activeCols = columnsConfig.filter((c) => c.active);
  const mappedTypes = Array.from(
    new Set(
      activeCols.map((c) => mappings[c.name]?.targetEntityType).filter(Boolean),
    ),
  );
  const singleType =
    mappedTypes.length === 1
      ? mappedTypes[0]
      : mappedTypes.length === 0
        ? "Person"
        : null;

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
            <div className="flex justify-between py-1 border-b border-border">
              <span className="text-text-secondary">Active Mappings:</span>
              <span className="font-semibold text-primary">
                {activeCols.length} fields
              </span>
            </div>
          </div>

          {/* Warning when all active columns map to a single entity type */}
          {singleType && (
            <div
              data-testid="single-type-warning"
              className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs flex items-start gap-2.5 text-amber-200"
            >
              <span className="text-amber-400 font-bold text-sm shrink-0 mt-0.5">
                ⚠️
              </span>
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-amber-300">
                  Single Entity Type Mapping Notice
                </span>
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  All records were mapped to <strong>{singleType}</strong>.
                  Columns such as physician, insurer and diagnosis were stored
                  as properties, not entities.
                </p>
              </div>
            </div>
          )}

          {!ingesting && !ingestionFinished && !ingestionFailed && (
            <button
              type="button"
              onClick={startIngestion}
              className="w-full mt-4 py-2.5 bg-primary hover:bg-primary-hover text-primary-text border border-primary rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
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
            <div className="mt-4 p-3 bg-error-bg border border-error-border rounded-lg text-center select-none">
              <span className="text-xs font-semibold text-error block mb-1">
                Ingestion Failed
              </span>
              <span className="text-[10px] text-text-secondary block mb-2">
                {errorMessage ||
                  "An unexpected error occurred during ingestion."}
              </span>
              <button
                type="button"
                onClick={startIngestion}
                className="px-3 py-1.5 bg-transparent border border-error-border text-error hover:bg-error-bg rounded text-xs font-semibold transition-colors cursor-pointer"
              >
                Retry Ingestion
              </button>
            </div>
          )}

          {ingestionFinished && (
            <div className="mt-4 p-3 bg-success-bg border border-success-border rounded-lg text-center select-none">
              <span className="text-xs font-semibold text-success block mb-1">
                Ingestion Complete
              </span>
              <span className="text-[10px] text-text-secondary">
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
            {activeCols.slice(0, 5).map((c) => {
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
            {activeCols.length > 5 && (
              <div className="text-[10px] text-center text-zinc-500 italic mt-1">
                + {activeCols.length - 5} more columns
              </div>
            )}
          </div>
        </div>
      </div>

      <IngestionConsolePanel
        ingesting={ingesting}
        ingestionProgress={ingestionProgress}
        ingestionLogs={ingestionLogs}
      />
    </div>
  );
};
