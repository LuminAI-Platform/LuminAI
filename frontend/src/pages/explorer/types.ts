import React from "react";

// ─── Explorer Search Types ──────────────────────────────────────────────────

export interface SearchResultItem {
  id: string;
  canonicalName: string;
  entityType: string;
  properties: Record<string, unknown>;
  createdAt: string;
  highlights?: Record<string, string[]>;
}

export interface SearchResponse {
  content: SearchResultItem[];
  facets: Record<string, number>;
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface UseExplorerSearchOptions {
  pageSize?: number;
  debounceMs?: number;
}

export interface UseExplorerSearchResult {
  inputValue: string;
  setInputValue: (val: string) => void;
  query: string;
  selectedTypes: string[];
  setSelectedTypes: (types: string[]) => void;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  pageSize: number;
  ontologyTypes: import("../../features/ontology/types").EntityType[];
  searchData: SearchResponse | null;
  facets: Record<string, number>;
  loading: boolean;
  error: string | null;
  suggestions: string[];
  isExporting: boolean;
  handleExportCsv: () => Promise<void>;
  executeSearch: (
    searchQuery: string,
    types: string[],
    pageNum: number,
  ) => Promise<void>;
  retrySearch: () => void;
  handleSearchSubmit: () => void;
  handleSelectSuggestion: (val: string) => void;
}

// ─── Entity Detail Types ────────────────────────────────────────────────────

export interface EntityDetail {
  id: string;
  canonicalName: string;
  entityType: string;
  properties: Record<string, unknown>;
  createdAt: string;
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

