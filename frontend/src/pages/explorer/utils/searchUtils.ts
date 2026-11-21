import type {
  ParsedQueryFilter,
  SearchResponse,
  SearchResultItem,
} from "../types";
import {
  normalizeSearchResultItem,
  parseExplorerInsights,
} from "./searchResponseNormalizer";

/**
 * Extracts all facet groups returned by the search API.
 * Preserves nested groups (e.g. `entityTypes`, `sourceSystems`) without fabricating missing ones.
 */
export function normalizeFacetGroups(
  rawFacets: Record<string, unknown>,
): Record<string, Record<string, number>> {
  const groups: Record<string, Record<string, number>> = {};

  for (const [key, val] of Object.entries(rawFacets)) {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const groupMap: Record<string, number> = {};
      for (const [entryKey, entryVal] of Object.entries(
        val as Record<string, unknown>,
      )) {
        if (typeof entryVal === "number" && Number.isFinite(entryVal)) {
          groupMap[entryKey] = entryVal;
        }
      }
      groups[key] = groupMap;
    } else if (typeof val === "number" && Number.isFinite(val)) {
      if (!groups.entityTypes) groups.entityTypes = {};
      groups.entityTypes[key] = val;
    }
  }

  return groups;
}

function flattenFacetGroups(
  groups: Record<string, Record<string, number>>,
): Record<string, number> {
  if (groups.entityTypes) return groups.entityTypes;
  if (groups.entityType) return groups.entityType;

  const flat: Record<string, number> = {};
  for (const group of Object.values(groups)) {
    Object.assign(flat, group);
  }
  return flat;
}

/**
 * Flattens the entity-type facet map from the search API into a flat
 * Record<string, number> keyed by entity type name.
 */
export function normalizeFacets(
  rawFacets: Record<string, unknown>,
): Record<string, number> {
  return flattenFacetGroups(normalizeFacetGroups(rawFacets));
}

/**
 * Parses `field:value` and `field:"multi word"` filter tokens from a search query.
 * Returns the remaining free-text query and the list of structured filters.
 */
export function parseSearchQuery(input: string): {
  text: string;
  filters: ParsedQueryFilter[];
} {
  const filters: ParsedQueryFilter[] = [];
  const tokenRegex = /([A-Za-z_][A-Za-z0-9_.-]*):(?:"([^"]+)"|(\S+))/g;

  const remaining = input
    .replace(tokenRegex, (raw, key: string, quoted?: string, bare?: string) => {
      const value = (quoted ?? bare ?? "").trim();
      if (value) {
        filters.push({ key, value, raw });
      }
      return " ";
    })
    .replace(/\s+/g, " ")
    .trim();

  return { text: remaining, filters };
}

/**
 * Removes a single parsed filter token from the raw search bar string.
 */
export function removeFilterFromQuery(
  input: string,
  filterToRemove: ParsedQueryFilter,
): string {
  const idx = input.indexOf(filterToRemove.raw);
  if (idx === -1) return input;
  const before = input.slice(0, idx);
  const after = input.slice(idx + filterToRemove.raw.length);
  return `${before} ${after}`.replace(/\s+/g, " ").trim();
}

/**
 * Normalizes a raw search API response object into the canonical SearchResponse shape.
 * Strictly preserves only fields actually returned by the API — never fabricates
 * confidence scores, source counts, duplicates, or insights.
 */
export function normalizeSearchResponse(
  raw: Record<string, unknown>,
  pageSize: number,
  pageNum: number,
): SearchResponse {
  const rawItems = (raw.items ?? raw.content) as unknown[] | undefined;
  const items: SearchResultItem[] = (Array.isArray(rawItems) ? rawItems : [])
    .filter(
      (item): item is Record<string, unknown> =>
        item != null && typeof item === "object",
    )
    .map(normalizeSearchResultItem);

  const rawTotal = (raw.total ?? raw.totalElements) as number | undefined;
  const totalElements =
    typeof rawTotal === "number" && Number.isFinite(rawTotal)
      ? rawTotal
      : items.length;

  const rawPages = raw.totalPages as number | undefined;
  const totalPages =
    typeof rawPages === "number" && Number.isFinite(rawPages)
      ? rawPages
      : Math.max(1, Math.ceil(totalElements / Math.max(1, pageSize)));

  const rawSize = raw.size as number | undefined;
  const size =
    typeof rawSize === "number" && Number.isFinite(rawSize)
      ? rawSize
      : pageSize;

  const rawNum = (raw.page ?? raw.number) as number | undefined;
  const number =
    typeof rawNum === "number" && Number.isFinite(rawNum) ? rawNum : pageNum;

  const rawFacets = raw.facets;
  const facetGroups =
    rawFacets && typeof rawFacets === "object"
      ? normalizeFacetGroups(rawFacets as Record<string, unknown>)
      : {};
  const facets =
    rawFacets && typeof rawFacets === "object"
      ? flattenFacetGroups(facetGroups)
      : {};

  const insights = parseExplorerInsights(raw.insights);

  return {
    content: items,
    facets,
    facetGroups,
    totalElements,
    totalPages,
    size,
    number,
    insights,
  };
}
