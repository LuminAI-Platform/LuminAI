import React from "react";
import { Clock } from "../../../lib/icons";
import type { SqlQueryResult } from "../../../features/datasets/types";

interface SqlResultsTableProps {
  queryResult: SqlQueryResult | null;
}

export const SqlResultsTable: React.FC<SqlResultsTableProps> = ({
  queryResult,
}) => {
  if (!queryResult) return null;

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden flex flex-col">
      <div className="p-3 bg-surface-subtle border-b border-border flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-text">Results</span>
          <span className="text-text-secondary">
            {queryResult.rowCount} rows of {queryResult.totalCount}
          </span>
        </div>
        <div className="flex items-center gap-2 text-text-secondary">
          <Clock className="w-3.5 h-3.5" />
          <span>{queryResult.executionTimeMs} ms</span>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[400px]">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-subtle/80 sticky top-0 border-b border-border text-text-secondary font-semibold">
            <tr>
              {queryResult.columns.map((col) => (
                <th key={col.name} className="py-2.5 px-4 font-mono">
                  {col.name}
                  <span className="block text-[10px] font-normal text-text-secondary">
                    {col.dataType || col.data_type || "VARCHAR"}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border font-mono">
            {queryResult.rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-surface-subtle/40">
                {queryResult.columns.map((col) => (
                  <td key={col.name} className="py-2 px-4 text-text">
                    {String(row[col.name] ?? "NULL")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
