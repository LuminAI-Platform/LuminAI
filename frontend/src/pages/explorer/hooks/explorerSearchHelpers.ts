import { apiFetch } from "../../../lib/api";
import type { SortOption } from "../types";
import { parseSearchQuery } from "../utils";

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

export function buildApiFilterParams(
  rawQuery: string,
  types: string[],
): {
  apiQuery: string;
  effectiveTypes: string[];
  duplicates?: boolean;
  missing?: boolean;
  review?: boolean;
} {
  const { text, filters } = parseSearchQuery(rawQuery);
  const effectiveTypes = new Set<string>(types);
  const extraTerms: string[] = [];
  let duplicates: boolean | undefined;
  let missing: boolean | undefined;
  let review: boolean | undefined;

  for (const f of filters) {
    const k = f.key.toLowerCase();
    const vLower = f.value.toLowerCase();
    if (k === "type" || k === "entitytype" || k === "entity_type") {
      effectiveTypes.add(f.value);
    } else if (k === "duplicates" && vLower === "true") {
      duplicates = true;
    } else if (k === "missing" && vLower === "true") {
      missing = true;
    } else if (k === "review" && vLower === "true") {
      review = true;
    } else {
      extraTerms.push(f.raw);
    }
  }

  const apiQuery = [text, ...extraTerms].filter(Boolean).join(" ").trim();
  return {
    apiQuery,
    effectiveTypes: Array.from(effectiveTypes),
    duplicates,
    missing,
    review,
  };
}

export async function exportEntitiesCsv(
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
