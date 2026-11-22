import React from "react";
import type { MlExperiment } from "../../../features/ml/mlTypes";

interface ModelExperimentTableProps {
  experiments: MlExperiment[];
  onPromote: (runId: string) => void;
}

export const ModelExperimentTable: React.FC<ModelExperimentTableProps> = ({
  experiments,
  onPromote,
}) => {
  if (experiments.length === 0) {
    return (
      <div className="p-12 text-center text-text-secondary bg-surface rounded-xl border border-border">
        No recorded experiments found. Train a model to record an experiment run.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <table className="w-full text-left text-xs">
        <thead className="bg-surface-subtle text-text-secondary font-semibold border-b border-border">
          <tr>
            <th className="py-3 px-4">Run ID</th>
            <th className="py-3 px-4">Experiment / Model</th>
            <th className="py-3 px-4">Status</th>
            <th className="py-3 px-4">Primary Metric</th>
            <th className="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border font-mono">
          {experiments.map((exp) => {
            const acc = exp.metrics?.accuracy;
            const r2 = exp.metrics?.r2_score;
            const f1 = exp.metrics?.f1_score;
            const metricDisplay =
              acc !== undefined
                ? `Acc: ${acc.toFixed(3)}`
                : r2 !== undefined
                  ? `R²: ${r2.toFixed(3)}`
                  : f1 !== undefined
                    ? `F1: ${f1.toFixed(3)}`
                    : "—";

            return (
              <tr key={exp.run_id} className="hover:bg-surface-subtle/40">
                <td className="py-3 px-4 font-mono text-primary text-[11px]">
                  {exp.run_id.substring(0, 8)}...
                </td>
                <td className="py-3 px-4 font-sans font-medium text-text">
                  {exp.model_name || exp.experiment_name}
                </td>
                <td className="py-3 px-4 text-text-secondary">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20">
                    {exp.status || "COMPLETED"}
                  </span>
                </td>
                <td className="py-3 px-4 text-emerald-400 font-bold">
                  {metricDisplay}
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={() => onPromote(exp.run_id)}
                    className="text-xs text-primary hover:underline font-sans cursor-pointer"
                  >
                    Promote to Champion
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
