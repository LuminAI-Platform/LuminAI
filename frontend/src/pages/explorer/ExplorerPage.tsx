import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SearchBar } from "../../features/explorer/components/SearchBar";
import { EntityCard } from "../../features/explorer/components/EntityCard";
import { EntityTableView } from "../../features/explorer/components/EntityTableView";
import { EntityDetailDrawer } from "../../features/explorer/components/EntityDetailDrawer";
import { FacetFilterSidebar } from "../../features/explorer/components/FacetFilterSidebar";
import { Icons, Download, Eye, EyeOff, ICON_SIZES } from "../../lib/icons";
import { PageHeader } from "../../components/layout/PageHeader";
import { Tooltip } from "../../components/ui/Tooltip";
import {
  ExplorerPagination,
  ExplorerEmptyState,
  ExplorerToolbar,
  ExplorerLoadingState,
  ExplorerErrorState,
} from "./components";
import { useExplorerSearch } from "./hooks";
import { DEFAULT_PAGE_SIZE, PRIVACY_STORAGE_KEY } from "./constants";
import type { SearchResultItem, ViewMode } from "./types";
import { formatRelativeTime } from "./utils";

function readInitialPrivacyMask(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = window.localStorage.getItem(PRIVACY_STORAGE_KEY);
    if (stored === "false") return false;
    return true;
  } catch {
    return true;
  }
}

