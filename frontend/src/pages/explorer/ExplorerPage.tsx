import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SearchBar } from "../../features/explorer/components/SearchBar";
import { EntityDetailDrawer } from "../../features/explorer/components/EntityDetailDrawer";
import { FacetFilterSidebar } from "../../features/explorer/components/FacetFilterSidebar";
import { Icons, ICON_SIZES } from "../../lib/icons";
import { PageHeader } from "../../components/layout/PageHeader";
import { useAuthStore } from "../../stores/authStore";
import {
  ExplorerToolbar,
  ExplorerLoadingState,
  ExplorerErrorState,
} from "./components";
import { ExplorerHeaderActions } from "./components/ExplorerHeaderActions";
import { ExplorerInsightsStrip } from "./components/ExplorerInsightsStrip";
import { ExplorerMobileDrawer } from "./components/ExplorerMobileDrawer";
import { ExplorerResultsPane } from "./components/ExplorerResultsPane";
import { useExplorerSearch } from "./hooks";
import { DEFAULT_PAGE_SIZE, PRIVACY_STORAGE_KEY } from "./constants";
import type { SearchResultItem, ViewMode } from "./types";
import { formatRelativeTime } from "./utils";

function getUserPrivacyStorageKey(userKey: string): string {
  return `${PRIVACY_STORAGE_KEY}:${userKey}`;
}

function readUserPrivacyMask(userKey: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = window.localStorage.getItem(
      getUserPrivacyStorageKey(userKey),
    );
    if (stored === "false") return false;
    return true;
  } catch {
    return true;
  }
}

export const ExplorerPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const userKey = useMemo(() => {
    const id = user?.profile?.sub || user?.profile?.email;
    return typeof id === "string" && id.trim() ? id.trim() : "anonymous";
  }, [user]);

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
    typeLabelFields,
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
  const [maskSensitiveData, setMaskSensitiveData] = useState<boolean>(() =>
    readUserPrivacyMask(userKey),
  );
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<SearchResultItem | null>(
    null,
  );
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMaskSensitiveData(readUserPrivacyMask(userKey));
  }, [userKey]);

  const handleToggleMask = useCallback(() => {
    setMaskSensitiveData((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(
          getUserPrivacyStorageKey(userKey),
          String(next),
        );
      } catch {
        // Ignore storage quota / privacy mode errors
      }
      return next;
    });
  }, [userKey]);

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

  const headerSummaryBadge = useMemo(() => {
    if (!searchData) return undefined;
    const parts: string[] = [];
    if (typeof searchData.totalElements === "number") {
      parts.push(
        `${searchData.totalElements.toLocaleString()} ${
          searchData.totalElements === 1 ? "entity" : "entities"
        }`,
      );
    }
    if (activeTypeCount > 0) {
      parts.push(
        `${activeTypeCount} ${activeTypeCount === 1 ? "type" : "types"}`,
      );
    }
    const relTime = formatRelativeTime(mostRecentUpdate);
    if (relTime) parts.push(`updated ${relTime}`);
    if (parts.length === 0) return undefined;
    return { label: parts.join(" · "), variant: "zinc" as const };
  }, [searchData, activeTypeCount, mostRecentUpdate]);

  const filteredRecordCount = searchData?.totalElements ?? 0;
  const hasActiveFilters =
    selectedTypes.length > 0 ||
    parsedFilters.length > 0 ||
    inputValue.trim().length > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumbs={[
          { label: "Explore & Overview", to: "/" },
          { label: "Entity Explorer" },
        ]}
        title="Entity Explorer"
        description="Search, filter, and inspect resolved canonical entities, provenance, and data quality."
        icon={
          <Icons.EntityExplorer
            size={ICON_SIZES.header}
            className="text-primary"
            aria-hidden="true"
          />
        }
        badge={headerSummaryBadge}
        actions={
          <ExplorerHeaderActions
            maskSensitiveData={maskSensitiveData}
            onToggleMask={handleToggleMask}
            isExporting={isExporting}
            filteredRecordCount={filteredRecordCount}
            onExportCsv={() => void handleExportCsv()}
          />
        }
      />

      <SearchBar
        query={inputValue}
        onChange={setInputValue}
        onSearch={handleSearchSubmit}
        parsedFilters={parsedFilters}
        onRemoveFilter={removeFilterChip}
        suggestions={suggestions}
        onSelectSuggestion={handleSelectSuggestion}
      />

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="hidden lg:block shrink-0">
          <FacetFilterSidebar
            selectedTypes={selectedTypes}
            onChange={setSelectedTypes}
            facets={facets}
            facetGroups={facetGroups}
            ontologyTypes={ontologyTypes}
          />
        </div>

        <ExplorerMobileDrawer
          isOpen={mobileFiltersOpen}
          onClose={() => setMobileFiltersOpen(false)}
          selectedTypes={selectedTypes}
          onSelectedTypesChange={setSelectedTypes}
          facets={facets}
          facetGroups={facetGroups}
          ontologyTypes={ontologyTypes}
        />

        <div className="flex-1 min-w-0 w-full flex flex-col gap-4">
          <ExplorerInsightsStrip
            insights={searchData?.insights}
            onSelectInsight={(term) => setInputValue(term)}
          />

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

          {loading && !searchData && (
            <ExplorerLoadingState viewMode={viewMode} count={6} />
          )}

          {error && (
            <ExplorerErrorState
              error={error}
              details={errorDetails}
              onRetry={retrySearch}
            />
          )}

          {!error && searchData && (
            <ExplorerResultsPane
              searchData={searchData}
              loading={loading}
              viewMode={viewMode}
              query={inputValue}
              hasActiveFilters={hasActiveFilters}
              page={page}
              ontologyTypes={ontologyTypes}
              typeLabelFields={typeLabelFields}
              maskSensitiveData={maskSensitiveData}
              onClearFilters={clearAllFilters}
              onOpenEntity={handleOpenEntity}
              onPageChange={setPage}
            />
          )}
        </div>
      </div>

      <EntityDetailDrawer
        entity={selectedEntity}
        ontologyTypes={ontologyTypes}
        typeLabelFields={typeLabelFields}
        maskSensitiveData={maskSensitiveData}
        onClose={handleCloseEntity}
      />
    </div>
  );
};

export default ExplorerPage;
