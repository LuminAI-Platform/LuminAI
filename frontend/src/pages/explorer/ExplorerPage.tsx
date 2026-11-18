import React from "react";
import { SearchBar } from "../../features/explorer/components/SearchBar";
import { EntityCard } from "../../features/explorer/components/EntityCard";
import { FacetFilterSidebar } from "../../features/explorer/components/FacetFilterSidebar";
import { Layers, Download } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { MultiSelect } from "../../components/ui/dropdown";
import {
  ExplorerPagination,
  ExplorerEmptyState,
  ExplorerResultsBanner,
  ExplorerLoadingState,
  ExplorerErrorState,
} from "./components";
import { useExplorerSearch } from "./hooks";

export const ExplorerPage: React.FC = () => {
  const {
    inputValue,
    setInputValue,
    selectedTypes,
    setSelectedTypes,
    page,
    setPage,
    pageSize,
    ontologyTypes,
    searchData,
    facets,
    loading,
    error,
    suggestions,
    isExporting,
    handleExportCsv,
    retrySearch,
    handleSearchSubmit,
    handleSelectSuggestion,
  } = useExplorerSearch({ pageSize: 6, debounceMs: 250 });

  return (
    <div className="flex flex-col gap-6 select-none">
      {/* Page Header */}
      <PageHeader
        breadcrumbs={[
          { label: "Explore & Overview", to: "/" },
          { label: "Entity Explorer" },
        ]}
        title="Entity Explorer"
        description="Search, filter, and inspect canonical records, properties, and entity indexes."
        icon={<Layers className="w-5 h-5 text-blue-400" />}
        badge={{
          label: "Search Active",
          variant: "emerald",
        }}
        actions={
          <button
            onClick={handleExportCsv}
            disabled={isExporting}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-border bg-transparent hover:bg-surface-subtle text-xs font-semibold text-text transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="Download clean canonical records matching current query as CSV"
          >
            <Download
              className={`w-3.5 h-3.5 text-primary ${
                isExporting ? "animate-bounce" : ""
              }`}
            />
            <span>{isExporting ? "Exporting..." : "Export Clean CSV"}</span>
          </button>
        }
      />

      {/* Search Input Bar & Entity Types Multi-Select Row */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchBar
          query={inputValue}
          onChange={setInputValue}
          onSearch={handleSearchSubmit}
          suggestions={suggestions}
          onSelectSuggestion={handleSelectSuggestion}
        />
        {ontologyTypes.length > 0 && (
          <MultiSelect
            label="Entity Types"
            values={selectedTypes}
            onChange={setSelectedTypes}
            options={ontologyTypes.map((t) => ({
              value: t.name,
              label: t.label || t.name,
              count: facets[t.name] ?? 0,
            }))}
            searchPlaceholder="Search entity types…"
          />
        )}
      </div>

      {/* Main Workspace Layout */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Facet Sidebar */}
        <FacetFilterSidebar
          selectedTypes={selectedTypes}
          onChange={setSelectedTypes}
          facets={facets}
          ontologyTypes={ontologyTypes}
        />

        {/* Search Results Pane */}
        <div className="flex-1 w-full flex flex-col gap-5">
          {/* Loading state */}
          {loading && !searchData && <ExplorerLoadingState />}

          {/* Error State */}
          {error && <ExplorerErrorState error={error} onRetry={retrySearch} />}

          {/* Success / Loaded state */}
          {!loading && !error && searchData && (
            <>
              {/* Results status banner */}
              {searchData.totalElements > 0 && (
                <ExplorerResultsBanner
                  totalElements={searchData.totalElements}
                  currentPage={page}
                  pageSize={pageSize}
                  query={inputValue}
                />
              )}

              {/* Cards Grid or Empty State */}
              {searchData.content.length === 0 ? (
                <ExplorerEmptyState
                  query={inputValue}
                  hasFilters={selectedTypes.length > 0}
                  onClearFilters={() => {
                    setInputValue("");
                    setSelectedTypes([]);
                    setPage(0);
                  }}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {searchData.content.filter(Boolean).map((entity, index) => (
                    <EntityCard
                      key={entity.id || `entity-${index}`}
                      id={entity.id || ""}
                      canonicalName={entity.canonicalName || "Unnamed Entity"}
                      entityType={entity.entityType || "Entity"}
                      properties={entity.properties || {}}
                      createdAt={entity.createdAt}
                      highlights={entity.highlights}
                      ontologyTypes={ontologyTypes}
                    />
                  ))}
                </div>
              )}

              {/* Pagination controls */}
              {searchData.totalElements > 0 && (
                <ExplorerPagination
                  currentPage={page}
                  totalPages={searchData.totalPages}
                  onPageChange={setPage}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExplorerPage;
