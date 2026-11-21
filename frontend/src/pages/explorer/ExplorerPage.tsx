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
import { ExplorerToolbar } from "./components";
import { ExplorerHeaderActions } from "./components/ExplorerHeaderActions";
import { ExplorerInsightStrip } from "./components/ExplorerInsightStrip";
import { ExplorerMobileFiltersDrawer } from "./components/ExplorerMobileFiltersDrawer";
import { ExplorerResultsContent } from "./components/ExplorerResultsContent";
import { useExplorerSearch } from "./hooks";
import { DEFAULT_PAGE_SIZE, PRIVACY_STORAGE_KEY } from "./constants";
import type { SearchResultItem, ViewMode } from "./types";
import { formatRelativeTime } from "./utils";

function readInitialPrivacyMask(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(PRIVACY_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export const ExplorerPage: React.FC = () => {
  const search = useExplorerSearch({
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

  const { searchData, activeTypeCount, mostRecentUpdate } = search;

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
    return { label: parts.join(" · "), variant: "zinc" as const };
  }, [searchData, activeTypeCount, mostRecentUpdate]);

  const filteredRecordCount = searchData?.totalElements ?? 0;
  const hasActiveFilters =
    search.selectedTypes.length > 0 ||
    search.parsedFilters.length > 0 ||
    search.inputValue.trim().length > 0;

  return (
    <div className="flex flex-col gap-6">
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
          <ExplorerHeaderActions
            maskSensitiveData={maskSensitiveData}
            onTogglePrivacyMask={() => setMaskSensitiveData((prev) => !prev)}
            filteredRecordCount={filteredRecordCount}
            isExporting={search.isExporting}
            onExportCsv={() => void search.handleExportCsv()}
          />
        }
      />

      <SearchBar
        query={search.inputValue}
        onChange={search.setInputValue}
        onSearch={search.handleSearchSubmit}
        parsedFilters={search.parsedFilters}
        onRemoveFilter={search.removeFilterChip}
        suggestions={search.suggestions}
        onSelectSuggestion={search.handleSelectSuggestion}
      />

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="hidden lg:block shrink-0">
          <FacetFilterSidebar
            selectedTypes={search.selectedTypes}
            onChange={search.setSelectedTypes}
            facets={search.facets}
            facetGroups={search.facetGroups}
            ontologyTypes={search.ontologyTypes}
          />
        </div>

        <ExplorerMobileFiltersDrawer
          open={mobileFiltersOpen}
          onClose={() => setMobileFiltersOpen(false)}
          selectedTypes={search.selectedTypes}
          onChangeTypes={search.setSelectedTypes}
          facets={search.facets}
          facetGroups={search.facetGroups}
          ontologyTypes={search.ontologyTypes}
        />

        <div className="flex-1 min-w-0 w-full flex flex-col gap-4">
          <ExplorerInsightStrip
            insights={searchData?.insights}
            onSelectInsight={search.setInputValue}
          />

          <ExplorerToolbar
            totalElements={filteredRecordCount}
            currentPage={search.page}
            pageSize={search.pageSize}
            onPageSizeChange={search.setPageSize}
            sortOption={search.sortOption}
            onSortChange={search.setSortOption}
            hasConfidenceData={search.hasConfidenceData}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            activeFilterCount={search.selectedTypes.length}
            onOpenMobileFilters={() => setMobileFiltersOpen(true)}
          />

          <ExplorerResultsContent
            loading={search.loading}
            error={search.error}
            errorDetails={search.errorDetails}
            searchData={searchData}
            viewMode={viewMode}
            inputValue={search.inputValue}
            hasActiveFilters={hasActiveFilters}
            ontologyTypes={search.ontologyTypes}
            maskSensitiveData={maskSensitiveData}
            page={search.page}
            onRetry={search.retrySearch}
            onClearFilters={search.clearAllFilters}
            onSelectEntity={handleOpenEntity}
            onPageChange={search.setPage}
          />
        </div>
      </div>

      <EntityDetailDrawer
        entity={selectedEntity}
        ontologyTypes={search.ontologyTypes}
        maskSensitiveData={maskSensitiveData}
        onClose={handleCloseEntity}
      />
    </div>
  );
};

export default ExplorerPage;
