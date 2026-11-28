import { ApiError, ApiTimeoutError } from "../../lib/api";
import type { GraphElements } from "./components/GraphCanvas";
import {
  computeEntityTypeLabelFields,
  resolveEntityLabel,
  type LabelableEntity,
} from "../explorer/utils/entityLabel";

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
 * Incrementally merges newly discovered neighbourhood nodes and edges into
 * an existing graph snapshot without losing existing context or creating duplicates.
 */
export function mergeGraphElements(
  current: GraphElements,
  incoming: GraphElements,
): GraphElements {
  const nodeMap = new Map<string, GraphElements["nodes"][number]>();
  for (const node of current.nodes) {
    nodeMap.set(node.data.id, node);
  }
  for (const node of incoming.nodes) {
    const existing = nodeMap.get(node.data.id);
    if (existing) {
      nodeMap.set(node.data.id, {
        data: {
          ...existing.data,
          ...node.data,
          properties: node.data.properties ?? existing.data.properties,
        },
      });
    } else {
      nodeMap.set(node.data.id, node);
    }
  }

  const edgeById = new Map<string, GraphElements["edges"][number]>();
  const signatureToId = new Map<string, string>();
  const getSignature = (e: GraphElements["edges"][number]) =>
    `${e.data.source}::${e.data.relationshipType ?? ""}::${e.data.target}`;

  for (const edge of current.edges) {
    edgeById.set(edge.data.id, edge);
    signatureToId.set(getSignature(edge), edge.data.id);
  }
  for (const edge of incoming.edges) {
    const sig = getSignature(edge);
    const existingId = edgeById.has(edge.data.id)
      ? edge.data.id
      : signatureToId.get(sig);
    if (existingId) {
      const existing = edgeById.get(existingId);
      if (existing) {
        edgeById.set(existingId, {
          data: {
            ...existing.data,
            ...edge.data,
            id: existing.data.id,
          },
        });
      }
    } else {
      edgeById.set(edge.data.id, edge);
      signatureToId.set(sig, edge.data.id);
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges: Array.from(edgeById.values()),
  };
}

/**
 * Updates the browser URL `?entityId=` query parameter in place without full navigation.
 */
export function syncSearchParamEntityId(entityId: string | null): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const trimmed = entityId?.trim() || null;
  if (trimmed) {
    url.searchParams.set("entityId", trimmed);
  } else {
    url.searchParams.delete("entityId");
  }
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== current) {
    window.history.replaceState(null, "", next);
  }
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

/**
 * Extracts raw items array from heterogeneous explorer search API payloads
 * and resolves consistent display labels via entityLabel utilities.
 */
export function mapExplorerItemsToSuggestions(
  payload: unknown,
  limit = 6,
): { items: SuggestedEntity[]; total: number; facetTypes: string[] } {
  const data =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};
  const rawItems: unknown[] = Array.isArray(data.items)
    ? data.items
    : Array.isArray(data.content)
      ? data.content
      : Array.isArray(data.results)
        ? data.results
        : [];

  const labelable: LabelableEntity[] = rawItems
    .filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === "object" && "id" in item && item.id),
    )
    .slice(0, limit)
    .map((item) => ({
      id: String(item.id),
      canonicalName: String(
        item.canonicalName || item.label || item.name || "",
      ),
      entityType: String(item.entityType || "Entity"),
      properties:
        item.properties && typeof item.properties === "object"
          ? (item.properties as Record<string, unknown>)
          : {},
    }));

  const typeLabelMap = computeEntityTypeLabelFields(labelable);
  const items: SuggestedEntity[] = labelable.map((item) => ({
    id: item.id,
    canonicalName: resolveEntityLabel(item, typeLabelMap),
    entityType: String(item.entityType || "Entity"),
  }));

  const total =
    typeof data.total === "number"
      ? data.total
      : typeof data.totalResults === "number"
        ? data.totalResults
        : items.length;

  const facets =
    data.facets && typeof data.facets === "object"
      ? (data.facets as Record<string, unknown>)
      : null;
  const entityTypeFacets =
    facets?.entityType && typeof facets.entityType === "object"
      ? Object.keys(facets.entityType as Record<string, unknown>)
      : facets
        ? Object.keys(facets).filter((k) => typeof facets[k] === "number")
        : [];

  return { items, total, facetTypes: entityTypeFacets };
}

/**
 * Normalizes backend graph API responses so every node is guaranteed a string label
 * and every edge carries consistent Cytoscape identifiers.
 */
export function normalizeGraphResponse(payload: unknown): GraphResponse {
  const raw =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};
  const rawNodes = Array.isArray(raw.nodes) ? raw.nodes : [];
  const rawEdges = Array.isArray(raw.edges) ? raw.edges : [];

  const nodes: GraphResponse["nodes"] = rawNodes
    .filter((n): n is { data: Record<string, unknown> } =>
      Boolean(
        n &&
        typeof n === "object" &&
        "data" in n &&
        n.data &&
        typeof n.data === "object",
      ),
    )
    .map((n) => {
      const d = n.data;
      const id = String(d.id ?? "");
      return {
        data: {
          id,
          label: String(d.label || d.canonicalName || id),
          entityType:
            typeof d.entityType === "string" ? d.entityType : undefined,
          properties:
            d.properties && typeof d.properties === "object"
              ? (d.properties as Record<string, unknown>)
              : undefined,
          color: typeof d.color === "string" ? d.color : undefined,
        },
      };
    });

  const edges: GraphResponse["edges"] = rawEdges
    .filter((e): e is { data: Record<string, unknown> } =>
      Boolean(
        e &&
        typeof e === "object" &&
        "data" in e &&
        e.data &&
        typeof e.data === "object",
      ),
    )
    .map((e) => {
      const d = e.data;
      const relType =
        typeof d.relationshipType === "string" ? d.relationshipType : undefined;
      return {
        data: {
          id: String(
            d.id ?? `${d.source ?? ""}-${relType ?? "LINK"}-${d.target ?? ""}`,
          ),
          source: String(d.source ?? ""),
          target: String(d.target ?? ""),
          label: typeof d.label === "string" ? d.label : undefined,
          relationshipType: relType,
          weight: typeof d.weight === "number" ? d.weight : undefined,
        },
      };
    });

  return {
    nodes,
    edges,
    centerNodeId:
      typeof raw.centerNodeId === "string" ? raw.centerNodeId : undefined,
    totalNodes:
      typeof raw.totalNodes === "number" ? raw.totalNodes : nodes.length,
    totalEdges:
      typeof raw.totalEdges === "number" ? raw.totalEdges : edges.length,
  };
}
