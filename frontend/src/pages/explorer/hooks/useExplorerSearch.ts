import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { EntityType } from "../../../features/ontology/types";
import type {
  ParsedQueryFilter,
  SearchResponse,
  SortOption,
  UseExplorerSearchOptions,
  UseExplorerSearchResult,
} from "../types";
import { DEFAULT_PAGE_SIZE, DEFAULT_DEBOUNCE_MS } from "../constants";
import { parseSearchQuery, removeFilterFromQuery } from "../utils";
import {
  deriveActiveTypeCount,
  deriveHasConfidenceData,
  deriveMostRecentUpdate,
  deriveSuggestions,
  exportExplorerCsv,
  fetchExplorerSearch,
  fetchOntologyEntityTypes,
  getInitialUrlParam,
  syncSearchParamsToUrl,
} from "./explorerSearchHelpers";

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

  const initialQuery = getInitialUrlParam("query") || "";
  const initialPage = Number(getInitialUrlParam("page") || 0);

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

  // 1. Fetch Ontology Entity Types on mount
  useEffect(() => {
    let isMounted = true;
    fetchOntologyEntityTypes()
      .then((types) => {
        if (isMounted) setOntologyTypes(types);
      })
      .catch((err) => {
        console.warn("Ontology fetch failed:", err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Debounce input query changes
  useEffect(() => {
    if (inputValue === query) return;
    const timer = setTimeout(() => {
      setQuery(inputValue);
      setPage(0);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [inputValue, query, debounceMs]);

  // 3. Search fetch execution with in-flight abort
  const executeSearch = useCallback(
    async (
      searchQuery: string,
      types: string[],
      pageNum: number,
      size: number,
      sort: SortOption,
    ) => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setLoading(true);
      setError(null);
      setErrorDetails(null);
      syncSearchParamsToUrl(searchQuery, pageNum);

      try {
        const normalized = await fetchExplorerSearch(
          searchQuery,
          types,
          pageNum,
          size,
          sort,
          controller.signal,
        );
        setSearchData(normalized);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
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

  // 4. Auto-trigger search when query, selectedTypes, page, pageSize, or sort changes
  useEffect(() => {
    void executeSearch(query, selectedTypes, page, pageSize, sortOption);
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [query, selectedTypes, page, pageSize, sortOption, executeSearch]);

  const suggestions = useMemo(
    () => deriveSuggestions(parsedInput.text, searchData),
    [parsedInput.text, searchData],
  );
  const mostRecentUpdate = useMemo(
    () => deriveMostRecentUpdate(searchData),
    [searchData],
  );
  const activeTypeCount = useMemo(
    () => deriveActiveTypeCount(searchData),
    [searchData],
  );
  const hasConfidenceData = useMemo(
    () => deriveHasConfidenceData(searchData),
    [searchData],
  );

  const handleExportCsv = useCallback(async () => {
    setIsExporting(true);
    try {
      await exportExplorerCsv(query, selectedTypes);
    } catch (err) {
      console.error("Export clean CSV error:", err);
    } finally {
      setIsExporting(false);
    }
  }, [query, selectedTypes]);

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
    parsedFilters: parsedInput.filters,
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
