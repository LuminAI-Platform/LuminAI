import React, { useState, useMemo } from "react";
import {
  getTypeBadgeStyles,
  exportToCsv,
} from "./data-preview/dataPreviewHelpers";
import { DataPreviewToolbar } from "./data-preview/DataPreviewToolbar";
import { DataPreviewPagination } from "./data-preview/DataPreviewPagination";

export interface ColumnConfig {
  name: string;
  type: "String" | "Integer" | "Double" | "Boolean" | "Timestamp";
  active: boolean;
}

interface DataPreviewTableProps {
  columns: ColumnConfig[];
  rows: Record<string, unknown>[];
  onToggleColumn?: (name: string) => void;
}

export const DataPreviewTable: React.FC<DataPreviewTableProps> = ({
  columns,
  rows,
  onToggleColumn,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const lowerSearch = searchTerm.toLowerCase();
    return rows.filter((row) =>
      columns.some((col) => {
        if (!col.active) return false;
        const val = row[col.name];
        return val != null && String(val).toLowerCase().includes(lowerSearch);
      }),
    );
  }, [rows, columns, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / itemsPerPage));
  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredRows.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRows, currentPage]);

  React.useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  return (
    <div className="flex flex-col h-full bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden shadow-xl shadow-black/30">
      {/* Header toolbar */}
      <DataPreviewToolbar
        filteredCount={filteredRows.length}
        totalCount={rows.length}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        onExportCsv={() => exportToCsv(filteredRows, columns)}
      />

      {/* Table viewport */}
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto scrollbar-thin">
        {filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center select-none">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-zinc-600 mb-3"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              <circle cx="9" cy="9" r="2" />
            </svg>
            <span className="text-sm font-semibold text-zinc-400">
              No matching records found
            </span>
            <span className="text-xs text-zinc-500 mt-1">
              Try refining your search query or enabling columns
            </span>
          </div>
        ) : (
          <table className="w-full min-w-[600px] text-left border-collapse table-auto text-xs font-mono">
            <thead className="sticky top-0 z-20 bg-zinc-900 border-b border-zinc-800 shadow-xs">
              <tr className="text-zinc-400 select-none">
                <th className="py-2.5 px-3 font-semibold text-zinc-400 w-12 text-center sticky left-0 z-30 bg-zinc-900 border-r border-zinc-800/80 shadow-xs">
                  #
                </th>
                {columns.map((col) => (
                  <th
                    key={col.name}
                    className={`py-2.5 px-4 font-semibold whitespace-nowrap min-w-[130px] border-r border-zinc-800/60 transition-all ${col.active ? "text-zinc-200" : "text-zinc-600 bg-zinc-950/40 opacity-50"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={!col.active ? "line-through" : ""}>
                        {col.name}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${getTypeBadgeStyles(col.type)}`}
                      >
                        {col.type}
                      </span>
                      {onToggleColumn && (
                        <button
                          type="button"
                          onClick={() => onToggleColumn(col.name)}
                          title={
                            col.active ? "Disable column" : "Enable column"
                          }
                          className="ml-auto p-1 text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer"
                        >
                          {col.active ? (
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                            >
                              <circle cx="12" cy="12" r="10" />
                              <line x1="8" y1="12" x2="16" y2="12" />
                            </svg>
                          ) : (
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                            >
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="8" x2="12" y2="16" />
                              <line x1="8" y1="12" x2="16" y2="12" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {paginatedRows.map((row, index) => {
                const globalIndex =
                  (currentPage - 1) * itemsPerPage + index + 1;
                return (
                  <tr
                    key={index}
                    className="even:bg-zinc-900/20 hover:bg-zinc-850/40 transition-colors group"
                  >
                    <td className="py-2 px-3 text-center font-mono text-zinc-500 bg-zinc-950 sticky left-0 z-10 border-r border-zinc-800/80 shadow-xs select-none">
                      {globalIndex}
                    </td>
                    {columns.map((col) => {
                      const value = row[col.name];
                      const formattedValue =
                        value === null
                          ? "NULL"
                          : typeof value === "boolean"
                            ? String(value)
                            : typeof value === "object"
                              ? JSON.stringify(value)
                              : String(value);
                      return (
                        <td
                          key={col.name}
                          className={`py-2 px-4 font-mono text-zinc-300 whitespace-nowrap max-w-[280px] truncate border-r border-zinc-900/60 ${col.active ? "" : "text-zinc-600 bg-zinc-950/20 opacity-40 line-through"}`}
                          title={value !== null ? formattedValue : "null"}
                        >
                          {value === null ? (
                            <span className="text-[10px] text-zinc-500 font-semibold italic bg-zinc-900 px-1 py-0.5 rounded">
                              null
                            </span>
                          ) : (
                            formattedValue
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination footer */}
      <DataPreviewPagination
        currentPage={currentPage}
        totalPages={totalPages}
        itemsPerPage={itemsPerPage}
        totalFilteredRows={filteredRows.length}
        onPreviousPage={() => setCurrentPage((p) => Math.max(1, p - 1))}
        onNextPage={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
      />
    </div>
  );
};
