import React from "react";
import type { EntityType } from "../../../features/ontology/types";
import { EntityCard } from "../../../features/explorer/components/EntityCard";
import { EntityTableView } from "../../../features/explorer/components/EntityTableView";
import { ExplorerPagination } from "./ExplorerPagination";
import { ExplorerEmptyState } from "./ExplorerEmptyState";
import type { SearchResponse, SearchResultItem, ViewMode } from "../types";

interface ExplorerResultsPaneProps {
  searchData: SearchResponse;
  loading: boolean;
  viewMode: ViewMode;
  query: string;
  hasActiveFilters: boolean;
  page: number;
  ontologyTypes: EntityType[];
  maskSensitiveData: boolean;
  onClearFilters: () => void;
  onOpenEntity: (
    entity: SearchResultItem,
    triggerEl: HTMLElement | null,
  ) => void;
  onPageChange: (newPage: number) => void;
}

export const ExplorerResultsPane: React.FC<ExplorerResultsPaneProps> = ({
  searchData,
  loading,
  viewMode,
  query,
  hasActiveFilters,
  page,
  ontologyTypes,
  maskSensitiveData,
  onClearFilters,
  onOpenEntity,
  onPageChange,
}) => {
  return (
    <div
      className={`flex flex-col gap-4 transition-opacity duration-150 motion-reduce:transition-none ${
        loading ? "opacity-60 pointer-events-none" : "opacity-100"
      }`}
    >
      {searchData.content.length === 0 ? (
        <ExplorerEmptyState
          query={query}
          hasFilters={hasActiveFilters}
          onClearFilters={onClearFilters}
        />
      ) : viewMode === "table" ? (
        <EntityTableView
          entities={searchData.content.filter(Boolean)}
          ontologyTypes={ontologyTypes}
          maskSensitiveData={maskSensitiveData}
          onSelect={onOpenEntity}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {searchData.content.filter(Boolean).map((entity, index) => (
            <EntityCard
              key={entity.id || `entity-${index}`}
              entity={entity}
              ontologyTypes={ontologyTypes}
              maskSensitiveData={maskSensitiveData}
              onSelect={onOpenEntity}
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
