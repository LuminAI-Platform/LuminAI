import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "../../components/layout/PageHeader";
import { apiFetch } from "../../lib/api";
import {
  ICON_MAP,
  Play,
  Award,
  BarChart3,
  AlertCircle,
  ICON_SIZES,
} from "../../lib/icons";
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
  const [modelName, setModelName] = useState<string>("");
  const [algorithm, setAlgorithm] = useState<string>("Random Forest");
  const [taskType, setTaskType] = useState<MlTaskType>("CLASSIFICATION");
  const [targetColumn, setTargetColumn] = useState<string>("");
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("datasetId") ?? "";
  });
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
      const selectedDataset = datasets.find((d) => d.id === selectedDatasetId);
      if (!selectedDataset) {
        throw new Error("Please select a catalog dataset before training.");
      }
      if (!modelName.trim() || !targetColumn.trim()) {
        throw new Error("Model name and target column are required.");
      }

      let records: Record<string, unknown>[] = [];
      if (selectedDataset.sourceConnectionId) {
        try {
          const cleanRes = await apiFetch(
            `/api/v1/connections/${selectedDataset.sourceConnectionId}/clean-preview`,
            { headers: { "X-Suppress-Toast": "true" } },
          );
          const cleanJson = await cleanRes.json();
          if (Array.isArray(cleanJson?.rows)) records = cleanJson.rows;
        } catch {
          try {
            const rawRes = await apiFetch(
              `/api/v1/connections/${selectedDataset.sourceConnectionId}/preview/file`,
              { headers: { "X-Suppress-Toast": "true" } },
            );
            const rawJson = await rawRes.json();
            if (Array.isArray(rawJson)) records = rawJson;
          } catch {
            // Backend will validate records
          }
        }
      }

      return trainModel({
        modelName: modelName.trim(),
        datasetId: selectedDataset.id,
        datasetName: selectedDataset.name,
        datasetVersion: selectedDataset.currentVersion,
        targetColumn: targetColumn.trim(),
        records,
        algorithm,
        taskType,
      });
    },
    onSuccess: (data) => {
      setLastTrainedResult(data);
      void refetchExperiments();
      void refetchRegistry();
    },
  });

  const promoteMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: MlModelStatus }) =>
      promoteModel(id, status),
    onSuccess: () => {
      void refetchRegistry();
      setActiveTab("registry");
    },
  });

  const handlePromoteRun = async (idOrRunId?: string) => {
    const targetId =
      idOrRunId ||
      lastTrainedResult?.model_id ||
      lastTrainedResult?.run_id ||
      registeredModels[0]?.id;
    if (targetId) {
      promoteMutation.mutate({ id: targetId, status: "CHAMPION" });
    }
  };

  const handleUpdateStatus = (modelId: string, status: MlModelStatus) => {
    promoteMutation.mutate({ id: modelId, status });
  };

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        breadcrumbs={[{ label: "Data Science" }, { label: "Model Workbench" }]}
        title="Data Science Studio & Model Registry"
        description="End-to-end machine learning experimentation, model evaluation, and governed Model Registry."
        icon={
          <ICON_MAP.nav.mlStudio
            size={ICON_SIZES.header}
            className="text-text-secondary"
            aria-hidden="true"
          />
        }
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
            {(trainMutation.isError || promoteMutation.isError) && (
              <div className="p-3.5 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  {
                    ((trainMutation.error || promoteMutation.error) as Error)
                      ?.message
                  }
                </span>
              </div>
            )}
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
