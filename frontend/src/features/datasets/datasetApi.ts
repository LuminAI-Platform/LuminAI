import { apiFetch } from "../../lib/api";
import type {
  Dataset,
  DatasetLayer,
  DatasetVersion,
  LineageGraph,
  SavedQuery,
  SqlQueryResult,
  CleaningRecipePayload,
  CleaningExecutionResult,
  PipelineExecutionPayload,
  PipelineExecutionResult,
  EdaReportResult,
} from "./types";

export {
  trainModel,
  listModels,
  getModel,
  promoteModel,
  listExperiments,
} from "../ml/mlApi";

export async function fetchDatasets(params?: {
  layer?: string;
  projectType?: string;
  search?: string;
}): Promise<Dataset[]> {
  const query = new URLSearchParams();
  if (params?.layer && params.layer !== "ALL")
    query.append("layer", params.layer);
  if (params?.projectType) query.append("projectType", params.projectType);
  if (params?.search) query.append("search", params.search);

  const qs = query.toString();
  const url = `/api/v1/datasets${qs ? `?${qs}` : ""}`;
  const res = await apiFetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch datasets: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchDatasetById(id: string): Promise<Dataset> {
  const res = await apiFetch(`/api/v1/datasets/${id}`);
  if (!res.ok) {
    throw new Error(`Failed to load dataset ${id}: ${res.statusText}`);
  }
  return res.json();
}

export async function transitionDatasetLayer(
  id: string,
  layer: DatasetLayer,
): Promise<Dataset> {
  const res = await apiFetch(`/api/v1/datasets/${id}/layer`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ layer }),
  });
  if (!res.ok) {
    throw new Error(`Failed to transition dataset layer: ${res.statusText}`);
  }
  return res.json();
}

export async function deleteDataset(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/datasets/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Failed to delete dataset: ${res.statusText}`);
  }
}

export async function fetchDatasetVersions(
  id: string,
): Promise<DatasetVersion[]> {
  const res = await apiFetch(`/api/v1/datasets/${id}/versions`);
  if (!res.ok) {
    throw new Error(`Failed to load versions for dataset ${id}`);
  }
  return res.json();
}

export async function fetchDatasetLineage(id: string): Promise<LineageGraph> {
  const res = await apiFetch(`/api/v1/datasets/${id}/lineage`);
  if (!res.ok) {
    throw new Error(`Failed to load lineage for dataset ${id}`);
  }
  return res.json();
}

export async function generateEdaReport(
  id: string,
  records: Record<string, unknown>[] = [],
): Promise<EdaReportResult> {
  const res = await apiFetch(`/api/v1/datasets/${id}/eda`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ records }),
  });
  if (!res.ok) {
    throw new Error(`Failed to generate EDA report: ${res.statusText}`);
  }
  return res.json();
}

export async function previewCleaningRecipe(
  payload: CleaningRecipePayload,
): Promise<Record<string, unknown>> {
  const res = await apiFetch("/api/v1/datasets/cleaning/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.detail || "Cleaning preview failed");
  }
  return res.json();
}

export async function executeCleaningRecipe(
  payload: CleaningRecipePayload,
): Promise<CleaningExecutionResult> {
  const res = await apiFetch("/api/v1/datasets/cleaning/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.detail || "Cleaning execution failed");
  }
  return res.json();
}

export async function executeDatasetPipeline(
  payload: PipelineExecutionPayload,
): Promise<PipelineExecutionResult> {
  const res = await apiFetch("/api/v1/datasets/pipelines/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.detail || "Pipeline execution failed");
  }
  return res.json();
}

export async function runSqlQuery(payload: {
  query: string;
  limit?: number;
  tables?: Record<string, unknown[]>;
}): Promise<SqlQueryResult> {
  const res = await apiFetch("/api/v1/datasets/sql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail ||
        errorData.message ||
        `SQL Execution failed (${res.status})`,
    );
  }
  return res.json();
}

export async function fetchSavedQueries(): Promise<SavedQuery[]> {
  const res = await apiFetch("/api/v1/datasets/queries");
  if (!res.ok) {
    throw new Error("Failed to load saved queries");
  }
  return res.json();
}

export async function createSavedQuery(payload: {
  name: string;
  sqlText: string;
  description?: string;
  chartConfig?: Record<string, unknown>;
}): Promise<SavedQuery> {
  const res = await apiFetch("/api/v1/datasets/queries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error("Failed to save query");
  }
  return res.json();
}

export async function trainMlModel(payload: {
  model_name: string;
  dataset_name: string;
  dataset_version: number;
  target_column: string;
  records: Record<string, unknown>[];
  algorithm: string;
  task_type: "CLASSIFICATION" | "REGRESSION";
  test_size?: number;
}) {
  const res = await apiFetch("/analytics/ml/train", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || errorData.message || "Model training failed",
    );
  }
  return res.json();
}

