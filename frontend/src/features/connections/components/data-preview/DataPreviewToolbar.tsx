import React from "react";

interface DataPreviewToolbarProps {
  filteredCount: number;
  totalCount: number;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onExportCsv: () => void;
}

export const DataPreviewToolbar: React.FC<DataPreviewToolbarProps> = ({
  filteredCount,
  totalCount,
  searchTerm,
  onSearchTermChange,
  onExportCsv,
}) => (
  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-b border-zinc-800/80 bg-zinc-900/40">
    <div className="flex items-center gap-2.5 select-none">
      <span className="text-xs font-semibold tracking-wider uppercase text-zinc-400">
        Preview Dataset
      </span>
      <span className="text-xs text-zinc-500">
        ({filteredCount} of {totalCount} rows)
      </span>
    </div>
    <div className="flex items-center gap-3 w-full sm:w-auto">
      <div className="relative w-full sm:w-72">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500 pointer-events-none">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>
        <input
          type="text"
          placeholder="Search active columns..."
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          className="w-full pl-9 pr-4 py-1.5 bg-zinc-900 border border-zinc-800/85 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500/80 transition-colors"
        />
      </div>
      <button
        id="export-preview-csv-btn"
        type="button"
        onClick={onExportCsv}
        disabled={filteredCount === 0}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-700 rounded-lg text-xs font-medium transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
        title="Export filtered preview to CSV"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-zinc-400"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span>Export CSV</span>
      </button>
    </div>
  </div>
);
