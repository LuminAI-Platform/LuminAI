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
  const [selectedTable, setSelectedTable] = React.useState<string>("ALL");

  const availableTables = React.useMemo(() => {
    const set = new Set<string>();
    (previewingFile.sampleRows || []).forEach((r) => {
      if (r._table) set.add(String(r._table));
    });
    return Array.from(set);
  }, [previewingFile.sampleRows]);

  const displayedRows = (previewingFile.sampleRows || []).filter((r) => {
    if (selectedTable !== "ALL" && r._table !== selectedTable) {
      return false;
    }
    return true;
  });

  const columns =
    displayedRows.length > 0
      ? Object.keys(displayedRows[0])
      : previewingFile.columns || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-surface border border-border rounded-lg w-full max-w-4xl h-[70vh] flex flex-col overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-border bg-surface-subtle flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <FileText className="w-4 h-4 text-text-secondary" />
            <h3 className="text-xs font-semibold text-text">
              Raw File Inspection: {previewingFile.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-text-secondary hover:text-text cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {availableTables.length > 0 && (
          <div className="px-5 py-2 bg-surface-subtle border-b border-border flex items-center gap-2 overflow-x-auto shrink-0">
            <span className="text-[10px] uppercase font-bold text-text-secondary tracking-wider mr-1">
              Tables:
            </span>
            <button
              onClick={() => setSelectedTable("ALL")}
              className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors ${
                selectedTable === "ALL"
                  ? "bg-primary text-primary-text font-semibold shadow-xs"
                  : "bg-surface border border-border text-text-secondary hover:text-text"
              }`}
            >
              All Tables ({(previewingFile.sampleRows || []).length})
            </button>
            {availableTables.map((tbl) => {
              const count = (previewingFile.sampleRows || []).filter(
                (r) => r._table === tbl,
              ).length;
              return (
                <button
                  key={tbl}
                  onClick={() => setSelectedTable(tbl)}
                  className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors ${
                    selectedTable === tbl
                      ? "bg-primary text-primary-text font-semibold shadow-xs"
                      : "bg-surface border border-border text-text-secondary hover:text-text"
                  }`}
                >
                  {tbl} ({count})
                </button>
              );
            })}
          </div>
        )}

        <div className="flex-1 overflow-auto p-4 min-h-0 bg-surface">
          {isRawPreviewLoading ? (
            <div className="h-full flex items-center justify-center text-text-secondary text-xs">
              Loading raw rows...
            </div>
          ) : displayedRows.length === 0 ? (
            <div className="h-full flex items-center justify-center text-text-secondary text-xs">
              No preview rows stored for this flat file.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-surface-subtle border-b border-border">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="py-2 px-3 font-semibold text-text-secondary font-mono text-[11px]"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayedRows.slice(0, 100).map((row, i) => (
                  <tr key={i} className="hover:bg-surface-hover">
                    {columns.map((col) => (
                      <td
                        key={col}
                        className="py-1.5 px-3 font-mono text-[11px] text-text whitespace-nowrap"
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
