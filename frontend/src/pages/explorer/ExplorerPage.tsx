import React, { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "../../lib/api";
import { SearchBar } from "../../features/explorer/components/SearchBar";
import { EntityCard } from "../../features/explorer/components/EntityCard";
import { FacetFilterSidebar } from "../../features/explorer/components/FacetFilterSidebar";
import { HelpCircle, RefreshCw, Layers, Download } from "lucide-react";
import type { EntityType } from "../../features/ontology/components/EntityTypeEditor";
import { FoundryPageHeader } from "../../components/layout/FoundryPageHeader";

interface SearchResponse {
  content: Array<{
    id: string;
    canonicalName: string;
    entityType: string;
    properties: Record<string, unknown>;
    createdAt: string;
    highlights?: Record<string, string[]>;
  }>;
  facets: Record<string, number>;
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

const FALLBACK_ONTOLOGY_TYPES: EntityType[] = [
  {
    id: "1",
    name: "Person",
    label: "Person",
    color: "#60a5fa",
    icon: "user",
    description: "",
    properties: [],
  },
  {
    id: "2",
    name: "Organization",
    label: "Organization",
    color: "#34d399",
    icon: "briefcase",
    description: "",
    properties: [],
  },
  {
    id: "3",
    name: "Dataset",
    label: "Dataset",
    color: "#fb923c",
    icon: "database",
    description: "",
    properties: [],
  },
  {
    id: "4",
    name: "Device",
    label: "Device",
    color: "#a78bfa",
    icon: "cpu",
    description: "",
    properties: [],
  },
  {
    id: "5",
    name: "Location",
    label: "Location",
    color: "#f43f5e",
    icon: "map-pin",
    description: "",
    properties: [],
  },
];

export const ExplorerPage: React.FC = () => {
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
  const pageSize = 6; // Compact grid sizing

  const [ontologyTypes, setOntologyTypes] = useState<EntityType[]>([]);
  const [searchData, setSearchData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("query", query.trim());
      if (selectedTypes.length > 0) params.set("entityType", selectedTypes[0]);

      const res = await fetch(
        `/api/v1/explorer/export/csv?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
          },
        },
      );

      if (!res.ok) {
        // Fallback: client-side export from current searchData if backend endpoint fails
        if (searchData && searchData.content && searchData.content.length > 0) {
          const rows = searchData.content.map((item) => ({
            id: item.id,
            canonicalName: item.canonicalName,
            entityType: item.entityType,
            createdAt: item.createdAt,
            ...item.properties,
          }));
          const headers = Array.from(
            new Set(rows.flatMap((r) => Object.keys(r))),
          );
          const csvLines = [headers.join(",")];
          rows.forEach((r) => {
            csvLines.push(
              headers
                .map(
                  (h) =>
                    `"${String(r[h as keyof typeof r] ?? "").replace(/"/g, '""')}"`,
                )
                .join(","),
            );
          });
          const blob = new Blob([csvLines.join("\r\n")], {
            type: "text/csv;charset=utf-8;",
          });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.setAttribute("download", "luminai-golden-records.csv");
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          return;
        }
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

  // 1. Fetch Ontology Entity Types
  useEffect(() => {
    const fetchOntology = async () => {
      try {
        const res = await apiFetch("/api/v1/ontology/entity-types");
        if (res.ok) {
          const data = await res.json();
          setOntologyTypes(data);
        } else {
          setOntologyTypes(FALLBACK_ONTOLOGY_TYPES);
        }
      } catch (err) {
        console.warn("Ontology fetch failed, using default types:", err);
        setOntologyTypes(FALLBACK_ONTOLOGY_TYPES);
      }
    };
    fetchOntology();
  }, []);

  // 2. Debounce input query change for instant search
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(inputValue);
      setPage(0); // Reset to page 0 on new query
    }, 250);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // 3. Main Search Fetch with AbortController to eliminate out-of-order race conditions
  const executeSearch = useCallback(
    async (searchQuery: string, types: string[], pageNum: number) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setLoading(true);
      setError(null);

      // Synchronize search query and page state to browser URL without reload
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

        // Flatten facets if nested (e.g. backend sends { entityType: { Person: 10, Organization: 5 } })
        let flattenedFacets: Record<string, number> = {};
        const rawFacets = raw.facets;
        if (rawFacets && typeof rawFacets === "object") {
          const facetsObj = rawFacets as Record<string, unknown>;
          if (
            facetsObj.entityType &&
            typeof facetsObj.entityType === "object"
          ) {
            flattenedFacets = {
              ...(facetsObj.entityType as Record<string, number>),
            };
          } else {
            for (const [k, v] of Object.entries(facetsObj)) {
              if (typeof v === "number") {
                flattenedFacets[k] = v;
              } else if (typeof v === "object" && v !== null) {
                Object.assign(flattenedFacets, v);
              }
            }
          }
        }

        const normalized: SearchResponse = {
          content: items,
          facets: flattenedFacets,
          totalElements,
          totalPages,
          size,
          number,
        };
        setSearchData(normalized);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // Request intentionally aborted by newer query
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
    [],
  );

  useEffect(() => {
    executeSearch(query, selectedTypes, page);
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query, selectedTypes, page, executeSearch]);

  // Autocomplete Suggestions computation
  // Generates autocomplete suggestion words matching current input from current search results
  const suggestions = React.useMemo(() => {
    if (!inputValue.trim() || !searchData) return [];
    const val = inputValue.toLowerCase().trim();
    const matches = searchData.content
      .map((item) => item.canonicalName)
      .filter((name) => name.toLowerCase().includes(val))
      .slice(0, 5); // limit to top 5
    return Array.from(new Set(matches));
  }, [inputValue, searchData]);

  // Facet count helper
  const facets = searchData?.facets || {};

  return (
    <div className="flex flex-col gap-6 select-none">
      {/* Foundry Page Header */}
      <FoundryPageHeader
        breadcrumbs={[
          { label: "Operational Mesh", to: "/" },
          { label: "Entity Explorer" },
        ]}
        title="Entity Explorer & Canonical Search"
        description="Search, filter, and inspect canonical graph entities, properties, and inverted index facets."
        icon={<Layers className="w-5 h-5 text-blue-400" />}
        badge={{
          label: "OpenSearch Synced",
          variant: "emerald",
        }}
        actions={
          <button
            onClick={handleExportCsv}
            disabled={isExporting}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-850 hover:border-zinc-700 text-xs font-semibold text-zinc-200 transition-all cursor-pointer shadow-sm disabled:opacity-50"
            title="Download clean canonical records matching current query as CSV"
          >
            <Download
              className={`w-3.5 h-3.5 text-emerald-400 ${
                isExporting ? "animate-bounce" : ""
              }`}
            />
            <span>{isExporting ? "Exporting..." : "Export Clean CSV"}</span>
          </button>
        }
      />

      {/* Search Input Bar Row */}
      <div className="flex justify-center md:justify-start">
        <SearchBar
          query={inputValue}
          onChange={setInputValue}
          onSearch={() => {
            setQuery(inputValue);
            setPage(0);
          }}
          suggestions={suggestions}
          onSelectSuggestion={(val) => {
            setInputValue(val);
            setQuery(val);
            setPage(0);
          }}
        />
      </div>

      {/* Main Workspace Layout */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Facet Sidebar */}
        <FacetFilterSidebar
          selectedTypes={selectedTypes}
          onChange={(types) => {
            setSelectedTypes(types);
            setPage(0);
          }}
          facets={facets}
          ontologyTypes={ontologyTypes}
        />

        {/* Search Results Pane */}
        <div className="flex-1 w-full flex flex-col gap-5">
          {/* Loading state */}
          {loading && !searchData && (
            <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/10 border border-zinc-900 rounded-2xl gap-3">
              <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
              <span className="text-xs text-zinc-500 font-medium">
                Searching OpenSearch cluster...
              </span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex flex-col items-center justify-center py-16 bg-red-950/10 border border-red-500/20 rounded-2xl text-center p-6">
              <span className="text-xs text-red-400 font-bold mb-1">
                Search Error
              </span>
              <p className="text-[11px] text-zinc-500 max-w-sm mb-4">{error}</p>
              <button
                onClick={() => executeSearch(query, selectedTypes, page)}
                className="px-3.5 py-1.5 text-xs font-semibold text-zinc-200 hover:text-white bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-lg transition-colors cursor-pointer"
              >
                Retry Search
              </button>
            </div>
          )}

          {/* Success / Loaded state */}
          {!loading && !error && searchData && (
            <>
              {/* Results status banner */}
              <div className="flex items-center justify-between text-xs text-zinc-500 select-none">
                <span>
                  Showing{" "}
                  <span className="text-zinc-300 font-semibold">
                    {searchData.totalElements === 0 ? 0 : page * pageSize + 1}
                  </span>
                  -
                  <span className="text-zinc-300 font-semibold">
                    {Math.min((page + 1) * pageSize, searchData.totalElements)}
                  </span>{" "}
                  of{" "}
                  <span className="text-zinc-300 font-semibold">
                    {searchData.totalElements}
                  </span>{" "}
                  entities
                </span>
                {inputValue && (
                  <span className="italic text-[10px]">
                    Matched in {searchData.totalElements} records
                  </span>
                )}
              </div>

              {/* Cards Grid */}
              {searchData.content.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 border border-dashed border-zinc-800/80 rounded-2xl text-center p-6 bg-zinc-950/20 select-none">
                  <HelpCircle className="w-8 h-8 text-zinc-700 mb-3" />
                  <h4 className="text-sm font-bold text-zinc-300">
                    No Entities Found
                  </h4>
                  <p className="text-xs text-zinc-500 max-w-xs mt-1.5">
                    Your search query did not yield any matching records. Try
                    widening your query or altering filters.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {searchData.content.map((entity) => (
                    <EntityCard
                      key={entity.id}
                      id={entity.id}
                      canonicalName={entity.canonicalName}
                      entityType={entity.entityType}
                      properties={entity.properties}
                      createdAt={entity.createdAt}
                      highlights={entity.highlights}
                      ontologyTypes={ontologyTypes}
                    />
                  ))}
                </div>
              )}

              {/* Pagination controls */}
              {searchData.totalPages > 1 && (
                <div className="flex items-center justify-center gap-1.5 pt-4 select-none">
                  {/* Prev Button */}
                  <button
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                    className="p-2 border border-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-zinc-400 transition-colors cursor-pointer"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>

                  {/* Page numbers */}
                  {Array.from({ length: searchData.totalPages }).map(
                    (_, idx) => {
                      const isActive = page === idx;
                      return (
                        <button
                          key={idx}
                          onClick={() => setPage(idx)}
                          className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            isActive
                              ? "bg-blue-600/10 border border-blue-500/30 text-blue-500 font-bold"
                              : "border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                          }`}
                        >
                          {idx + 1}
                        </button>
                      );
                    },
                  )}

                  {/* Next Button */}
                  <button
                    disabled={page === searchData.totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                    className="p-2 border border-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-zinc-400 transition-colors cursor-pointer"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
export default ExplorerPage;
