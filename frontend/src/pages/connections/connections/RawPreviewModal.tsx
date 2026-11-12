import React from "react";
import type { IngestedFile } from "./connectionsTypes";
import { FileText, X } from "lucide-react";

interface RawPreviewModalProps {
  previewingFile: IngestedFile;
  isRawPreviewLoading: boolean;
  onClose: () => void;
}

export const RawPreviewModal: React.FC<RawPreviewModalProps> = ({
  previewingFile,
  isRawPreviewLoading,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-full max-w-4xl h-[70vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="px-5 py-3.5 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <FileText className="w-4 h-4 text-zinc-400" />
            <h3 className="text-xs font-semibold text-zinc-100">
              Raw File Inspection: {previewingFile.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4 min-h-0 bg-zinc-950">
          {isRawPreviewLoading ? (
            <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
              Loading raw rows...
            </div>
          ) : !previewingFile.sampleRows ||
            previewingFile.sampleRows.length === 0 ? (
            <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
              No preview rows stored for this flat file.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-zinc-900 border-b border-zinc-800">
                <tr>
                  {(
                    previewingFile.columns ||
                    Object.keys(previewingFile.sampleRows[0])
                  ).map((col) => (
                    <th
                      key={col}
                      className="py-2 px-3 font-semibold text-zinc-300 font-mono text-[11px]"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {previewingFile.sampleRows.slice(0, 100).map((row, i) => (
                  <tr key={i} className="hover:bg-zinc-900/50">
                    {(
                      previewingFile.columns ||
                      Object.keys(previewingFile.sampleRows![0])
                    ).map((col) => (
                      <td
                        key={col}
                        className="py-1.5 px-3 font-mono text-[11px] text-zinc-300 whitespace-nowrap"
                      >
                        {String(row[col] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
