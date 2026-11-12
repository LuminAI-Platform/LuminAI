import React from "react";
import type { DBType } from "./dbConnectorTypes";

interface ConnectedSummaryProps {
  name: string;
  dbType: DBType;
  host: string;
  databaseName: string;
  selectedTables: string[];
  isSaving: boolean;
  onEdit: () => void;
  onRegister: () => void;
}

export const ConnectedSummary: React.FC<ConnectedSummaryProps> = ({
  name,
  dbType,
  host,
  databaseName,
  selectedTables,
  isSaving,
  onEdit,
  onRegister,
}) => {
  return (
    <div className="flex flex-col h-full bg-zinc-950/40 border border-zinc-850/60 p-5 rounded-lg justify-between gap-6 select-none">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <span className="text-xs font-semibold text-emerald-400 block">
              Database Connected
            </span>
            <span className="text-[10px] text-zinc-500 mt-0.5 block">
              Catalog tables retrieved successfully
            </span>
          </div>
        </div>

        <div className="border-t border-zinc-900 pt-4 flex flex-col gap-2">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
            Connection Summary
          </span>
          <div className="grid grid-cols-2 gap-y-2 gap-x-4 font-mono text-[10px] text-zinc-400 bg-black/20 p-3 rounded-lg border border-zinc-900">
            <div>
              Name: <span className="text-zinc-200">{name}</span>
            </div>
            <div>
              Type: <span className="text-zinc-200 uppercase">{dbType}</span>
            </div>
            <div>
              Host: <span className="text-zinc-200">{host}</span>
            </div>
            <div>
              Database: <span className="text-zinc-200">{databaseName}</span>
            </div>
            <div>
              Selected:{" "}
              <span className="text-blue-500 font-semibold">
                {selectedTables.length} tables
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onEdit}
          className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800 py-2.5 px-4 rounded-lg text-xs font-semibold transition-all cursor-pointer"
        >
          Edit Credentials
        </button>
        <button
          onClick={onRegister}
          disabled={isSaving || selectedTables.length === 0}
          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
        >
          {isSaving ? "Saving..." : "Register Connector"}
        </button>
      </div>
    </div>
  );
};
