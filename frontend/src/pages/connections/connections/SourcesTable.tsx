import React, { useMemo, useState } from "react";
import { Search, ArrowUpDown } from "../../../lib/icons";
import { Select } from "../../../components/ui/dropdown";
import {
  type UnifiedSource,
  type SourceStatus,
  type IngestedFile,
} from "./connectionsTypes";
import { SourcesTableRow } from "./SourcesTableRow";
import { SourcesTableSkeleton } from "./SourcesTableSkeleton";

export { SourcesTableSkeleton };

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

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "Connected", label: "Connected" },
  { value: "Syncing", label: "Syncing" },
  { value: "Failed", label: "Failed" },
  { value: "Paused", label: "Paused" },
];

const TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "database", label: "Databases" },
  { value: "file", label: "Flat files" },
];

const SORT_OPTIONS = [
  { value: "lastSync:desc", label: "Last sync (newest)" },
  { value: "lastSync:asc", label: "Last sync (oldest)" },
  { value: "name:asc", label: "Name (A–Z)" },
  { value: "name:desc", label: "Name (Z–A)" },
];

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

  const sortValue = `${sortField}:${sortDirection}`;

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-surface">
      {/* Search, filter & sort toolbar */}
      <div className="p-3 border-b border-border bg-surface flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-2 bg-surface-subtle border border-border rounded-lg px-3 py-1.5 flex-1 min-w-[200px] focus-within:border-border-focus transition-colors">
          <Search
            className="w-3.5 h-3.5 text-text-secondary shrink-0"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sources by name or type..."
            aria-label="Search sources"
            className="bg-transparent border-none outline-none text-xs text-text placeholder:text-text-secondary w-full"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {showTypeFilter && (
            <div className="w-36">
              <Select
                value={typeFilter}
                onChange={setTypeFilter}
                options={TYPE_FILTER_OPTIONS}
                ariaLabel="Filter by source type"
              />
            </div>
          )}

          <div className="w-36">
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_FILTER_OPTIONS}
              ariaLabel="Filter by status"
            />
          </div>

          <div className="w-44">
            <Select
              value={sortValue}
              onChange={(val) => {
                const [f, d] = val.split(":") as [SortField, SortDirection];
                setSortField(f);
                setSortDirection(d);
              }}
              options={SORT_OPTIONS}
              ariaLabel="Sort sources"
            />
          </div>
        </div>
      </div>

      {/* Table */}
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
                <SourcesTableRow
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
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
