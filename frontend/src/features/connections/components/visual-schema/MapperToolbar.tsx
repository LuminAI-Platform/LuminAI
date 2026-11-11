import React from "react";

interface MapperToolbarProps {
  sourceTable: string;
  targetEntity: string;
  mappingsCount: number;
  fkCount: number;
  unmappedCount: number;
  showPayload: boolean;
  saveSuccess: boolean;
  saveError: string | null;
  onTogglePayload: () => void;
  onSave: () => void;
}

export const MapperToolbar: React.FC<MapperToolbarProps> = ({
  sourceTable,
  targetEntity,
  mappingsCount,
  fkCount,
  unmappedCount,
  showPayload,
  saveSuccess,
  saveError,
  onTogglePayload,
  onSave,
}) => {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-500 font-mono">{sourceTable}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-zinc-700"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
        <span className="text-xs text-blue-400 font-mono">{targetEntity}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="px-2.5 py-1 text-[10px] font-semibold rounded-full border bg-blue-500/10 border-blue-500/20 text-blue-400">
          {mappingsCount} mapped
        </span>
        {fkCount > 0 && (
          <span
            id="schema-mapper-fk-badge"
            className="px-2.5 py-1 text-[10px] font-semibold rounded-full border bg-purple-500/10 border-purple-500/30 text-purple-400 flex items-center gap-1"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            {fkCount} graph {fkCount === 1 ? "link" : "links"}
          </span>
        )}
        {unmappedCount > 0 && (
          <span className="px-2.5 py-1 text-[10px] font-semibold rounded-full border bg-zinc-900 border-zinc-800 text-zinc-500">
            {unmappedCount} unmapped
          </span>
        )}
        <button
          id="schema-mapper-view-payload"
          onClick={onTogglePayload}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-700 text-zinc-300 hover:text-zinc-100 hover:border-zinc-600 transition-all cursor-pointer"
        >
          {showPayload ? "Hide" : "View"} Payload
        </button>
        {saveError && (
          <span className="text-[11px] text-rose-400 font-medium px-2 py-1 bg-rose-500/10 border border-rose-500/20 rounded-lg">
            {saveError}
          </span>
        )}
        <button
          id="schema-mapper-save"
          onClick={onSave}
          disabled={mappingsCount === 0 && fkCount === 0}
          className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
            saveSuccess
              ? "bg-emerald-600 border border-emerald-500/40 text-white shadow-lg shadow-emerald-500/20"
              : mappingsCount === 0 && fkCount === 0
                ? "bg-zinc-800/50 border border-zinc-800 text-zinc-600 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-500 border border-blue-500/40 text-white shadow-lg shadow-blue-500/15 hover:shadow-blue-500/25"
          }`}
        >
          {saveSuccess ? (
            <>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Saved
            </>
          ) : (
            <>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              Save Mapping
            </>
          )}
        </button>
      </div>
    </div>
  );
};
