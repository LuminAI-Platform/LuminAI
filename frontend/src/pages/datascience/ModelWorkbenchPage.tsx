import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "../../components/layout/PageHeader";
import { Cpu, Play, Award, BarChart3, ICON_SIZES } from "../../lib/icons";
import { fetchDatasets } from "../../features/datasets/datasetApi";
import {
  trainModel,
  listModels,
  promoteModel,
  listExperiments,
} from "../../features/ml/mlApi";
import type {
  MlExperiment,
  MlModelDto,
  MlModelStatus,
  MlTaskType,
  MlTrainOutcome,
} from "../../features/ml/mlTypes";
import type { Dataset } from "../../features/datasets/types";
import { ModelTrainSetup } from "./components/ModelTrainSetup";
import { ModelEvaluationView } from "./components/ModelEvaluationView";
import { ModelExperimentTable } from "./components/ModelExperimentTable";
import { ModelRegistryGrid } from "./components/ModelRegistryGrid";

export const ModelWorkbenchPage: React.FC = () => {
  const [modelName, setModelName] = useState<string>("Customer Churn Predictor");
  const [algorithm, setAlgorithm] = useState<string>("Random Forest");
  const [taskType, setTaskType] = useState<MlTaskType>("CLASSIFICATION");
  const [targetColumn, setTargetColumn] = useState<string>("churn");
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<
    "train" | "experiments" | "registry"
  >("train");
  const [lastTrainedResult, setLastTrainedResult] =
    useState<MlTrainOutcome | null>(null);

  const { data: datasets = [] } = useQuery<Dataset[]>({
    queryKey: ["datasets"],
    queryFn: () => fetchDatasets(),
  });

  const { data: experiments = [], refetch: refetchExperiments } = useQuery<
    MlExperiment[]
  >({
    queryKey: ["ml-experiments"],
    queryFn: listExperiments,
  });

  const { data: registeredModels = [], refetch: refetchRegistry } = useQuery<
    MlModelDto[]
  >({
    queryKey: ["ml-models"],
    queryFn: () => listModels(),
  });

  const trainMutation = useMutation({
    mutationFn: async () => {
      const records: Record<string, unknown>[] = [];
      for (let i = 0; i < 60; i++) {
        records.push({
          age: 22 + (i % 25),
          income: 30000 + i * 800,
          tenure_months: 1 + (i % 36),
          churn: i % 3 === 0 ? 1 : 0,
        });
      }

      return trainModel({
        modelName,
        datasetId: selectedDatasetId || undefined,
        datasetName: selectedDatasetId
          ? datasets.find((d) => d.id === selectedDatasetId)?.name
          : "customer_profiles",
        targetColumn,
        records,
        algorithm,
        taskType,
        testSize: 0.25,
      });
    },
    onSuccess: (data) => {
      setLastTrainedResult(data);
      void refetchExperiments();
    },
  });

  const promoteMutation = useMutation({
    mutationFn: (modelId: string) => promoteModel(modelId, "CHAMPION"),
    onSuccess: () => {
      void refetchRegistry();
      setActiveTab("registry");
    },
  });

  const handlePromoteRun = async (runId?: string) => {
    if (runId) {
      promoteMutation.mutate(runId);
    } else if (lastTrainedResult?.model_id) {
      promoteMutation.mutate(lastTrainedResult.model_id);
    } else if (registeredModels.length > 0) {
      promoteMutation.mutate(registeredModels[0].id);
    }
  };

  const handleUpdateStatus = (modelId: string, status: MlModelStatus) => {
    promoteModel(modelId, status).then(() => void refetchRegistry());
  };

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        breadcrumbs={[{ label: "Data Science" }, { label: "Model Workbench" }]}
        title="Data Science Studio & Model Registry"
        description="End-to-end machine learning experimentation, Scikit-learn model evaluation, and Palantir Foundry-style Model Registry."
        icon={<Cpu size={ICON_SIZES.header} className="text-text-secondary" />}
      />

      <div className="border-b border-border flex items-center gap-4 text-xs font-medium">
        <button
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ModelTrainSetup
            modelName={modelName}
            setModelName={setModelName}
            algorithm={algorithm}
            setAlgorithm={setAlgorithm}
            taskType={taskType}
            setTaskType={setTaskType}
            targetColumn={targetColumn}
            setTargetColumn={setTargetColumn}
            selectedDatasetId={selectedDatasetId}
            setSelectedDatasetId={setSelectedDatasetId}
            datasets={datasets}
            onTrain={() => trainMutation.mutate()}
            isTraining={trainMutation.isPending}
          />
          <div className="lg:col-span-2 flex flex-col gap-4">
            <ModelEvaluationView
              lastTrainedResult={lastTrainedResult}
              onPromote={handlePromoteRun}
              isPromoting={promoteMutation.isPending}
            />
          </div>
        </div>
      )}

      {activeTab === "experiments" && (
        <ModelExperimentTable
          experiments={experiments}
          onPromote={handlePromoteRun}
        />
      )}

      {activeTab === "registry" && (
        <ModelRegistryGrid
          models={registeredModels}
          onUpdateStatus={handleUpdateStatus}
        />
      )}
    </div>
  );
};

export default ModelWorkbenchPage;
