import React, { useMemo, useState } from "react";
import { BarChart3, Clock, Table } from "../../../lib/icons";
import { BarChartCard } from "../../../components/charts/BarChartCard";
import { PieDonutChartCard } from "../../../components/charts/PieDonutChartCard";
import {
  HistogramChartCard,
  type HistogramBin,
} from "../../../components/charts/HistogramChartCard";
import type { SqlQueryResult } from "../../../features/datasets/types";

interface SqlResultsTableProps {
  queryResult: SqlQueryResult | null;
}

function isNumericCol(
  rows: Record<string, unknown>[],
  colName: string,
): boolean {
  for (const row of rows.slice(0, 20)) {
    const val = row[colName];
    if (val !== null && val !== undefined && val !== "") {
      return typeof val === "number" && Number.isFinite(val);
    }
  }
  return false;
}

function buildNumericBins(values: number[], numBins = 8): HistogramBin[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return [
      {
        label: String(min),
        count: values.length,
        bin_start: min,
        bin_end: max,
      },
    ];
  }
  const binsCount = Math.max(2, Math.min(numBins, values.length));
  const step = (max - min) / binsCount;
  const counts = new Array<number>(binsCount).fill(0);
  for (const v of values) {
    const idx = Math.min(binsCount - 1, Math.floor((v - min) / step));
    counts[idx] += 1;
  }
  return counts.map((count, i) => {
    const start = min + i * step;
    const end = start + step;
    return {
      label: `${start.toFixed(1)}–${end.toFixed(1)}`,
      count,
      bin_start: start,
      bin_end: end,
    };
  });
}

export const SqlResultsTable: React.FC<SqlResultsTableProps> = ({
  queryResult,
}) => {
  const [viewMode, setViewMode] = useState<
    "table" | "bar" | "pie" | "histogram"
  >("table");

  const { labelCol, numericCols } = useMemo(() => {
    if (!queryResult || queryResult.rows.length === 0) {
      return { labelCol: null, numericCols: [] as string[] };
    }
    const numCols = queryResult.columns
      .map((c) => c.name)
      .filter((name) => isNumericCol(queryResult.rows, name));
    const catCol =
      queryResult.columns.find((c) => !numCols.includes(c.name))?.name ??
      queryResult.columns[0]?.name ??
      null;
    return { labelCol: catCol, numericCols: numCols };
  }, [queryResult]);

  const activeMetricCol = numericCols[0] ?? null;

  const chartData = useMemo(() => {
    if (!queryResult || !labelCol || !activeMetricCol) return [];
    return queryResult.rows.slice(0, 30).map((row) => ({
      name: String(row[labelCol] ?? "NULL"),
      value: Number(row[activeMetricCol] ?? 0),
    }));
  }, [queryResult, labelCol, activeMetricCol]);

  const histogramBins = useMemo(() => {
    if (!queryResult || !activeMetricCol) return [];
    const nums = queryResult.rows
      .map((r) => r[activeMetricCol])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    return buildNumericBins(nums);
  }, [queryResult, activeMetricCol]);

  if (!queryResult) return null;

  const canChart = numericCols.length > 0 && queryResult.rows.length > 0;

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden flex flex-col">
      <div className="p-3 bg-surface-subtle border-b border-border flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-text">Results</span>
          <span className="text-text-secondary">
            {queryResult.rowCount} rows of {queryResult.totalCount}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {canChart && (
            <div className="inline-flex rounded border border-border bg-surface overflow-hidden text-[11px]">
              {(
                [
                  { id: "table", label: "Table", Icon: Table },
                  { id: "bar", label: "Bar", Icon: BarChart3 },
                  { id: "pie", label: "Donut", Icon: BarChart3 },
                  { id: "histogram", label: "Histogram", Icon: BarChart3 },
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setViewMode(id)}
                  className={`px-2.5 py-1 cursor-pointer transition-colors ${
                    viewMode === id
                      ? "bg-primary text-primary-text font-semibold"
                      : "text-text-secondary hover:text-text"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 text-text-secondary">
            <Clock className="w-3.5 h-3.5" />
            <span>{queryResult.executionTimeMs} ms</span>
          </div>
        </div>
      </div>

      {viewMode !== "table" && canChart ? (
        <div className="p-4">
          {viewMode === "bar" && (
            <BarChartCard
              title={`${activeMetricCol} by ${labelCol}`}
              data={chartData}
              height={320}
            />
          )}
          {viewMode === "pie" && (
            <PieDonutChartCard
              title={`${activeMetricCol} Share (${labelCol})`}
              data={chartData}
              height={320}
            />
          )}
          {viewMode === "histogram" && (
            <HistogramChartCard
              title={`Distribution of ${activeMetricCol}`}
              bins={histogramBins}
              height={320}
            />
          )}
        </div>
      ) : (
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
      )}
    </div>
  );
};
