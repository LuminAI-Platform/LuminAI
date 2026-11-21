import React from "react";
import type { InferredProp } from "../autoGenerateUtils";

interface InferredPropsTableProps {
  inferredProps: InferredProp[];
}

export const InferredPropsTable: React.FC<InferredPropsTableProps> = ({
  inferredProps,
}) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
          3. Inferred Attributes & Types ({inferredProps.length})
        </label>
        <span className="text-[10px] text-zinc-500">
          Automatically detected from dataset schema
        </span>
      </div>
      <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/60 max-h-48 overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-900/80 text-[10px] font-semibold text-zinc-400 uppercase border-b border-zinc-800">
            <tr>
              <th className="px-3 py-2">Property Name</th>
              <th className="px-3 py-2">Inferred Type</th>
              <th className="px-3 py-2">Required</th>
              <th className="px-3 py-2">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900 font-mono text-[11px]">
            {inferredProps.map((p, idx) => (
              <tr key={`${p.name}-${idx}`} className="hover:bg-zinc-900/30">
                <td className="px-3 py-2 font-semibold text-zinc-200">
                  {p.name}
                </td>
                <td className="px-3 py-2">
                  <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase font-semibold">
                    {p.type}
                  </span>
                </td>
                <td className="px-3 py-2 text-zinc-400">
                  {p.required ? (
                    <span className="text-amber-400 font-bold">YES</span>
                  ) : (
                    "NO"
                  )}
                </td>
                <td className="px-3 py-2 text-zinc-500 truncate max-w-xs">
                  {p.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
