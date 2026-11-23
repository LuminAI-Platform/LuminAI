import { apiFetch } from "../../lib/api";

export interface GraphNodeItem {
  id: string;
  label?: string;
  canonicalName?: string;
  entityType?: string;
  properties?: Record<string, unknown>;
}

export interface GraphEdgeItem {
  id: string;
  source: string;
  target: string;
  relationshipType: string;
  properties?: Record<string, unknown>;
}

export interface GraphQueryResponse {
  nodes: Array<{ data: GraphNodeItem }>;
  edges: Array<{ data: GraphEdgeItem }>;
  centerNodeId?: string;
  totalNodes?: number;
  totalEdges?: number;
}

export interface GraphStatsResponse {
  entityId: string;
  degree: number;
  inDegree: number;
  outDegree: number;
  relationshipCounts: Record<string, number>;
}

export interface DecomposedSyncResult {
  status: string;
  nodesCreated?: number;
  relationshipsCreated?: number;
  errors?: string[];
}

export async function fetchGraphNeighbourhood(params: {
  entityId?: string;
  depth?: number;
  relationshipType?: string;
}): Promise<GraphQueryResponse> {
  const query = new URLSearchParams();
  if (params.entityId) query.append("entityId", params.entityId);
  if (params.depth) query.append("depth", String(params.depth));
  if (params.relationshipType)
    query.append("relationshipType", params.relationshipType);

  const qs = query.toString();
  const url = `/api/v1/graph/neighbourhood${qs ? `?${qs}` : ""}`;
  const res = await apiFetch(url, { headers: { "X-Suppress-Toast": "true" } });
  if (!res.ok) {
    throw new Error(`Graph query failed (${res.status})`);
  }
  return res.json();
}

export async function fetchGraphOverview(): Promise<GraphQueryResponse> {
  const res = await apiFetch("/api/v1/graph/overview", {
    headers: { "X-Suppress-Toast": "true" },
  });
  if (!res.ok) {
    throw new Error("Failed to load graph overview");
  }
  return res.json();
}

export async function fetchShortestPath(
  sourceId: string,
  targetId: string,
): Promise<GraphQueryResponse> {
  const query = new URLSearchParams({
    sourceId: sourceId.trim(),
    targetId: targetId.trim(),
  });
  const res = await apiFetch(`/api/v1/graph/shortest-path?${query.toString()}`);
  if (!res.ok) {
    throw new Error("Failed to find shortest path");
  }
  return res.json();
}

export async function fetchGraphStats(
  entityId: string,
): Promise<GraphStatsResponse> {
  const res = await apiFetch(
    `/api/v1/graph/stats?entityId=${encodeURIComponent(entityId.trim())}`,
  );
  if (!res.ok) {
    throw new Error("Failed to load graph stats");
  }
  return res.json();
}

export async function syncDecomposedGraph(payload: {
  nodes: Record<string, unknown>[];
  edges: Record<string, unknown>[];
}): Promise<DecomposedSyncResult> {
  const res = await apiFetch("/api/v1/graph/sync/decomposed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err.message || err.detail || "Graph synchronization failed",
    );
  }
  return res.json();
}

export async function decomposeAndSyncGraph(payload: {
  records: Record<string, unknown>[];
  rules: Record<string, unknown>[];
}): Promise<DecomposedSyncResult> {
  const res = await apiFetch("/api/v1/graph/decompose-and-sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err.message || err.detail || "Decomposition and graph sync failed",
    );
  }
  return res.json();
}
