import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "../../components/layout/PageHeader";
import { Cpu, Play, Award, BarChart3, ICON_SIZES } from "../../lib/icons";
import {
  trainMlModel,
  fetchMlExperiments,
  registerMlModel,
  fetchRegisteredModels,
} from "../../features/datasets/datasetApi";
import type {
  MlExperiment,
  MlModelRegistryItem,
  MlTrainOutcome,
} from "../../features/datasets/types";
import {
  TrainEvaluateTab,
  type MlTaskType,
} from "./components/TrainEvaluateTab";
import { ExperimentsTable } from "./components/ExperimentsTable";
import { ModelRegistryGrid } from "./components/ModelRegistryGrid";

export const ModelWorkbenchPage: React.FC = () => {
  const [modelName, setModelName] = useState<string>(
    "Customer Churn Predictor",
  );
  const [algorithm, setAlgorithm] = useState<string>("Random Forest");
  const [taskType, setTaskType] = useState<MlTaskType>("CLASSIFICATION");
  const [targetColumn, setTargetColumn] = useState<string>("churn");
  const [activeTab, setActiveTab] = useState<
    "train" | "experiments" | "registry"
  >("train");

  const { data: experiments = [], refetch: refetchExperiments } = useQuery<
    MlExperiment[]
  >({
    queryKey: ["ml-experiments"],
    queryFn: () => fetchMlExperiments("acme"),
  });

  const { data: registeredModels = [], refetch: refetchRegistry } = useQuery<
    MlModelRegistryItem[]
  >({
    queryKey: ["ml-registry"],
    queryFn: () => fetchRegisteredModels("acme"),
  });

  const [lastTrainedResult, setLastTrainedResult] =
    useState<MlTrainOutcome | null>(null);

  const trainMutation = useMutation({
    mutationFn: async () => {
      // Synthetic feature dataset representing structured customer profiles
      const records: Record<string, unknown>[] = [];
      for (let i = 0; i < 60; i++) {
        records.push({
          age: 22 + (i % 25),
          income: 30000 + i * 800,
          tenure_months: 1 + (i % 36),
          churn: i % 3 === 0 ? 1 : 0,
        });
      }
      return trainMlModel({
        model_name: modelName,
        dataset_name: "customer_profiles",
        dataset_version: 1,
        target_column: targetColumn,
        records,
        algorithm,
        task_type: taskType,
        test_size: 0.25,
      });
    },
    onSuccess: (data) => {
      setLastTrainedResult(data);
      void refetchExperiments();
    },
  });

  const promoteMutation = useMutation({
    mutationFn: (runId: string) =>
      registerMlModel({
        run_id: runId,
        name: modelName,
        status: "CHAMPION",
        description: "Promoted to production champion after cross-validation.",
      }),
    onSuccess: () => {
      void refetchRegistry();
      setActiveTab("registry");
    },
  });

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        breadcrumbs={[{ label: "Data Science" }, { label: "Model Workbench" }]}
        title="Data Science Studio & Model Registry"
        description="End-to-end CRISP-DM machine learning experimentation, Scikit-learn model evaluation, and Palantir Foundry-style Model Registry."
        icon={<Cpu size={ICON_SIZES.header} className="text-text-secondary" />}
      />

      {/* Tabs */}
      <div className="border-b border-border flex items-center gap-4 text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveTab("train")}
          className={`pb-3 px-1 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "train"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-text-secondary hover:text-text"
          }`}
        >
          <Play className="w-3.5 h-3.5" />
          <span>Train & Evaluate</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("experiments")}
          className={`pb-3 px-1 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "experiments"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-text-secondary hover:text-text"
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Experiment Leaderboard ({experiments.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("registry")}
          className={`pb-3 px-1 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "registry"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-text-secondary hover:text-text"
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Model Registry ({registeredModels.length})</span>
        </button>
      </div>

      {activeTab === "train" && (
        <TrainEvaluateTab
          modelName={modelName}
          onModelNameChange={setModelName}
          taskType={taskType}
          onTaskTypeChange={setTaskType}
          algorithm={algorithm}
          onAlgorithmChange={setAlgorithm}
          targetColumn={targetColumn}
          onTargetColumnChange={setTargetColumn}
          onTrain={() => trainMutation.mutate()}
          isTraining={trainMutation.isPending}
          lastTrainedResult={lastTrainedResult}
          onPromote={(runId) => promoteMutation.mutate(runId)}
          isPromoting={promoteMutation.isPending}
        />
      )}

      {activeTab === "experiments" && (
        <ExperimentsTable
          experiments={experiments}
          onPromote={(runId) => promoteMutation.mutate(runId)}
        />
      )}

      {activeTab === "registry" && (
        <ModelRegistryGrid registeredModels={registeredModels} />
      )}
    </div>
  );
};

export default ModelWorkbenchPage;
