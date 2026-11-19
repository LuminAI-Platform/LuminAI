import React from "react";
import type { EntityType } from "../../features/ontology/types";

// ─── Explorer Search Types ──────────────────────────────────────────────────

export type SortOption =
  | "newest"
  | "name_asc"
  | "name_desc"
  | "confidence_desc";

export type ViewMode = "cards" | "table";

export interface ParsedQueryFilter {
  key: string;
  value: string;
  raw: string;
}

export interface PossibleDuplicateRef {
  id?: string;
  name: string;
  candidateId?: string;
}

export interface MatchReason {
  field?: string;
  rule?: string;
  score?: number;
  detail?: string;
}

export interface SearchResultItem {
  id: string;
  canonicalName: string;
  entityType: string;
  properties: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  confidenceScore?: number;
  sourceCount?: number;
  sourceSystems?: string[];
  highlights?: Record<string, string[]>;
  matchReasons?: MatchReason[];
  possibleDuplicate?: PossibleDuplicateRef | null;
  needsReview?: boolean;
}

export interface ExplorerInsightCounts {
  possibleDuplicates?: number;
  missingValues?: number;
  needsReview?: number;
}

export interface SearchResponse {
  content: SearchResultItem[];
  /** Primary entity-type facet map (typeName -> count) */
  facets: Record<string, number>;
  /** All facet groups returned by the API (e.g. entityTypes, sourceSystems) */
  facetGroups: Record<string, Record<string, number>>;
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  /** Only populated if the API explicitly returns insight counts */
  insights?: ExplorerInsightCounts;
}

export interface UseExplorerSearchOptions {
  initialPageSize?: number;
  debounceMs?: number;
}

export interface UseExplorerSearchResult {
  inputValue: string;
  setInputValue: (val: string) => void;
  query: string;
  parsedFilters: ParsedQueryFilter[];
  removeFilterChip: (filter: ParsedQueryFilter) => void;
  selectedTypes: string[];
  setSelectedTypes: (types: string[]) => void;
  sortOption: SortOption;
  setSortOption: (sort: SortOption) => void;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  pageSize: number;
  setPageSize: (size: number) => void;
  ontologyTypes: EntityType[];
  searchData: SearchResponse | null;
  facets: Record<string, number>;
  facetGroups: Record<string, Record<string, number>>;
  loading: boolean;
  error: string | null;
  errorDetails: string | null;
  suggestions: string[];
  isExporting: boolean;
  mostRecentUpdate: string | null;
  activeTypeCount: number;
  hasConfidenceData: boolean;
  handleExportCsv: () => Promise<void>;
  executeSearch: (
    searchQuery: string,
    types: string[],
    pageNum: number,
    size: number,
    sort: SortOption,
  ) => Promise<void>;
  retrySearch: () => void;
  handleSearchSubmit: () => void;
  handleSelectSuggestion: (val: string) => void;
  clearAllFilters: () => void;
}

// ─── Entity Detail Types ────────────────────────────────────────────────────

export interface ProvenanceApiItem {
  fieldName?: string;
  propertyKey?: string;
  sourceRecordId?: string;
  sourceName?: string;
  sourceDataset?: string;
  sourceField?: string;
  contributedValue?: unknown;
  action?: string;
  occurredAt?: string;
  ingestedAt?: string;
  confidence?: "high" | "medium" | "low";
}

export interface EntityDetail {
  id: string;
  canonicalName: string;
  entityType: string;
  confidenceScore?: number;
  sourceCount?: number;
  sourceSystems?: string[];
  properties: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  sourceRecordIds?: string[];
  provenance?: ProvenanceApiItem[];
  matchReasons?: MatchReason[];
  possibleDuplicate?: PossibleDuplicateRef | null;
}

export interface UseEntityDetailResult {
  entity: EntityDetail | null;
  provenance: import("../../features/explorer/components/EntityPropertyTable").ProvenanceLine[];
  loading: boolean;
  error: string | null;
  activeProvenanceKey: string | null;
  setActiveProvenanceKey: React.Dispatch<React.SetStateAction<string | null>>;
  refetch: () => Promise<void>;
}
