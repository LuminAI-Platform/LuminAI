import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { apiFetch } from "../../../lib/api";
import type { EntityType } from "../../../features/ontology/types";
import type {
  SearchResponse,
  UseExplorerSearchOptions,
  UseExplorerSearchResult,
} from "../types";
import { DEFAULT_PAGE_SIZE, DEFAULT_DEBOUNCE_MS } from "../constants";
import { normalizeSearchResponse } from "../utils";

/**
 * Custom React hook grouping search query state, pagination, facet filtering,
 * input debouncing, abortable network requests, and CSV export side effects.
 */
export function useExplorerSearch(
  options: UseExplorerSearchOptions = {},
): UseExplorerSearchResult {
  const { pageSize = DEFAULT_PAGE_SIZE, debounceMs = DEFAULT_DEBOUNCE_MS } =
    options;

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
  const [page, setPage] = useState(Number.isNaN(initialPage) ? 0 : initialPage);

  const [ontologyTypes, setOntologyTypes] = useState<EntityType[]>([]);
  const [searchData, setSearchData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  // 1. Fetch Ontology Entity Types on mount
  useEffect(() => {
    let isMounted = true;
    const fetchOntology = async () => {
      try {
        const res = await apiFetch("/api/v1/ontology/entity-types");
        if (res.ok && isMounted) {
          const data = await res.json();
          setOntologyTypes(data);
        }
      } catch (err) {
        console.warn("Ontology fetch failed:", err);
      }
    };
    fetchOntology();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Debounce input query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(inputValue);
      setPage(0); // Reset to page 0 on new query
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [inputValue, debounceMs]);

  // 3. Search fetch execution with in-flight abort
  const executeSearch = useCallback(
    async (searchQuery: string, types: string[], pageNum: number) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setLoading(true);
      setError(null);

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
        const params = new URLSearchParams();
        params.set("query", searchQuery);
        params.set("page", pageNum.toString());
        params.set("size", pageSize.toString());

        types.forEach((t) => params.append("entityType", t));

        const res = await apiFetch(
          `/api/v1/explorer/search?${params.toString()}`,
          {
            signal: controller.signal,
            headers: { "X-Suppress-Toast": "true" },
          },
        );
        if (!res.ok) {
          throw new Error(`Search failed: ${res.statusText}`);
        }
        const raw = (await res.json()) as Record<string, unknown>;
        const normalized = normalizeSearchResponse(raw, pageSize, pageNum);
        setSearchData(normalized);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        console.error("Search error:", err);
        setError("Failed to execute search. Please try again.");
      } finally {
        if (abortControllerRef.current === controller) {
          setLoading(false);
        }
      }
    },
    [pageSize],
  );

  // 4. Auto-trigger search when query, selectedTypes, or page changes
  useEffect(() => {
    executeSearch(query, selectedTypes, page);
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query, selectedTypes, page, executeSearch]);

  // 5. Autocomplete suggestions derived from search response
  const suggestions = useMemo(() => {
    if (!inputValue.trim() || !searchData) return [];
    const val = inputValue.toLowerCase().trim();
    const matches = searchData.content
      .map((item) => item.canonicalName)
      .filter((name) => name.toLowerCase().includes(val))
      .slice(0, 5);
    return Array.from(new Set(matches));
  }, [inputValue, searchData]);

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("query", query.trim());
      if (selectedTypes.length > 0) params.set("entityType", selectedTypes[0]);

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
    } catch (err) {
      console.error("Export clean CSV error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const retrySearch = useCallback(() => {
    executeSearch(query, selectedTypes, page);
  }, [executeSearch, query, selectedTypes, page]);

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

  return {
    inputValue,
    setInputValue,
    query,
    selectedTypes,
    setSelectedTypes: handleSelectedTypesChange,
    page,
    setPage,
    pageSize,
    ontologyTypes,
    searchData,
    facets: searchData?.facets || {},
    loading,
    error,
    suggestions,
    isExporting,
    handleExportCsv,
    executeSearch,
    retrySearch,
    handleSearchSubmit,
    handleSelectSuggestion,
  };
}
