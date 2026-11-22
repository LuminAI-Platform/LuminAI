import React from "react";
import { Award, CheckCircle, Cpu } from "../../../lib/icons";
import { Button } from "../../../components/ui/Button";
import type { MlTrainOutcome } from "../../../features/ml/mlTypes";

interface ModelEvaluationViewProps {
  lastTrainedResult: MlTrainOutcome | null;
  onPromote: (runId: string) => void;
  isPromoting: boolean;
}

export const ModelEvaluationView: React.FC<ModelEvaluationViewProps> = ({
  lastTrainedResult,
  onPromote,
  isPromoting,
}) => {
  if (!lastTrainedResult) {
    return (
      <div className="p-12 rounded-xl border border-dashed border-border bg-surface text-center text-text-secondary flex flex-col items-center justify-center gap-2">
        <Cpu className="w-8 h-8 text-text-secondary" />
        <span className="text-sm font-medium">No active training execution</span>
        <span className="text-xs max-w-sm">
          Configure hyperparameters on the left and click "Train Model" to
          compute real scikit-learn cross-validation metrics.
        </span>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-xl border border-border bg-surface flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-semibold text-text">Training Completed</h3>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => onPromote(lastTrainedResult.run_id)}
          isLoading={isPromoting}
          leftIcon={<Award className="w-3.5 h-3.5" />}
        >
          Promote to Champion
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(lastTrainedResult.metrics || {}).map(([metric, val]) => (
          <div
            key={metric}
            className="p-3 rounded-lg bg-surface-subtle border border-border"
          >
            <span className="text-[11px] text-text-secondary uppercase block">
              {metric}
            </span>
            <span className="text-lg font-bold text-emerald-400">
              {typeof val === "number" ? val.toFixed(3) : String(val)}
            </span>
          </div>
        ))}
      </div>

      {lastTrainedResult.feature_importances && (
        <div className="flex flex-col gap-2 pt-2">
          <span className="text-xs font-semibold text-text">
            Feature Importances
          </span>
          <div className="flex flex-col gap-2">
            {lastTrainedResult.feature_importances.map((fi) => (
              <div key={fi.feature} className="flex flex-col gap-1">
                <div className="flex justify-between text-xs">
                  <span className="font-mono text-text">{fi.feature}</span>
                  <span className="text-text-secondary">
                    {(fi.importance * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 bg-surface-subtle rounded-full overflow-hidden border border-border">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${fi.importance * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
