import { ApiError, ApiTimeoutError } from "../../lib/api";
import type { GraphElements } from "./components/GraphCanvas";

export interface GraphResponse {
  nodes: Array<{
    data: {
      id: string;
      label: string;
      entityType?: string;
      properties?: Record<string, unknown>;
      color?: string;
    };
  }>;
  edges: Array<{
    data: {
      id: string;
      source: string;
      target: string;
      label?: string;
      relationshipType?: string;
      weight?: number;
    };
  }>;
  centerNodeId?: string;
  totalNodes?: number;
  totalEdges?: number;
}

export interface SuggestedEntity {
  id: string;
  canonicalName: string;
  entityType: string;
}

export interface CatalogSummary {
  items: SuggestedEntity[];
  total: number;
  entityTypes: string[];
}

export interface GraphErrorInfo {
  statusCode: number | null;
  message: string;
}

export type GraphViewState =
  | "loading"
  | "error"
  | "empty_catalog"
  | "idle"
  | "entity_not_found"
  | "loaded_isolated"
  | "loaded";

export interface GraphBadgeInfo {
  label: string;
  variant: "emerald" | "zinc" | "error";
}

/**
 * Extracts structured HTTP status and message from an unknown error.
 */
export function extractGraphErrorInfo(err: unknown): GraphErrorInfo {
  if (err instanceof ApiError) {
    return {
      statusCode: err.status,
      message: err.message || `HTTP ${err.status}`,
    };
  }
  if (err instanceof ApiTimeoutError) {
    return {
      statusCode: err.status,
      message: err.message,
    };
  }
  if (err instanceof Error) {
    return {
      statusCode: null,
      message: err.message,
    };
  }
  return {
    statusCode: null,
    message: "Unexpected network or service error",
  };
}

/**
 * Filters graph elements by entity type and relationship type.
 * - Preserves isolated nodes (nodes with 0 edges).
 * - Removes dangling edges whose source or target was filtered out,
 *   preventing Cytoscape from throwing on missing endpoints.
 */
export function filterGraphElements(
  graphData: GraphElements,
  selectedTypeFilter: string | null,
  selectedRelFilter: string | null,
): GraphElements {
  const nodes = selectedTypeFilter
    ? graphData.nodes.filter((n) => n.data.entityType === selectedTypeFilter)
    : graphData.nodes;

  const visibleNodeIds = new Set(nodes.map((n) => n.data.id));

  const edges = graphData.edges.filter((e) => {
    if (
      !visibleNodeIds.has(e.data.source) ||
      !visibleNodeIds.has(e.data.target)
    ) {
      return false;
    }
    if (selectedRelFilter && e.data.relationshipType !== selectedRelFilter) {
      return false;
    }
    return true;
  });

  return { nodes, edges };
}

/**
 * Computes the honest header badge state from current graph status.
 */
export function computeGraphBadge(params: {
  hasError: boolean;
  hasActiveEntity: boolean;
  isLoading: boolean;
  nodeCount: number;
  edgeCount: number;
}): GraphBadgeInfo {
  if (params.hasError) {
    return { label: "Graph unavailable", variant: "error" };
  }
  if (
    (params.hasActiveEntity || params.nodeCount > 0) &&
    !params.isLoading &&
    params.nodeCount > 0
  ) {
    return {
      label: `Graph loaded - ${params.nodeCount} nodes, ${params.edgeCount} edges`,
      variant: "emerald",
    };
  }
  return { label: "Ready", variant: "zinc" };
}

/**
 * Derives the mutually exclusive visual state of the graph canvas so
 * a blank unexplained canvas is impossible.
 */
export function deriveGraphViewState(params: {
  isLoading: boolean;
  hasError: boolean;
  activeEntityId: string | null;
  catalogTotal: number | null;
  nodeCount: number;
  edgeCount: number;
}): GraphViewState {
  if (params.isLoading) return "loading";
  if (params.hasError) return "error";

  if (!params.activeEntityId && params.nodeCount === 0) {
    if (params.catalogTotal === 0) return "empty_catalog";
    return "idle";
  }

  if (params.nodeCount === 0) return "entity_not_found";
  if (params.edgeCount === 0) return "loaded_isolated";
  return "loaded";
}

export function getSearchParamEntityId(): string | null {
  if (typeof window !== "undefined") {
    const sp = new URLSearchParams(window.location.search);
    const val = sp.get("entityId")?.trim();
    return val ? val : null;
  }
  return null;
}
