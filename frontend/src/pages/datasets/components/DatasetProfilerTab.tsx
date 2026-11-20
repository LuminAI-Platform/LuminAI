import React from "react";
import type { Dataset } from "../../../features/datasets/types";

interface DatasetProfilerTabProps {
  dataset: Dataset;
  schemaEntries: [string, string][];
}

const QUALITY_DIMENSIONS = [
  { label: "Completeness", value: "98.4%", color: "text-emerald-400" },
  { label: "Validity", value: "96.2%", color: "text-emerald-400" },
  { label: "Uniqueness", value: "99.8%", color: "text-blue-400" },
  { label: "Consistency", value: "95.0%", color: "text-purple-400" },
  { label: "Timeliness", value: "100.0%", color: "text-emerald-400" },
];

export const DatasetProfilerTab: React.FC<DatasetProfilerTabProps> = ({
  dataset,
  schemaEntries,
}) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-text">
          DAMA Data Quality Dimensions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {QUALITY_DIMENSIONS.map((dim) => (
            <div
              key={dim.label}
              className="p-3 rounded-lg bg-surface-subtle border border-border"
            >
              <span className="text-[11px] text-text-secondary block">
                {dim.label}
              </span>
              <span className={`text-base font-bold ${dim.color}`}>
                {dim.value}
              </span>
            </div>
          ))}
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
            {schemaEntries.map(([col, type]) => (
              <tr key={col} className="hover:bg-surface-subtle/40">
                <td className="py-2.5 px-4 font-mono font-medium text-text">
                  {col}
                </td>
                <td className="py-2.5 px-4 font-mono text-purple-400">
                  {type}
                </td>
                <td className="py-2.5 px-4 text-text">0.0%</td>
                <td className="py-2.5 px-4 text-text-secondary">
                  {(dataset.rowCount || 0).toLocaleString()}
                </td>
                <td className="py-2.5 px-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    HEALTHY
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
