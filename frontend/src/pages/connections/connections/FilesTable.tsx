import React from "react";
import {
  type IngestedFile,
  formatRelativeTime,
  getHealthStatusBadge,
} from "./connectionsTypes";
import { FileText, Search, Sparkles, Trash2 } from "lucide-react";

interface FilesTableProps {
  ingestedFiles: IngestedFile[];
  onUploadFile: () => void;
  onOpenRawPreview: (file: IngestedFile) => void;
  onInspectCleanData: (file: IngestedFile) => void;
  onDeleteFile: (file: IngestedFile) => void;
}

export const FilesTable: React.FC<FilesTableProps> = ({
  ingestedFiles,
  onUploadFile,
  onOpenRawPreview,
  onInspectCleanData,
  onDeleteFile,
}) => {
  if (ingestedFiles.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-400 mb-3">
          <FileText className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-semibold text-zinc-200">
          No ingested flat files
        </h4>
        <p className="text-xs text-zinc-400 mt-1 max-w-sm">
          Upload CSV, TSV, or JSON datasets using the ingestion wizard to map
          records directly to your ontology.
        </p>
        <button
          onClick={onUploadFile}
          className="mt-4 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
        >
          Upload Flat File
        </button>
      </div>
    );
  }

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-zinc-950/60 border-b border-zinc-800 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              <th className="py-3 px-4">Dataset Name</th>
              <th className="py-3 px-4">Size</th>
              <th className="py-3 px-4">Records Loaded</th>
              <th className="py-3 px-4">Ingestion Status</th>
              <th className="py-3 px-4">Created</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {ingestedFiles.map((f) => {
              const statusCfg = getHealthStatusBadge(f.status);
              return (
                <tr
                  key={f.id}
                  className="hover:bg-zinc-850/50 transition-colors group"
                >
                  <td className="py-3 px-4 font-semibold text-zinc-100 flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-300 shrink-0">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <span className="truncate max-w-[200px]" title={f.name}>
                      {f.name}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-zinc-400 font-mono text-[11px]">
                    {f.size}
                  </td>
                  <td className="py-3 px-4 text-zinc-300 font-mono text-[11px]">
                    {f.recordsCount.toLocaleString()}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusCfg.badgeStyle}`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotColor}`}
                      />
                      {f.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-zinc-400 text-[11px]">
                    {formatRelativeTime(f.createdAt)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => onOpenRawPreview(f)}
                        className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1"
                        title="Inspect raw uploaded data"
                      >
                        <Search className="w-3 h-3" /> Raw
                      </button>
                      <button
                        onClick={() => onInspectCleanData(f)}
                        className="px-2 py-1 rounded bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-blue-400 hover:text-blue-300 text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1"
                        title="View Clean & Golden semantic records"
                      >
                        <Sparkles className="w-3 h-3" /> Clean Data
                      </button>
                      <button
                        onClick={() => onDeleteFile(f)}
                        className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                        title="Delete file connection"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
