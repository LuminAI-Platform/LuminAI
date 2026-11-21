import React from "react";
import type { MlModelRegistryItem } from "../../../features/datasets/types";

interface ModelRegistryGridProps {
  registeredModels: MlModelRegistryItem[];
}

export const ModelRegistryGrid: React.FC<ModelRegistryGridProps> = ({
  registeredModels,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {registeredModels.map((m) => (
        <div
          key={m.modelId}
          className="p-4 rounded-xl border border-border bg-surface flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-text">
              {m.name}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                m.status === "CHAMPION"
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  : "bg-blue-500/10 text-blue-400 border-blue-500/20"
              }`}
            >
              {m.status}
            </span>
          </div>
          <span className="text-xs text-text-secondary">
            {m.description || "Production model release."}
          </span>
          <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-text-secondary">
            <span>Version {m.version}</span>
            <span>{m.algorithm}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