export const ExplorerPage: React.FC = () => {
  const {
    inputValue,
    setInputValue,
    parsedFilters,
    removeFilterChip,
    selectedTypes,
    setSelectedTypes,
    sortOption,
    setSortOption,
    page,
    setPage,
    pageSize,
    setPageSize,
    ontologyTypes,
    searchData,
    facets,
    facetGroups,
    loading,
    error,
    errorDetails,
    suggestions,
    isExporting,
    mostRecentUpdate,
    activeTypeCount,
    hasConfidenceData,
    handleExportCsv,
    retrySearch,
    handleSearchSubmit,
    handleSelectSuggestion,
    clearAllFilters,
  } = useExplorerSearch({
    initialPageSize: DEFAULT_PAGE_SIZE,
    debounceMs: 250,
  });

  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [maskSensitiveData, setMaskSensitiveData] = useState<boolean>(
    readInitialPrivacyMask,
  );
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<SearchResultItem | null>(
    null,
  );
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  // Persist privacy mask toggle per user in localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(
        PRIVACY_STORAGE_KEY,
        String(maskSensitiveData),
      );
    } catch {
      // Ignore storage quota / privacy mode errors
    }
  }, [maskSensitiveData]);

  // Close mobile filters drawer on Escape
  useEffect(() => {
    if (!mobileFiltersOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileFiltersOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileFiltersOpen]);

  const handleOpenEntity = useCallback(
    (entity: SearchResultItem, triggerEl: HTMLElement | null) => {
      lastTriggerRef.current = triggerEl;
      setSelectedEntity(entity);
    },
    [],
  );

  const handleCloseEntity = useCallback(() => {
    setSelectedEntity(null);
    const trigger = lastTriggerRef.current;
    if (trigger && typeof trigger.focus === "function") {
      window.requestAnimationFrame(() => {
        trigger.focus();
      });
    }
  }, []);

  // Build header summary strictly from values returned by the API
  const headerSummaryBadge = useMemo(() => {
    if (!searchData) return undefined;
    const parts: string[] = [];
    if (typeof searchData.totalElements === "number") {
      parts.push(
        `${searchData.totalElements.toLocaleString()} ${searchData.totalElements === 1 ? "entity" : "entities"}`,
      );
    }
    if (activeTypeCount > 0) {
      parts.push(
        `${activeTypeCount} ${activeTypeCount === 1 ? "type" : "types"}`,
      );
    }
    const relTime = formatRelativeTime(mostRecentUpdate);
    if (relTime) {
      parts.push(`updated ${relTime}`);
    }
    if (parts.length === 0) return undefined;
    return {
      label: parts.join(" · "),
      variant: "zinc" as const,
    };
  }, [searchData, activeTypeCount, mostRecentUpdate]);

  const filteredRecordCount = searchData?.totalElements ?? 0;
  const exportTooltip = `Export ${filteredRecordCount.toLocaleString()} filtered ${filteredRecordCount === 1 ? "record" : "records"}`;
  const hasActiveFilters =
    selectedTypes.length > 0 ||
    parsedFilters.length > 0 ||
    inputValue.trim().length > 0;

  // Conditional Insight Strip — ONLY rendered if API explicitly returns insight counts
  const insights = searchData?.insights;
  const insightChips = useMemo(() => {
    if (!insights) return [];
    const chips: Array<{ key: string; label: string; count: number }> = [];
    if (
      typeof insights.possibleDuplicates === "number" &&
      insights.possibleDuplicates > 0
    ) {
      chips.push({
        key: "duplicates",
        label: "Possible duplicates",
        count: insights.possibleDuplicates,
      });
    }
    if (
      typeof insights.missingValues === "number" &&
      insights.missingValues > 0
    ) {
      chips.push({
        key: "missing",
        label: "Missing values",
        count: insights.missingValues,
      });
    }
    if (typeof insights.needsReview === "number" && insights.needsReview > 0) {
      chips.push({
        key: "review",
        label: "Needs review",
        count: insights.needsReview,
      });
    }
    return chips;
  }, [insights]);

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <PageHeader
        breadcrumbs={[
          { label: "Explore & Overview", to: "/" },
          { label: "Entity Explorer" },
        ]}
        title="Entity Explorer"
        description="Search, filter, and inspect resolved canonical entities, provenance, and confidence."
        icon={
          <Icons.EntityExplorer
            size={ICON_SIZES.header}
            className="text-primary"
            aria-hidden="true"
          />
        }
        badge={headerSummaryBadge}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Global Privacy Mask Toggle */}
            <button
              type="button"
              role="switch"
              aria-checked={maskSensitiveData}
              onClick={() => setMaskSensitiveData((prev) => !prev)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors duration-150 motion-reduce:transition-none cursor-pointer ${
                maskSensitiveData
                  ? "bg-primary-tint border-primary-border text-primary"
                  : "bg-surface border-border text-text-secondary hover:text-text hover:bg-surface-hover"
              }`}
            >
              {maskSensitiveData ? (
                <EyeOff size={14} aria-hidden="true" />
              ) : (
                <Eye size={14} aria-hidden="true" />
              )}
              <span>Mask sensitive data</span>
            </button>

            {/* Export Clean CSV with filtered record scope */}
            <Tooltip label={exportTooltip} side="bottom">
              <button
                type="button"
                onClick={() => void handleExportCsv()}
                disabled={isExporting || filteredRecordCount === 0}
                title={exportTooltip}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-border bg-surface hover:bg-surface-hover text-xs font-semibold text-text transition-colors duration-150 motion-reduce:transition-none cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download
                  size={14}
                  className={`text-primary ${isExporting ? "animate-bounce motion-reduce:animate-none" : ""}`}
                  aria-hidden="true"
                />
                <span>
                  {isExporting
                    ? "Exporting..."
                    : `Export Clean CSV (${filteredRecordCount.toLocaleString()})`}
                </span>
              </button>
            </Tooltip>
          </div>
        }
      />

      {/* Full-width Search Bar (Entity Types dropdown removed; left panel is the sole type filter) */}
      <SearchBar
        query={inputValue}
        onChange={setInputValue}
        onSearch={handleSearchSubmit}
        parsedFilters={parsedFilters}
        onRemoveFilter={removeFilterChip}
        suggestions={suggestions}
        onSelectSuggestion={handleSelectSuggestion}
      />

      {/* Main Workspace Layout: Sticky Left Filters Panel + Results Pane */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Desktop Sticky Facet Sidebar */}
        <div className="hidden lg:block shrink-0">
          <FacetFilterSidebar
            selectedTypes={selectedTypes}
            onChange={setSelectedTypes}
            facets={facets}
            facetGroups={facetGroups}
            ontologyTypes={ontologyTypes}
          />
        </div>

        {/* Mobile / Narrow-Screen Filters Drawer */}
        {mobileFiltersOpen && (
          <>
            <div
              onClick={() => setMobileFiltersOpen(false)}
              aria-hidden="true"
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Entity filters"
              className="fixed top-0 left-0 z-50 h-full w-80 max-w-[85vw] bg-surface border-r border-border shadow-2xl p-4 overflow-y-auto lg:hidden"
            >
              <FacetFilterSidebar
                selectedTypes={selectedTypes}
                onChange={setSelectedTypes}
                facets={facets}
                facetGroups={facetGroups}
                ontologyTypes={ontologyTypes}
                inDrawer
                onCloseDrawer={() => setMobileFiltersOpen(false)}
              />
            </div>
          </>
        )}

        {/* Search Results Pane */}
        <div className="flex-1 min-w-0 w-full flex flex-col gap-4">
          {/* Conditional Insight Strip — only renders when API returns insight counts */}
          {insightChips.length > 0 && (
            <div
              className="flex flex-wrap items-center gap-2 px-3.5 py-2 rounded-xl bg-surface border border-border"
              aria-label="Engine insights"
            >
              {insightChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setInputValue(`${chip.key}:true`)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-primary-tint text-primary border border-primary-border hover:opacity-90 transition-opacity duration-150 motion-reduce:transition-none cursor-pointer"
                >
                  <span>{chip.label}</span>
                  <span className="font-mono font-bold">{chip.count}</span>
                </button>
              ))}
            </div>
          )}

          {/* Controls Toolbar */}
          <ExplorerToolbar
            totalElements={filteredRecordCount}
            currentPage={page}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            sortOption={sortOption}
            onSortChange={setSortOption}
            hasConfidenceData={hasConfidenceData}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            activeFilterCount={selectedTypes.length}
            onOpenMobileFilters={() => setMobileFiltersOpen(true)}
          />

          {/* Loading State */}
          {loading && !searchData && (
            <ExplorerLoadingState viewMode={viewMode} count={6} />
          )}

          {/* Error State */}
          {error && (
            <ExplorerErrorState
              error={error}
              details={errorDetails}
              onRetry={retrySearch}
            />
          )}

          {/* Loaded State */}
          {!error && searchData && (
            <div
              className={`flex flex-col gap-4 transition-opacity duration-150 motion-reduce:transition-none ${
                loading ? "opacity-60 pointer-events-none" : "opacity-100"
              }`}
            >
              {searchData.content.length === 0 ? (
                <ExplorerEmptyState
                  query={inputValue}
                  hasFilters={hasActiveFilters}
                  onClearFilters={clearAllFilters}
                />
              ) : viewMode === "table" ? (
                <EntityTableView
                  entities={searchData.content.filter(Boolean)}
                  ontologyTypes={ontologyTypes}
                  maskSensitiveData={maskSensitiveData}
                  onSelect={handleOpenEntity}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {searchData.content.filter(Boolean).map((entity, index) => (
                    <EntityCard
                      key={entity.id || `entity-${index}`}
                      entity={entity}
                      ontologyTypes={ontologyTypes}
                      maskSensitiveData={maskSensitiveData}
                      onSelect={handleOpenEntity}
                    />
                  ))}
                </div>
              )}

              {searchData.totalElements > 0 && (
                <ExplorerPagination
                  currentPage={page}
                  totalPages={searchData.totalPages}
                  onPageChange={setPage}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right-Side Entity Detail Drawer */}
      <EntityDetailDrawer
        entity={selectedEntity}
        ontologyTypes={ontologyTypes}
        maskSensitiveData={maskSensitiveData}
        onClose={handleCloseEntity}
      />
    </div>
  );
};

export default ExplorerPage;
