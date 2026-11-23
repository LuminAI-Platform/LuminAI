import type {
  ExplorerInsightCounts,
  MatchReason,
  ParsedQueryFilter,
  PossibleDuplicateRef,
  SearchResponse,
  SearchResultItem,
} from "../types";

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

/**
 * Flattens the entity-type facet map from the search API into a flat
 * Record<string, number> keyed by entity type name.
 */
export function normalizeFacets(
  rawFacets: Record<string, unknown>,
): Record<string, number> {
  const groups = normalizeFacetGroups(rawFacets);
  if (groups.entityTypes) return groups.entityTypes;
  if (groups.entityType) return groups.entityType;

  const flat: Record<string, number> = {};
  for (const group of Object.values(groups)) {
    Object.assign(flat, group);
  }
  return flat;
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
    .map((item, idx) => {
      const id = String(item.id || item.entityId || `entity-${idx}`);
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

      const confidenceScore =
        typeof item.confidenceScore === "number" &&
        Number.isFinite(item.confidenceScore)
          ? item.confidenceScore
          : undefined;

      const sourceCount =
        typeof item.sourceCount === "number" &&
        Number.isFinite(item.sourceCount)
          ? item.sourceCount
          : undefined;

      const sourceSystems = Array.isArray(item.sourceSystems)
        ? item.sourceSystems.map((s) => String(s).trim()).filter(Boolean)
        : undefined;

      const createdAt =
        typeof item.createdAt === "string" && item.createdAt.trim()
          ? item.createdAt
          : undefined;

      const updatedAt =
        typeof item.updatedAt === "string" && item.updatedAt.trim()
          ? item.updatedAt
          : undefined;

      const matchReasons = Array.isArray(item.matchReasons)
        ? (item.matchReasons as MatchReason[])
        : undefined;

      let possibleDuplicate: PossibleDuplicateRef | null | undefined;
      if (
        item.possibleDuplicate &&
        typeof item.possibleDuplicate === "object"
      ) {
        const dup = item.possibleDuplicate as Record<string, unknown>;
        const dupName = String(dup.canonicalName || dup.name || "").trim();
        if (dupName) {
          possibleDuplicate = {
            id: dup.id ? String(dup.id) : undefined,
            name: dupName,
            candidateId: dup.candidateId ? String(dup.candidateId) : undefined,
          };
        }
      }

      const needsReview =
        typeof item.needsReview === "boolean" ? item.needsReview : undefined;

      return {
        id,
        canonicalName,
        entityType,
        properties: rawProps,
        createdAt,
        updatedAt,
        confidenceScore,
        sourceCount,
        sourceSystems,
        highlights:
          item.highlights && typeof item.highlights === "object"
            ? (item.highlights as Record<string, string[]>)
            : undefined,
        matchReasons,
        possibleDuplicate,
        needsReview,
      };
    });

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
      ? normalizeFacets(rawFacets as Record<string, unknown>)
      : {};

  let insights: ExplorerInsightCounts | undefined;
  if (raw.insights && typeof raw.insights === "object") {
    const rawIns = raw.insights as Record<string, unknown>;
    const parsed: ExplorerInsightCounts = {};
    if (typeof rawIns.possibleDuplicates === "number") {
      parsed.possibleDuplicates = rawIns.possibleDuplicates;
    }
    if (typeof rawIns.missingValues === "number") {
      parsed.missingValues = rawIns.missingValues;
    }
    if (typeof rawIns.needsReview === "number") {
      parsed.needsReview = rawIns.needsReview;
    }
    if (Object.keys(parsed).length > 0) {
      insights = parsed;
    }
  }

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
