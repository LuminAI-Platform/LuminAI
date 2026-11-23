import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { apiFetch } from "../../../lib/api";
import type { EntityType } from "../../../features/ontology/types";
import type {
  ParsedQueryFilter,
  SearchResponse,
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
import {
  mapSortToApiParams,
  buildApiFilterParams,
  exportEntitiesCsv,
} from "./explorerSearchHelpers";
import { useExplorerDerivedStats } from "./useExplorerDerivedStats";

export { mapSortToApiParams, buildApiFilterParams, exportEntitiesCsv };

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

  const parsedInput = useMemo(() => parseSearchQuery(inputValue), [inputValue]);
  const parsedFilters = parsedInput.filters;

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

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(inputValue);
      setPage(0);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [inputValue, debounceMs]);

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
    [],
  );

  useEffect(() => {
    void executeSearch(query, selectedTypes, page, pageSize, sortOption);
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query, selectedTypes, page, pageSize, sortOption, executeSearch]);

  const { suggestions, mostRecentUpdate, activeTypeCount, hasConfidenceData } =
    useExplorerDerivedStats(searchData, parsedInput.text);

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      await exportEntitiesCsv(query, selectedTypes);
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
    setSelectedTypes: (types: string[]) => {
      setSelectedTypes(types);
      setPage(0);
    },
    sortOption,
    setSortOption: (sort: SortOption) => {
      setSortOptionState(sort);
      setPage(0);
    },
    page,
    setPage,
    pageSize,
    setPageSize: (size: number) => {
      setPageSizeState(size);
      setPage(0);
    },
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
