import { apiFetch } from "../../lib/api";
import type {
  CatalogSummary,
  GraphResponse,
  SuggestedEntity,
} from "./graphDataUtils";

export function parseSuggestedEntities(
  data: Record<string, unknown> | null | undefined,
  limit: number,
): SuggestedEntity[] {
  const rawItems = Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.content)
      ? data.content
      : Array.isArray(data?.results)
        ? data.results
        : [];

  return rawItems
    .filter((item: Record<string, unknown>) => Boolean(item?.id))
    .slice(0, limit)
    .map((item: Record<string, unknown>) => ({
      id: String(item.id),
      canonicalName: String(
        item.canonicalName || item.label || item.name || item.id,
      ),
      entityType: String(item.entityType || "Entity"),
    }));
}

export async function fetchCatalogSummary(): Promise<CatalogSummary> {
  const res = await apiFetch("/api/v1/explorer/search?size=5", {
    headers: { "X-Suppress-Toast": "true" },
  });
  const data = await res.json();
  const items = parseSuggestedEntities(data, 5);

  const total =
    typeof data?.total === "number"
      ? data.total
      : typeof data?.totalResults === "number"
        ? data.totalResults
        : items.length;

  const facetTypes =
    data?.facets?.entityType && typeof data.facets.entityType === "object"
      ? Object.keys(data.facets.entityType)
      : data?.facets && typeof data.facets === "object"
        ? Object.keys(data.facets).filter(
            (k) => typeof data.facets[k] === "number",
          )
        : [];

  return { items, total, entityTypes: facetTypes };
}

export async function searchGraphEntities(
  query: string,
  signal?: AbortSignal,
): Promise<SuggestedEntity[]> {
  const res = await apiFetch(
    `/api/v1/explorer/search?query=${encodeURIComponent(query)}&size=6`,
    {
      headers: { "X-Suppress-Toast": "true" },
      signal,
    },
  );
  const data = await res.json();
  return parseSuggestedEntities(data, 6);
}

export async function fetchGraphNeighbourhood(
  activeEntityId: string | null,
  depth: number,
  selectedRelFilter: string | null,
): Promise<GraphResponse> {
  let url = activeEntityId
    ? `/api/v1/graph/neighbourhood?entityId=${encodeURIComponent(activeEntityId)}&depth=${depth}`
    : `/api/v1/graph/overview`;
  if (selectedRelFilter) {
    url +=
      (url.includes("?") ? "&" : "?") +
      `relationshipType=${encodeURIComponent(selectedRelFilter)}`;
  }
  const res = await apiFetch(url, {
    headers: { "X-Suppress-Toast": "true" },
  });
  const payload = await res.json();
  return {
    nodes: Array.isArray(payload?.nodes) ? payload.nodes : [],
    edges: Array.isArray(payload?.edges) ? payload.edges : [],
    centerNodeId: payload?.centerNodeId,
    totalNodes:
      typeof payload?.totalNodes === "number"
        ? payload.totalNodes
        : Array.isArray(payload?.nodes)
          ? payload.nodes.length
          : 0,
    totalEdges:
      typeof payload?.totalEdges === "number"
        ? payload.totalEdges
        : Array.isArray(payload?.edges)
          ? payload.edges.length
          : 0,
  };
}
