import React from "react";
import type { Dataset } from "../../../features/datasets/types";

interface DatasetProfilerTabProps {
  dataset: Dataset;
  schemaEntries: [string, string][];
}

const DIMENSION_KEYS = [
  { key: "completeness", label: "Completeness", color: "text-emerald-400" },
  { key: "validity", label: "Validity", color: "text-emerald-400" },
  { key: "uniqueness", label: "Uniqueness", color: "text-blue-400" },
  { key: "consistency", label: "Consistency", color: "text-purple-400" },
  { key: "timeliness", label: "Timeliness", color: "text-emerald-400" },
] as const;

function readNumericMetric(
  source: Record<string, unknown> | undefined,
  key: string,
): number | null {
  if (!source) return null;
  const direct = source[key];
  if (typeof direct === "number" && Number.isFinite(direct)) return direct;
  const nested =
    (source.dimensions as Record<string, unknown> | undefined)?.[key] ??
    (source.dama as Record<string, unknown> | undefined)?.[key];
  return typeof nested === "number" && Number.isFinite(nested) ? nested : null;
}

export const DatasetProfilerTab: React.FC<DatasetProfilerTabProps> = ({
  dataset,
  schemaEntries,
}) => {
  const summary = dataset.profilingSummary;
  const columnProfiles = (summary?.columns ??
    summary?.column_profiles ??
    {}) as Record<string, Record<string, unknown>>;

  return (
    <div className="flex flex-col gap-4">
      <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-text">
          DAMA Data Quality Dimensions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {DIMENSION_KEYS.map((dim) => {
            const rawVal = readNumericMetric(summary, dim.key);
            const pct =
              rawVal === null ? null : rawVal <= 1 ? rawVal * 100 : rawVal;
            return (
              <div
                key={dim.label}
                className="p-3 rounded-lg bg-surface-subtle border border-border"
              >
                <span className="text-[11px] text-text-secondary block">
                  {dim.label}
                </span>
                <span
                  className={`text-base font-bold ${pct !== null ? dim.color : "text-text-secondary"}`}
                >
                  {pct !== null ? `${pct.toFixed(1)}%` : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-text">
            Inferred Column Profile Statistics
          </h3>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-subtle text-text-secondary font-semibold border-b border-border">
            <tr>
              <th className="py-2.5 px-4">Column Name</th>
              <th className="py-2.5 px-4">Inferred Type</th>
              <th className="py-2.5 px-4">Null %</th>
              <th className="py-2.5 px-4">Distinct Values</th>
              <th className="py-2.5 px-4">Quality Health</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {schemaEntries.map(([col, type]) => {
              const colStats = columnProfiles[col];
              const nullPct =
                typeof colStats?.nullPercentage === "number"
                  ? colStats.nullPercentage
                  : typeof colStats?.null_pct === "number"
                    ? colStats.null_pct
                    : null;
              const distinctCount =
                typeof colStats?.distinctCount === "number"
                  ? colStats.distinctCount
                  : typeof colStats?.distinct_count === "number"
                    ? colStats.distinct_count
                    : null;
              const health =
                typeof colStats?.health === "string" ? colStats.health : null;
              return (
                <tr key={col} className="hover:bg-surface-subtle/40">
                  <td className="py-2.5 px-4 font-mono font-medium text-text">
                    {col}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-purple-400">
                    {type}
                  </td>
                  <td className="py-2.5 px-4 text-text">
                    {nullPct !== null ? `${nullPct.toFixed(1)}%` : "—"}
                  </td>
                  <td className="py-2.5 px-4 text-text-secondary">
                    {distinctCount !== null
                      ? distinctCount.toLocaleString()
                      : "—"}
                  </td>
                  <td className="py-2.5 px-4">
                    {health ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {health}
                      </span>
                    ) : (
                      <span className="text-text-secondary">—</span>
                    )}
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
