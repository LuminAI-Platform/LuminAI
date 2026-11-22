import React from "react";
import type { MlModelDto, MlModelStatus } from "../../../features/ml/mlTypes";

interface ModelRegistryGridProps {
  models: MlModelDto[];
  onUpdateStatus?: (modelId: string, status: MlModelStatus) => void;
}

export const ModelRegistryGrid: React.FC<ModelRegistryGridProps> = ({
  models,
  onUpdateStatus,
}) => {
  if (models.length === 0) {
    return (
      <div className="p-12 text-center text-text-secondary bg-surface rounded-xl border border-border">
        No registered models in registry. Promote an experiment outcome to
        register a production champion model.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {models.map((m) => (
        <div
          key={m.id}
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
                  : m.status === "CHALLENGER"
                    ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                    : "bg-slate-500/10 text-slate-400 border-slate-500/20"
              }`}
            >
              {m.status}
            </span>
          </div>

          <div className="flex flex-col gap-1 text-xs text-text-secondary">
            <span>Algorithm: {m.algorithm}</span>
            <span>Task: {m.taskType}</span>
            {m.datasetId && (
              <span className="font-mono text-[11px] truncate">
                Dataset: {m.datasetId}
              </span>
            )}
          </div>

          <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-text-secondary">
            <span>Registered: {new Date(m.createdAt).toLocaleDateString()}</span>
            {onUpdateStatus && m.status !== "CHAMPION" && (
              <button
                onClick={() => onUpdateStatus(m.id, "CHAMPION")}
                className="text-primary hover:underline text-xs cursor-pointer"
              >
                Make Champion
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
