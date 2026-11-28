import { useMemo } from "react";
import type { SearchResponse, SearchResultItem } from "../types";
import { resolveEntityLabel, type TypeLabelFieldMap } from "../utils";

export function useExplorerDerivedStats(
  searchData: SearchResponse | null,
  parsedKeyword: string,
  typeLabelFields?: TypeLabelFieldMap,
) {
  const suggestions = useMemo(() => {
    const keyword = parsedKeyword.toLowerCase().trim();
    if (!keyword || !searchData?.content) return [];
    const matches = searchData.content
      .filter((item): item is SearchResultItem => Boolean(item && item.id))
      .map((item) => resolveEntityLabel(item, typeLabelFields))
      .filter(
        (label) =>
          typeof label === "string" && label.toLowerCase().includes(keyword),
      )
      .slice(0, 5);
    return Array.from(new Set(matches));
  }, [parsedKeyword, searchData, typeLabelFields]);

  const mostRecentUpdate = useMemo(() => {
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
  }, [searchData]);

  const activeTypeCount = useMemo(() => {
    const facets = searchData?.facets;
    if (!facets) return 0;
    return Object.values(facets).filter((count) => count > 0).length;
  }, [searchData]);

  const hasConfidenceData = useMemo(() => {
    if (!searchData?.content?.length) return false;
    return searchData.content.some(
      (item) =>
        typeof item.sourceCount === "number" &&
        item.sourceCount >= 2 &&
        typeof item.confidenceScore === "number",
    );
  }, [searchData]);

  return {
    suggestions,
    mostRecentUpdate,
    activeTypeCount,
    hasConfidenceData,
  };
}
