import { apiFetch } from "../../lib/api";
import type {
  Dataset,
  DatasetVersion,
  LineageGraph,
  MlExperiment,
  MlModelRegistryItem,
  MlTrainOutcome,
  SavedQuery,
  SqlQueryResult,
} from "./types";

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
}): Promise<MlTrainOutcome> {
  const res = await apiFetch("/analytics/ml/train", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Model training failed");
  }
  return res.json();
}

export async function fetchMlExperiments(
  tenantId = "acme",
): Promise<MlExperiment[]> {
  const res = await apiFetch(`/analytics/ml/experiments?tenant_id=${tenantId}`);
  if (!res.ok) {
    throw new Error("Failed to load ML experiments");
  }
  return res.json();
}

export async function registerMlModel(payload: {
  run_id: string;
  name: string;
  status: "CHAMPION" | "CHALLENGER";
  description?: string;
  tenant_id?: string;
}): Promise<MlModelRegistryItem> {
  const res = await apiFetch("/analytics/ml/models/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to register model");
  }
  return res.json();
}

export async function fetchRegisteredModels(
  tenantId = "acme",
): Promise<MlModelRegistryItem[]> {
  const res = await apiFetch(`/analytics/ml/models?tenant_id=${tenantId}`);
  if (!res.ok) {
    throw new Error("Failed to load registered models");
  }
  return res.json();
}
