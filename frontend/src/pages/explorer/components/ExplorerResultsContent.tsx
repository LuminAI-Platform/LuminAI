import React from "react";
import { EntityCard } from "../../../features/explorer/components/EntityCard";
import { EntityTableView } from "../../../features/explorer/components/EntityTableView";
import type { EntityType } from "../../../features/ontology/types";
import type { SearchResponse, SearchResultItem, ViewMode } from "../types";
import { ExplorerEmptyState } from "./ExplorerEmptyState";
import { ExplorerPagination } from "./ExplorerPagination";
import {
  ExplorerErrorState,
  ExplorerLoadingState,
} from "./ExplorerSearchStates";

interface ExplorerResultsContentProps {
  loading: boolean;
  error: string | null;
  errorDetails: string | null;
  searchData: SearchResponse | null;
  viewMode: ViewMode;
  inputValue: string;
  hasActiveFilters: boolean;
  ontologyTypes: EntityType[];
  maskSensitiveData: boolean;
  page: number;
  onRetry: () => void;
  onClearFilters: () => void;
  onSelectEntity: (
    entity: SearchResultItem,
    triggerEl: HTMLElement | null,
  ) => void;
  onPageChange: (page: number) => void;
}

export const ExplorerResultsContent: React.FC<ExplorerResultsContentProps> = ({
  loading,
  error,
  errorDetails,
  searchData,
  viewMode,
  inputValue,
  hasActiveFilters,
  ontologyTypes,
  maskSensitiveData,
  page,
  onRetry,
  onClearFilters,
  onSelectEntity,
  onPageChange,
}) => {
  if (loading && !searchData) {
    return <ExplorerLoadingState viewMode={viewMode} count={6} />;
  }

  if (error) {
    return (
      <ExplorerErrorState
        error={error}
        details={errorDetails}
        onRetry={onRetry}
      />
    );
  }

  if (!searchData) return null;

  const validEntities = searchData.content.filter(Boolean);

  return (
    <div
      className={`flex flex-col gap-4 transition-opacity duration-150 motion-reduce:transition-none ${
        loading ? "opacity-60 pointer-events-none" : "opacity-100"
      }`}
    >
      {searchData.content.length === 0 ? (
        <ExplorerEmptyState
          query={inputValue}
          hasFilters={hasActiveFilters}
          onClearFilters={onClearFilters}
        />
      ) : viewMode === "table" ? (
        <EntityTableView
          entities={validEntities}
          ontologyTypes={ontologyTypes}
          maskSensitiveData={maskSensitiveData}
          onSelect={onSelectEntity}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {validEntities.map((entity, index) => (
            <EntityCard
              key={entity.id || `entity-${index}`}
              entity={entity}
              ontologyTypes={ontologyTypes}
              maskSensitiveData={maskSensitiveData}
              onSelect={onSelectEntity}
            />
          ))}
        </div>
      )}

      {searchData.totalElements > 0 && (
        <ExplorerPagination
          currentPage={page}
          totalPages={searchData.totalPages}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
};
