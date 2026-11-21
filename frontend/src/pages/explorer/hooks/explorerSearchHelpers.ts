import { apiFetch } from "../../../lib/api";
import type { EntityType } from "../../../features/ontology/types";
import type { SearchResponse, SearchResultItem, SortOption } from "../types";
import { normalizeSearchResponse, parseSearchQuery } from "../utils";

export function mapSortToApiParams(sort: SortOption): {
  sortBy: string;
  sortDirection: "ASC" | "DESC";
} {
  switch (sort) {
    case "name_asc":
      return { sortBy: "canonicalName", sortDirection: "ASC" };
    case "name_desc":
      return { sortBy: "canonicalName", sortDirection: "DESC" };
    case "confidence_desc":
      return { sortBy: "confidenceScore", sortDirection: "DESC" };
    case "newest":
    default:
      return { sortBy: "createdAt", sortDirection: "DESC" };
  }
}

export function getInitialUrlParam(key: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(key);
}

export function syncSearchParamsToUrl(
  searchQuery: string,
  pageNum: number,
): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (searchQuery) url.searchParams.set("query", searchQuery);
  else url.searchParams.delete("query");
  if (pageNum > 0) url.searchParams.set("page", pageNum.toString());
  else url.searchParams.delete("page");
  window.history.replaceState(null, "", url.toString());
}

/**
 * Resolves effective API query & entityTypes from raw search input + sidebar types.
 */
export function buildApiFilterParams(
  rawQuery: string,
  types: string[],
): { apiQuery: string; effectiveTypes: string[] } {
  const { text, filters } = parseSearchQuery(rawQuery);
  const effectiveTypes = new Set<string>(types);
  const extraTerms: string[] = [];

  for (const f of filters) {
    const k = f.key.toLowerCase();
    if (k === "type" || k === "entitytype" || k === "entity_type") {
      effectiveTypes.add(f.value);
    } else {
      extraTerms.push(f.value);
    }
  }

  const apiQuery = [text, ...extraTerms].filter(Boolean).join(" ").trim();
  return { apiQuery, effectiveTypes: Array.from(effectiveTypes) };
}

export function buildSearchRequestUrl(
  searchQuery: string,
  types: string[],
  pageNum: number,
  size: number,
  sort: SortOption,
): string {
  const { apiQuery, effectiveTypes } = buildApiFilterParams(searchQuery, types);
  const { sortBy, sortDirection } = mapSortToApiParams(sort);

  const params = new URLSearchParams();
  params.set("query", apiQuery);
  params.set("page", pageNum.toString());
  params.set("size", size.toString());
  params.set("sortBy", sortBy);
  params.set("sortDirection", sortDirection);
  effectiveTypes.forEach((t) => params.append("entityType", t));

  return `/api/v1/explorer/search?${params.toString()}`;
}

export async function fetchOntologyEntityTypes(): Promise<EntityType[]> {
  const res = await apiFetch("/api/v1/ontology/entity-types", {
    headers: { "X-Suppress-Toast": "true" },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchExplorerSearch(
  searchQuery: string,
  types: string[],
  pageNum: number,
  size: number,
  sort: SortOption,
  signal: AbortSignal,
): Promise<SearchResponse> {
  const res = await apiFetch(
    buildSearchRequestUrl(searchQuery, types, pageNum, size, sort),
    {
      signal,
      headers: { "X-Suppress-Toast": "true" },
    },
  );
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  const raw = (await res.json()) as Record<string, unknown>;
  const normalized = normalizeSearchResponse(raw, size, pageNum);

  if (sort === "confidence_desc") {
    normalized.content = [...normalized.content].sort(
      (a, b) => (b.confidenceScore ?? -1) - (a.confidenceScore ?? -1),
    );
  }
  return normalized;
}

export function deriveSuggestions(
  keyword: string,
  searchData: SearchResponse | null,
): string[] {
  const normalized = keyword.toLowerCase().trim();
  if (!normalized || !searchData?.content) return [];
  const matches = searchData.content
    .filter((item): item is SearchResultItem =>
      Boolean(item && item.canonicalName),
    )
    .map((item) => item.canonicalName)
    .filter(
      (name) =>
        typeof name === "string" && name.toLowerCase().includes(normalized),
    )
    .slice(0, 5);
  return Array.from(new Set(matches));
}

export function deriveMostRecentUpdate(
  searchData: SearchResponse | null,
): string | null {
  if (!searchData?.content?.length) return null;
  let latestMs = -Infinity;
  let latestIso: string | null = null;
  for (const item of searchData.content) {
    const candidate = item.updatedAt || item.createdAt;
    if (!candidate) continue;
    const ms = Date.parse(candidate);
    if (!Number.isNaN(ms) && ms > latestMs) {
      latestMs = ms;
      latestIso = candidate;
    }
  }
  return latestIso;
}

export function deriveActiveTypeCount(
  searchData: SearchResponse | null,
): number {
  const facets = searchData?.facets;
  if (!facets) return 0;
  return Object.values(facets).filter((count) => count > 0).length;
}

export function deriveHasConfidenceData(
  searchData: SearchResponse | null,
): boolean {
  if (!searchData?.content?.length) return false;
  return searchData.content.some(
    (item) => typeof item.confidenceScore === "number",
  );
}

export async function exportExplorerCsv(
  query: string,
  selectedTypes: string[],
): Promise<void> {
  const { apiQuery, effectiveTypes } = buildApiFilterParams(
    query,
    selectedTypes,
  );
  const params = new URLSearchParams();
  if (apiQuery) params.set("query", apiQuery);
  effectiveTypes.forEach((t) => params.append("entityType", t));

  const res = await apiFetch(
    `/api/v1/explorer/export/csv?${params.toString()}`,
  );

  if (!res.ok) {
    throw new Error(`Export failed: ${res.statusText}`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", "luminai-golden-records.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
