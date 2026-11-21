import React, { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUpDown } from "../../../lib/icons";
import { Skeleton } from "../../../components/ui/Skeleton";
import type {
  UnifiedSource,
  SourceStatus,
  IngestedFile,
} from "./connectionsTypes";
import { SourcesTableToolbar } from "./SourcesTableToolbar";
import { SourceTableRow } from "./SourceTableRow";

export type SortField = "name" | "lastSync";
export type SortDirection = "asc" | "desc";

interface SourcesTableProps {
  sources: UnifiedSource[];
  isLoading: boolean;
  showTypeFilter: boolean;
  testingSourceId: string | null;
  togglingSourceId: string | null;
  onTestConnection: (source: UnifiedSource) => void;
  onEditSource: (source: UnifiedSource) => void;
  onTogglePause: (source: UnifiedSource) => void;
  onDeleteSource: (source: UnifiedSource) => void;
  onOpenRawPreview: (file: IngestedFile) => void;
  onInspectCleanData: (file: IngestedFile) => void;
}

export const SourcesTableSkeleton: React.FC = () => (
  <div
    className="border border-border rounded-lg overflow-hidden bg-surface"
    aria-label="Loading data sources"
  >
    <div className="p-3 border-b border-border flex flex-wrap items-center gap-3">
      <Skeleton className="h-8 flex-1 min-w-[200px] rounded-lg" />
      <Skeleton className="h-8 w-36 rounded-lg" />
      <Skeleton className="h-8 w-40 rounded-lg" />
    </div>
    <div className="divide-y divide-border">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="px-4 py-3.5 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
            <div className="space-y-1.5 flex-1 max-w-xs">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
          <Skeleton className="h-5 w-20 rounded-md" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 w-14" />
          <Skeleton className="h-7 w-7 rounded-md" />
        </div>
      ))}
    </div>
  </div>
);

export const SourcesTable: React.FC<SourcesTableProps> = ({
  sources,
  isLoading,
  showTypeFilter,
  testingSourceId,
  togglingSourceId,
  onTestConnection,
  onEditSource,
  onTogglePause,
  onDeleteSource,
  onOpenRawPreview,
  onInspectCleanData,
}) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("lastSync");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const filteredSources = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return sources
      .filter((s) => {
        if (
          showTypeFilter &&
          typeFilter !== "all" &&
          s.category !== typeFilter
        ) {
          return false;
        }
        if (
          statusFilter !== "all" &&
          s.status !== (statusFilter as SourceStatus)
        ) {
          return false;
        }
        if (q) {
          const haystack =
            `${s.name} ${s.typeLabel} ${s.desc ?? ""}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dir = sortDirection === "asc" ? 1 : -1;
        if (sortField === "name") {
          return a.name.localeCompare(b.name) * dir;
        }
        const tA = a.lastSyncAt ? Date.parse(a.lastSyncAt) || 0 : 0;
        const tB = b.lastSyncAt ? Date.parse(b.lastSyncAt) || 0 : 0;
        return (tA - tB) * dir;
      });
  }, [
    sources,
    searchQuery,
    statusFilter,
    typeFilter,
    showTypeFilter,
    sortField,
    sortDirection,
  ]);

  if (isLoading) {
    return <SourcesTableSkeleton />;
  }

  const toggleColumnSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "name" ? "asc" : "desc");
    }
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-surface">
      <SourcesTableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        showTypeFilter={showTypeFilter}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        sortField={sortField}
        sortDirection={sortDirection}
        onSortChange={(f, d) => {
          setSortField(f);
          setSortDirection(d);
        }}
      />

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-surface-subtle border-b border-border text-xs font-medium text-text-secondary">
              <th className="py-2.5 px-4">
                <button
                  type="button"
                  onClick={() => toggleColumnSort("name")}
                  className="inline-flex items-center gap-1 hover:text-text transition-colors cursor-pointer"
                >
                  <span>Source</span>
                  <ArrowUpDown className="w-3 h-3" aria-hidden="true" />
                </button>
              </th>
              <th className="py-2.5 px-4">Type</th>
              <th className="py-2.5 px-4">Status</th>
              <th className="py-2.5 px-4">
                <button
                  type="button"
                  onClick={() => toggleColumnSort("lastSync")}
                  className="inline-flex items-center gap-1 hover:text-text transition-colors cursor-pointer"
                >
                  <span>Last sync</span>
                  <ArrowUpDown className="w-3 h-3" aria-hidden="true" />
                </button>
              </th>
              <th className="py-2.5 px-4">Rows synced</th>
              <th className="py-2.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredSources.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-10 px-4 text-center text-xs text-text-secondary"
                >
                  No sources match the current search or filters.
                </td>
              </tr>
            ) : (
              filteredSources.map((source) => (
                <SourceTableRow
                  key={source.id}
                  source={source}
                  testingSourceId={testingSourceId}
                  togglingSourceId={togglingSourceId}
                  onTestConnection={onTestConnection}
                  onEditSource={onEditSource}
                  onTogglePause={onTogglePause}
                  onDeleteSource={onDeleteSource}
                  onOpenRawPreview={onOpenRawPreview}
                  onInspectCleanData={onInspectCleanData}
                  onOpenSchemaStudio={() =>
                    navigate({ to: "/connections/schema-map" })
                  }
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
