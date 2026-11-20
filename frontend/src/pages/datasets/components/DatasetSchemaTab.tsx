import React from "react";
import type { Dataset } from "../../../features/datasets/types";

interface DatasetSchemaTabProps {
  dataset: Dataset;
  schemaEntries: [string, string][];
}

export const DatasetSchemaTab: React.FC<DatasetSchemaTabProps> = ({
  dataset,
  schemaEntries,
}) => {
  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">
          Dataset Schema Definition
        </h3>
        <span className="text-xs text-text-secondary">
          {schemaEntries.length} registered attributes
        </span>
      </div>
      <table className="w-full text-left text-xs">
        <thead className="bg-surface-subtle text-text-secondary font-semibold border-b border-border">
          <tr>
            <th className="py-2.5 px-4">Field Name</th>
            <th className="py-2.5 px-4">Storage Type</th>
            <th className="py-2.5 px-4">Nullable</th>
            <th className="py-2.5 px-4">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {schemaEntries.map(([col, type]) => (
            <tr key={col} className="hover:bg-surface-subtle/40">
              <td className="py-2.5 px-4 font-mono font-medium text-text">
                {col}
              </td>
              <td className="py-2.5 px-4 font-mono text-blue-400">{type}</td>
              <td className="py-2.5 px-4 text-text-secondary">YES</td>
              <td className="py-2.5 px-4 text-text-secondary">
                Standard analytical field in {dataset.displayName}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
