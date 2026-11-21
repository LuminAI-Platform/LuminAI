import React from "react";
import { Cpu, Play, Award, CheckCircle } from "../../../lib/icons";
import { Button } from "../../../components/ui/Button";
import type { MlTrainOutcome } from "../../../features/datasets/types";

export type MlTaskType = "CLASSIFICATION" | "REGRESSION";

const DEFAULT_ALGORITHM_BY_TASK: Record<MlTaskType, string> = {
  CLASSIFICATION: "Random Forest",
  REGRESSION: "Linear Regression",
};

interface TrainEvaluateTabProps {
  modelName: string;
  onModelNameChange: (value: string) => void;
  taskType: MlTaskType;
  onTaskTypeChange: (value: MlTaskType) => void;
  algorithm: string;
  onAlgorithmChange: (value: string) => void;
  targetColumn: string;
  onTargetColumnChange: (value: string) => void;
  onTrain: () => void;
  isTraining: boolean;
  lastTrainedResult: MlTrainOutcome | null;
  onPromote: (runId: string) => void;
  isPromoting: boolean;
}

export const TrainEvaluateTab: React.FC<TrainEvaluateTabProps> = ({
  modelName,
  onModelNameChange,
  taskType,
  onTaskTypeChange,
  algorithm,
  onAlgorithmChange,
  targetColumn,
  onTargetColumnChange,
  onTrain,
  isTraining,
  lastTrainedResult,
  onPromote,
  isPromoting,
}) => {
  const handleTaskTypeChange = (nextTask: MlTaskType) => {
    onTaskTypeChange(nextTask);
    onAlgorithmChange(DEFAULT_ALGORITHM_BY_TASK[nextTask]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Configuration Card */}
      <div className="p-5 rounded-xl border border-border bg-surface flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-text">Experiment Setup</h3>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="ml-model-name"
            className="text-xs text-text-secondary"
          >
            Model Name
          </label>
          <input
            id="ml-model-name"
            type="text"
            value={modelName}
            onChange={(e) => onModelNameChange(e.target.value)}
            className="p-2 text-xs bg-surface-subtle border border-border rounded-lg text-text focus:outline-hidden focus:border-primary"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="ml-task-type" className="text-xs text-text-secondary">
            Task Type
          </label>
          <select
            id="ml-task-type"
            value={taskType}
            onChange={(e) => handleTaskTypeChange(e.target.value as MlTaskType)}
            className="p-2 text-xs bg-surface-subtle border border-border rounded-lg text-text focus:outline-hidden focus:border-primary"
          >
            <option value="CLASSIFICATION">Classification</option>
            <option value="REGRESSION">Regression</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="ml-algorithm" className="text-xs text-text-secondary">
            Algorithm
          </label>
          <select
            id="ml-algorithm"
            value={algorithm}
            onChange={(e) => onAlgorithmChange(e.target.value)}
            className="p-2 text-xs bg-surface-subtle border border-border rounded-lg text-text focus:outline-hidden focus:border-primary"
          >
            {taskType === "CLASSIFICATION" ? (
              <>
                <option value="Random Forest">Random Forest Classifier</option>
                <option value="Gradient Boosting">Gradient Boosting</option>
                <option value="Logistic Regression">Logistic Regression</option>
              </>
            ) : (
              <>
                <option value="Linear Regression">Linear Regression</option>
                <option value="Ridge">Ridge Regression</option>
                <option value="Random Forest Regressor">
                  Random Forest Regressor
                </option>
              </>
            )}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="ml-target-column"
            className="text-xs text-text-secondary"
          >
            Target Column
          </label>
          <input
            id="ml-target-column"
            type="text"
            value={targetColumn}
            onChange={(e) => onTargetColumnChange(e.target.value)}
            className="p-2 text-xs bg-surface-subtle border border-border rounded-lg text-text focus:outline-hidden focus:border-primary"
          />
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={onTrain}
          isLoading={isTraining}
          leftIcon={<Play className="w-4 h-4" />}
        >
          Train Model
        </Button>
      </div>

      {/* Evaluation Results Card */}
      <div className="lg:col-span-2 flex flex-col gap-4">
        {lastTrainedResult ? (
          <div className="p-5 rounded-xl border border-border bg-surface flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-semibold text-text">
                  Training Completed
                </h3>
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
              {Object.entries(lastTrainedResult.metrics || {}).map(
                ([metric, val]) => (
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
                ),
              )}
            </div>

            {lastTrainedResult.feature_importances && (
              <div className="flex flex-col gap-2 pt-2">
                <span className="text-xs font-semibold text-text">
                  Feature Importances
                </span>
                <div className="flex flex-col gap-2">
                  {lastTrainedResult.feature_importances.map(
                    (fi: { feature: string; importance: number }) => (
                      <div key={fi.feature} className="flex flex-col gap-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-mono text-text">
                            {fi.feature}
                          </span>
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
                    ),
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-12 rounded-xl border border-dashed border-border bg-surface text-center text-text-secondary flex flex-col items-center justify-center gap-2">
            <Cpu className="w-8 h-8 text-text-secondary" />
            <span className="text-sm font-medium">
              No active training execution
            </span>
            <span className="text-xs max-w-sm">
              Configure hyperparameters on the left and click "Train Model" to
              compute real scikit-learn cross-validation metrics.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
