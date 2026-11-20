import React, { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Database,
  FileText,
  Layers,
  Search,
  ShieldCheck,
  Trash2,
  AlertTriangle,
  ArrowUpDown,
  Play,
  PenLine,
  Clock,
} from "../../../lib/icons";
import { ActionMenu, Select } from "../../../components/ui/dropdown";
import { Skeleton } from "../../../components/ui/Skeleton";
import { Tooltip } from "../../../components/ui/Tooltip";
import {
  type UnifiedSource,
  type SourceStatus,
  type IngestedFile,
  formatRelativeTime,
  formatExactTimestamp,
  getHealthStatusBadge,
} from "./connectionsTypes";

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
              filteredSources.map((source) => {
                const statusCfg = getHealthStatusBadge(source.status);
                const isBusy =
                  testingSourceId === source.id ||
                  togglingSourceId === source.id;

                const menuItems =
                  source.category === "database"
                    ? [
                        {
                          label:
                            testingSourceId === source.id
                              ? "Testing connection..."
                              : "Test connection",
                          icon: <Play className="w-4 h-4" />,
                          disabled: isBusy,
                          onClick: () => onTestConnection(source),
                        },
                        {
                          label: "Edit",
                          icon: <PenLine className="w-4 h-4" />,
                          disabled: isBusy,
                          onClick: () => onEditSource(source),
                        },
                        {
                          label:
                            source.status === "Paused" ? "Resume" : "Pause",
                          icon: <Clock className="w-4 h-4" />,
                          disabled: isBusy,
                          onClick: () => onTogglePause(source),
                        },
                        {
                          label: "Open in Schema Studio",
                          icon: <Layers className="w-4 h-4" />,
                          onClick: () =>
                            navigate({ to: "/connections/schema-map" }),
                        },
                        {
                          label: "Delete",
                          icon: <Trash2 className="w-4 h-4" />,
                          destructive: true,
                          dividerBefore: true,
                          onClick: () => onDeleteSource(source),
                        },
                      ]
                    : [
                        ...(source.fileRef
                          ? [
                              {
                                label: "Inspect raw data",
                                icon: <Search className="w-4 h-4" />,
                                onClick: () =>
                                  onOpenRawPreview(source.fileRef!),
                              },
                              {
                                label: "Inspect clean data",
                                icon: (
                                  <ShieldCheck className="w-4 h-4 text-success" />
                                ),
                                onClick: () =>
                                  onInspectCleanData(source.fileRef!),
                              },
                            ]
                          : []),
                        {
                          label: "Edit",
                          icon: <PenLine className="w-4 h-4" />,
                          disabled: isBusy,
                          onClick: () => onEditSource(source),
                        },
                        {
                          label:
                            source.status === "Paused" ? "Resume" : "Pause",
                          icon: <Clock className="w-4 h-4" />,
                          disabled: isBusy,
                          onClick: () => onTogglePause(source),
                        },
                        {
                          label: "Delete",
                          icon: <Trash2 className="w-4 h-4" />,
                          destructive: true,
                          dividerBefore: true,
                          onClick: () => onDeleteSource(source),
                        },
                      ];

                return (
                  <tr
                    key={source.id}
                    className="hover:bg-surface-hover transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-text-secondary shrink-0">
                          {source.category === "database" ? (
                            <Database className="w-4 h-4" aria-hidden="true" />
                          ) : (
                            <FileText className="w-4 h-4" aria-hidden="true" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="font-semibold text-text truncate max-w-[220px]"
                              title={source.name}
                            >
                              {source.name}
                            </span>
                            {source.schemaDriftWarning && (
                              <Tooltip
                                label={source.schemaDriftWarning}
                                side="top"
                              >
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-warning-bg text-warning border border-warning-border shrink-0">
                                  <AlertTriangle
                                    className="w-3 h-3"
                                    aria-hidden="true"
                                  />
                                  Schema drift
                                </span>
                              </Tooltip>
                            )}
                          </div>
                          {source.desc && (
                            <span className="text-[11px] text-text-secondary line-clamp-1">
                              {source.desc}
                            </span>
                          )}
                          {source.size && source.size !== "—" && (
                            <span className="text-[11px] text-text-secondary">
                              {source.size}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-surface-subtle border border-border text-text-secondary">
                        {source.typeLabel}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${statusCfg.badgeStyle}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotColor}`}
                        />
                        {source.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-text-secondary">
                      <Tooltip
                        label={formatExactTimestamp(source.lastSyncAt)}
                        side="top"
                      >
                        <span className="cursor-default underline decoration-dotted decoration-border underline-offset-2">
                          {formatRelativeTime(source.lastSyncAt)}
                        </span>
                      </Tooltip>
                    </td>

                    <td className="py-3 px-4 text-text tabular-nums">
                      {typeof source.rowsSynced === "number"
                        ? source.rowsSynced.toLocaleString()
                        : "—"}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center justify-end">
                        <ActionMenu
                          ariaLabel={`Actions for ${source.name}`}
                          items={menuItems}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
