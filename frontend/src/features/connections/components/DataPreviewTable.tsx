import React, { useState, useMemo } from "react";

export interface ColumnConfig {
  name: string;
  type: "String" | "Integer" | "Double" | "Boolean" | "Timestamp";
  active: boolean;
}

interface DataPreviewTableProps {
  columns: ColumnConfig[];
  rows: Record<string, any>[];
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

  // Filter rows by search term
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

  // Paginated rows
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / itemsPerPage));
  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredRows.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRows, currentPage]);

  // Adjust page number if out of range after filter
  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const getTypeBadgeStyles = (type: ColumnConfig["type"]) => {
    switch (type) {
      case "Integer":
        return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      case "Double":
        return "bg-rose-500/10 text-rose-400 border border-rose-500/20";
      case "Boolean":
        return "bg-purple-500/10 text-purple-400 border border-purple-500/20";
      case "Timestamp":
        return "bg-teal-500/10 text-teal-400 border border-teal-500/20";
      default:
        return "bg-blue-500/10 text-blue-400 border border-blue-500/20";
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 border border-zinc-800/80 rounded-xl overflow-hidden shadow-xl shadow-black/30">
      {/* Header toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-b border-zinc-800/80 bg-zinc-900/40">
        <div className="flex items-center gap-2.5 select-none">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold tracking-wider uppercase text-zinc-400">
            Preview Dataset
          </span>
          <span className="text-xs text-zinc-500">
            ({filteredRows.length} of {rows.length} rows)
          </span>
        </div>

        {/* Search */}
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
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-zinc-900 border border-zinc-800/85 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500/80 transition-colors"
          />
        </div>
      </div>

      {/* Main Table viewport */}
      <div className="flex-1 overflow-x-auto min-h-[300px]">
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
          <table className="w-full text-left border-collapse table-auto text-xs">
            <thead>
              <tr className="border-b border-zinc-800/80 bg-zinc-900/30 text-zinc-400 select-none">
                <th className="py-3 px-4 font-semibold text-zinc-500 w-12 text-center">
                  #
                </th>
                {columns.map((col) => (
                  <th
                    key={col.name}
                    className={`py-3 px-4 font-semibold transition-all ${
                      col.active
                        ? "text-zinc-200"
                        : "text-zinc-600 bg-zinc-950/40 opacity-50"
                    }`}
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
                    className="hover:bg-zinc-900/30 transition-colors group"
                  >
                    <td className="py-2.5 px-4 text-center font-mono text-zinc-600 bg-zinc-900/10 select-none">
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
                          className={`py-2.5 px-4 font-mono text-zinc-300 max-w-[240px] truncate ${
                            col.active
                              ? ""
                              : "text-zinc-600 bg-zinc-950/20 opacity-40 line-through"
                          }`}
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

      {/* Pagination Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800/80 bg-zinc-900/40 select-none">
        <div className="text-zinc-500 text-xs">
          Showing{" "}
          <span className="font-semibold text-zinc-400">
            {Math.min(
              filteredRows.length,
              (currentPage - 1) * itemsPerPage + 1,
            )}
          </span>{" "}
          to{" "}
          <span className="font-semibold text-zinc-400">
            {Math.min(filteredRows.length, currentPage * itemsPerPage)}
          </span>{" "}
          of{" "}
          <span className="font-semibold text-zinc-400">
            {filteredRows.length}
          </span>{" "}
          entries
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="text-zinc-400 text-xs px-3 font-semibold font-mono">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
