import type { SearchResponse } from "../types";

/**
 * Flattens nested facet structures from the search API into a flat
 * Record<string, number> keyed by entity type name.
 */
export function normalizeFacets(
  rawFacets: Record<string, unknown>,
): Record<string, number> {
  const flat: Record<string, number> = {};

  if (rawFacets.entityType && typeof rawFacets.entityType === "object") {
    Object.assign(flat, rawFacets.entityType as Record<string, number>);
  } else {
    for (const [k, v] of Object.entries(rawFacets)) {
      if (typeof v === "number") {
        flat[k] = v;
      } else if (typeof v === "object" && v !== null) {
        Object.assign(flat, v);
      }
    }
  }

  return flat;
}

/**
 * Normalizes a raw search API response object into the canonical
 * SearchResponse shape, filling in defaults where fields may be missing.
 */
export function normalizeSearchResponse(
  raw: Record<string, unknown>,
  pageSize: number,
  pageNum: number,
): SearchResponse {
  const rawItems = (raw.items ?? raw.content) as
    | SearchResponse["content"]
    | undefined;
  const items = rawItems ?? [];

  const rawTotal = (raw.total ?? raw.totalElements) as number | undefined;
  const totalElements = rawTotal ?? items.length;

  const rawPages = raw.totalPages as number | undefined;
  const totalPages =
    rawPages ?? Math.max(1, Math.ceil(totalElements / pageSize));

  const rawSize = raw.size as number | undefined;
  const size = rawSize ?? pageSize;

  const rawNum = (raw.page ?? raw.number) as number | undefined;
  const number = rawNum ?? pageNum;

  const rawFacets = raw.facets;
  const facets =
    rawFacets && typeof rawFacets === "object"
      ? normalizeFacets(rawFacets as Record<string, unknown>)
      : {};

  return { content: items, facets, totalElements, totalPages, size, number };
}
