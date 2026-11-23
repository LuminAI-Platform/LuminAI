import React from "react";
import { Play } from "../../../lib/icons";
import { Button } from "../../../components/ui/Button";
import type { Dataset } from "../../../features/datasets/types";
import type { MlTaskType } from "../../../features/ml/mlTypes";

interface ModelTrainSetupProps {
  modelName: string;
  setModelName: (v: string) => void;
  algorithm: string;
  setAlgorithm: (v: string) => void;
  taskType: MlTaskType;
  setTaskType: (v: MlTaskType) => void;
  targetColumn: string;
  setTargetColumn: (v: string) => void;
  selectedDatasetId: string;
  setSelectedDatasetId: (v: string) => void;
  datasets: Dataset[];
  onTrain: () => void;
  isTraining: boolean;
}

export const ModelTrainSetup: React.FC<ModelTrainSetupProps> = ({
  modelName,
  setModelName,
  algorithm,
  setAlgorithm,
  taskType,
  setTaskType,
  targetColumn,
  setTargetColumn,
  selectedDatasetId,
  setSelectedDatasetId,
  datasets,
  onTrain,
  isTraining,
}) => {
  return (
    <div className="p-5 rounded-xl border border-border bg-surface flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-text">Experiment Setup</h3>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-text-secondary">Model Name</label>
        <input
          type="text"
          value={modelName}
          onChange={(e) => setModelName(e.target.value)}
          className="p-2 text-xs bg-surface-subtle border border-border rounded-lg text-text focus:outline-hidden focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-text-secondary">Source Dataset</label>
        <select
          value={selectedDatasetId}
          onChange={(e) => setSelectedDatasetId(e.target.value)}
          className="p-2 text-xs bg-surface-subtle border border-border rounded-lg text-text focus:outline-hidden focus:border-primary"
        >
          <option value="">Default: Synthetic Customer Profiles</option>
          {datasets.map((d) => (
            <option key={d.id} value={d.id}>
              {d.displayName || d.name} ({d.layer} • v{d.currentVersion})
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-text-secondary">Task Type</label>
        <select
          value={taskType}
          onChange={(e) => setTaskType(e.target.value as MlTaskType)}
          className="p-2 text-xs bg-surface-subtle border border-border rounded-lg text-text focus:outline-hidden focus:border-primary"
        >
          <option value="CLASSIFICATION">Classification</option>
          <option value="REGRESSION">Regression</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-text-secondary">Algorithm</label>
        <select
          value={algorithm}
          onChange={(e) => setAlgorithm(e.target.value)}
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
        <label className="text-xs text-text-secondary">Target Column</label>
        <input
          type="text"
          value={targetColumn}
          onChange={(e) => setTargetColumn(e.target.value)}
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
  );
};
