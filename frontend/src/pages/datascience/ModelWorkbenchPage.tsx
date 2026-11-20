import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "../../components/layout/PageHeader";
import {
  Cpu,
  Play,
  Award,
  CheckCircle,
  BarChart3,
  ICON_SIZES,
} from "../../lib/icons";
import { Button } from "../../components/ui/Button";
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

export const ModelWorkbenchPage: React.FC = () => {
  const [modelName, setModelName] = useState<string>(
    "Customer Churn Predictor",
  );
  const [algorithm, setAlgorithm] = useState<string>("Random Forest");
  const [taskType, setTaskType] = useState<"CLASSIFICATION" | "REGRESSION">(
    "CLASSIFICATION",
  );
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
          {/* Configuration Card */}
          <div className="p-5 rounded-xl border border-border bg-surface flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-text">
              Experiment Setup
            </h3>

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
              <label className="text-xs text-text-secondary">Task Type</label>
              <select
                value={taskType}
                onChange={(e) =>
                  setTaskType(e.target.value as "CLASSIFICATION" | "REGRESSION")
                }
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
                    <option value="Random Forest">
                      Random Forest Classifier
                    </option>
                    <option value="Gradient Boosting">Gradient Boosting</option>
                    <option value="Logistic Regression">
                      Logistic Regression
                    </option>
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
              <label className="text-xs text-text-secondary">
                Target Column
              </label>
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
              onClick={() => trainMutation.mutate()}
              isLoading={trainMutation.isPending}
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
                    onClick={() =>
                      promoteMutation.mutate(lastTrainedResult.run_id)
                    }
                    isLoading={promoteMutation.isPending}
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
                          {typeof val === "number"
                            ? val.toFixed(3)
                            : String(val)}
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
                  Configure hyperparameters on the left and click "Train Model"
                  to compute real scikit-learn cross-validation metrics.
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "experiments" && (
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
                  <td className="py-3 px-4 text-text-secondary">
                    {exp.algorithm}
                  </td>
                  <td className="py-3 px-4 text-text-secondary">
                    {exp.taskType}
                  </td>
                  <td className="py-3 px-4 text-emerald-400 font-bold">
                    {exp.metrics.accuracy
                      ? `Acc: ${exp.metrics.accuracy.toFixed(3)}`
                      : `R²: ${exp.metrics.r2_score?.toFixed(3)}`}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => promoteMutation.mutate(exp.runId)}
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
      )}

      {activeTab === "registry" && (
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
      )}
    </div>
  );
};

export default ModelWorkbenchPage;
