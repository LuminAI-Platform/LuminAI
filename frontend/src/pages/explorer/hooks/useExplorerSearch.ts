import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { apiFetch } from "../../../lib/api";
import type { EntityType } from "../../../features/ontology/types";
import type {
  ParsedQueryFilter,
  SearchResponse,
  SearchResultItem,
  SortOption,
  UseExplorerSearchOptions,
  UseExplorerSearchResult,
} from "../types";
import { DEFAULT_PAGE_SIZE, DEFAULT_DEBOUNCE_MS } from "../constants";
import {
  normalizeSearchResponse,
  parseSearchQuery,
  removeFilterFromQuery,
} from "../utils";

function mapSortToApiParams(sort: SortOption): {
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

/**
 * Custom React hook grouping search query state, field:value filter parsing,
 * sorting, pagination, facet filtering, input debouncing, abortable network
 * requests, and CSV export side effects.
 */
export function useExplorerSearch(
  options: UseExplorerSearchOptions = {},
): UseExplorerSearchResult {
  const {
    initialPageSize = DEFAULT_PAGE_SIZE,
    debounceMs = DEFAULT_DEBOUNCE_MS,
  } = options;

  const getInitialParam = (key: string) => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      return sp.get(key);
    }
    return null;
  };

  const initialQuery = getInitialParam("query") || "";
  const initialPage = Number(getInitialParam("page") || 0);

  const [inputValue, setInputValue] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [sortOption, setSortOptionState] = useState<SortOption>("newest");
  const [page, setPage] = useState(Number.isNaN(initialPage) ? 0 : initialPage);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const [ontologyTypes, setOntologyTypes] = useState<EntityType[]>([]);
  const [searchData, setSearchData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Parsed `field:value` filters from current input
  const parsedInput = useMemo(() => parseSearchQuery(inputValue), [inputValue]);
  const parsedFilters = parsedInput.filters;

  // 1. Fetch Ontology Entity Types on mount
  useEffect(() => {
    let isMounted = true;
    const fetchOntology = async () => {
      try {
        const res = await apiFetch("/api/v1/ontology/entity-types", {
          headers: { "X-Suppress-Toast": "true" },
        });
        if (res.ok && isMounted) {
          const data = await res.json();
          setOntologyTypes(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.warn("Ontology fetch failed:", err);
      }
    };
    void fetchOntology();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Debounce input query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(inputValue);
      setPage(0);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [inputValue, debounceMs]);

  // Helper to resolve effective API query & entityTypes from raw input + sidebar types
  const buildApiFilterParams = useCallback(
    (rawQuery: string, types: string[]) => {
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
    },
    [],
  );

  // 3. Search fetch execution with in-flight abort
  const executeSearch = useCallback(
    async (
      searchQuery: string,
      types: string[],
      pageNum: number,
      size: number,
      sort: SortOption,
    ) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setLoading(true);
      setError(null);
      setErrorDetails(null);

      // Synchronize query and page state to browser URL
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        if (searchQuery) url.searchParams.set("query", searchQuery);
        else url.searchParams.delete("query");
        if (pageNum > 0) url.searchParams.set("page", pageNum.toString());
        else url.searchParams.delete("page");
        window.history.replaceState(null, "", url.toString());
      }

      try {
        const { apiQuery, effectiveTypes } = buildApiFilterParams(
          searchQuery,
          types,
        );
        const { sortBy, sortDirection } = mapSortToApiParams(sort);

        const params = new URLSearchParams();
        params.set("query", apiQuery);
        params.set("page", pageNum.toString());
        params.set("size", size.toString());
        params.set("sortBy", sortBy);
        params.set("sortDirection", sortDirection);

        effectiveTypes.forEach((t) => params.append("entityType", t));

        const res = await apiFetch(
          `/api/v1/explorer/search?${params.toString()}`,
          {
            signal: controller.signal,
            headers: { "X-Suppress-Toast": "true" },
          },
        );
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }
        const raw = (await res.json()) as Record<string, unknown>;
        const normalized = normalizeSearchResponse(raw, size, pageNum);

        // If user selected confidence sort and API returned confidenceScore values,
        // ensure visible page order reflects confidence descending (backend currently
        // falls back to createdAt for sortBy=confidenceScore).
        if (sort === "confidence_desc") {
          normalized.content = [...normalized.content].sort(
            (a, b) => (b.confidenceScore ?? -1) - (a.confidenceScore ?? -1),
          );
        }

        setSearchData(normalized);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        const detail =
          err instanceof Error ? err.message : "Unknown network error";
        console.error("Search error:", err);
        setError("Couldn't load entities");
        setErrorDetails(detail);
      } finally {
        if (abortControllerRef.current === controller) {
          setLoading(false);
        }
      }
    },
    [buildApiFilterParams],
  );

  // 4. Auto-trigger search when query, selectedTypes, page, pageSize, or sort changes
  useEffect(() => {
    void executeSearch(query, selectedTypes, page, pageSize, sortOption);
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query, selectedTypes, page, pageSize, sortOption, executeSearch]);

  // 5. Autocomplete suggestions derived from returned entity names
  const suggestions = useMemo(() => {
    const keyword = parsedInput.text.toLowerCase().trim();
    if (!keyword || !searchData?.content) return [];
    const matches = searchData.content
      .filter((item): item is SearchResultItem =>
        Boolean(item && item.canonicalName),
      )
      .map((item) => item.canonicalName)
      .filter(
        (name) =>
          typeof name === "string" && name.toLowerCase().includes(keyword),
      )
      .slice(0, 5);
    return Array.from(new Set(matches));
  }, [parsedInput.text, searchData]);

  // Derived metadata strictly from API response values
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
      (item) => typeof item.confidenceScore === "number",
    );
  }, [searchData]);

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
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
    } catch (err) {
      console.error("Export clean CSV error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const retrySearch = useCallback(() => {
    void executeSearch(query, selectedTypes, page, pageSize, sortOption);
  }, [executeSearch, query, selectedTypes, page, pageSize, sortOption]);

  const handleSearchSubmit = useCallback(() => {
    setQuery(inputValue);
    setPage(0);
  }, [inputValue]);

  const handleSelectSuggestion = useCallback((val: string) => {
    setInputValue(val);
    setQuery(val);
    setPage(0);
  }, []);

  const handleSelectedTypesChange = useCallback((types: string[]) => {
    setSelectedTypes(types);
    setPage(0);
  }, []);

  const handleSortChange = useCallback((sort: SortOption) => {
    setSortOptionState(sort);
    setPage(0);
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSizeState(size);
    setPage(0);
  }, []);

  const removeFilterChip = useCallback((filter: ParsedQueryFilter) => {
    setInputValue((prev) => {
      const updated = removeFilterFromQuery(prev, filter);
      setQuery(updated);
      setPage(0);
      return updated;
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setInputValue("");
    setQuery("");
    setSelectedTypes([]);
    setPage(0);
  }, []);

  return {
    inputValue,
    setInputValue,
    query,
    parsedFilters,
    removeFilterChip,
    selectedTypes,
    setSelectedTypes: handleSelectedTypesChange,
    sortOption,
    setSortOption: handleSortChange,
    page,
    setPage,
    pageSize,
    setPageSize: handlePageSizeChange,
    ontologyTypes,
    searchData,
    facets: searchData?.facets || {},
    facetGroups: searchData?.facetGroups || {},
    loading,
    error,
    errorDetails,
    suggestions,
    isExporting,
    mostRecentUpdate,
    activeTypeCount,
    hasConfidenceData,
    handleExportCsv,
    executeSearch,
    retrySearch,
    handleSearchSubmit,
    handleSelectSuggestion,
    clearAllFilters,
  };
}
