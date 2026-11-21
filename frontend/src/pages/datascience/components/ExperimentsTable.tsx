import React from "react";
import type { MlExperiment } from "../../../features/datasets/types";

interface ExperimentsTableProps {
  experiments: MlExperiment[];
  onPromote: (runId: string) => void;
}

export const ExperimentsTable: React.FC<ExperimentsTableProps> = ({
  experiments,
  onPromote,
}) => {
  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <table className="w-full text-left text-xs">
        <thead className="bg-surface-subtle text-text-secondary font-semibold border-b border-border">
          <tr>
            <th className="py-3 px-4">Run ID</th>
            <th className="py-3 px-4">Model Name</th>
            <th className="py-3 px-4">Algorithm</th>
            <th className="py-3 px-4">Task</th>
            <th className="py-3 px-4">Validation Score</th>
            <th className="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border font-mono">
          {experiments.map((exp) => (
            <tr key={exp.runId} className="hover:bg-surface-subtle/40">
              <td className="py-3 px-4 font-mono text-primary text-[11px]">
                {exp.runId.substring(0, 8)}...
              </td>
              <td className="py-3 px-4 font-sans font-medium text-text">
                {exp.modelName}
              </td>
              <td className="py-3 px-4 text-text-secondary">{exp.algorithm}</td>
              <td className="py-3 px-4 text-text-secondary">{exp.taskType}</td>
              <td className="py-3 px-4 text-emerald-400 font-bold">
                {exp.metrics.accuracy !== undefined
                  ? `Acc: ${exp.metrics.accuracy.toFixed(3)}`
                  : exp.metrics.r2_score !== undefined
                    ? `R²: ${exp.metrics.r2_score.toFixed(3)}`
                    : "N/A"}
              </td>
              <td className="py-3 px-4 text-right">
                <button
                  type="button"
                  onClick={() => onPromote(exp.runId)}
                  className="text-xs text-primary hover:underline font-sans cursor-pointer"
                >
                  Promote to Champion
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
