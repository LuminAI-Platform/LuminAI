import type { SearchResponse, SearchResultItem } from "../types";

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
  const rawItems = (raw.items ?? raw.content) as unknown[] | undefined;
  const items: SearchResultItem[] = (Array.isArray(rawItems) ? rawItems : [])
    .filter(
      (item): item is Record<string, unknown> =>
        item != null && typeof item === "object",
    )
    .map((item) => {
      const id = String(
        item.id || item.entityId || "00000000-0000-0000-0000-000000000000",
      );
      const rawProps =
        item.properties && typeof item.properties === "object"
          ? (item.properties as Record<string, unknown>)
          : {};
      const canonicalName = String(
        item.canonicalName ||
          item.name ||
          rawProps.canonicalName ||
          rawProps.name ||
          rawProps.title ||
          rawProps.full_name ||
          `Entity ${id.slice(0, 8)}`,
      );
      const entityType = String(
        item.entityType ||
          item.type ||
          rawProps.entityType ||
          rawProps.type ||
          "Entity",
      );
      return {
        id,
        canonicalName,
        entityType,
        properties: rawProps,
        createdAt: String(item.createdAt || new Date().toISOString()),
        highlights:
          item.highlights && typeof item.highlights === "object"
            ? (item.highlights as Record<string, string[]>)
            : undefined,
      };
    });

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
