import { apiFetch } from "../../lib/api";
import type {
  TrainModelRequest,
  MlModelDto,
  MlModelStatus,
  MlExperiment,
  MlTrainOutcome,
} from "./mlTypes";

export async function trainModel(
  payload: TrainModelRequest,
): Promise<MlTrainOutcome> {
  const res = await apiFetch("/api/v1/ml/train", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || "Model training failed");
  }
  return res.json();
}

export async function listModels(status?: string): Promise<MlModelDto[]> {
  const url = status
    ? `/api/v1/ml/models?status=${encodeURIComponent(status)}`
    : "/api/v1/ml/models";
  const res = await apiFetch(url);
  if (!res.ok) {
    throw new Error("Failed to load registered models");
  }
  return res.json();
}

export async function getModel(id: string): Promise<MlModelDto> {
  const res = await apiFetch(`/api/v1/ml/models/${id}`);
  if (!res.ok) {
    throw new Error(`Failed to load model ${id}`);
  }
  return res.json();
}

export async function promoteModel(
  id: string,
  status: MlModelStatus,
): Promise<MlModelDto> {
  const res = await apiFetch(`/api/v1/ml/models/${id}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || "Failed to update model status");
  }
  return res.json();
}

export async function listExperiments(): Promise<MlExperiment[]> {
  const res = await apiFetch("/api/v1/ml/experiments");
  if (!res.ok) {
    throw new Error("Failed to load ML experiments");
  }
  return res.json();
}
