import React, { useMemo, useState } from "react";
import {
  Search,
  ChevronDown,
  ChevronRight,
  X,
  FilterX,
} from "../../../lib/icons";
import type { EntityType } from "../../ontology/types";
import { getEntityColor } from "../../../lib/entityColors";
import { useThemeStore } from "../../../stores/themeStore";
import {
  formatPropertyLabel,
  getEntityTypeIcon,
} from "../../../pages/explorer/utils";

interface FacetFilterSidebarProps {
  selectedTypes: string[];
  onChange: (selectedTypes: string[]) => void;
  facets: Record<string, number>;
  facetGroups?: Record<string, Record<string, number>>;
  ontologyTypes: EntityType[];
  /** When true, renders without outer sticky/aside width constraints (used inside mobile/tablet drawer) */
  inDrawer?: boolean;
  onCloseDrawer?: () => void;
}

interface MergedTypeRow {
  name: string;
  label: string;
  count: number;
  color: string;
}

export const FacetFilterSidebar: React.FC<FacetFilterSidebarProps> = ({
  selectedTypes,
  onChange,
  facets,
  facetGroups = {},
  ontologyTypes,
  inDrawer = false,
  onCloseDrawer,
}) => {
  const isDark = useThemeStore((s) => s.isDark);
  const [typeSearch, setTypeSearch] = useState("");
  const [showEmptyTypes, setShowEmptyTypes] = useState(false);
  const [typesExpanded, setTypesExpanded] = useState(true);
  const [expandedExtraGroups, setExpandedExtraGroups] = useState<
    Record<string, boolean>
  >({});

  // Merge ontology types with any facet keys returned by the API, sort by count descending
  const allTypeRows = useMemo<MergedTypeRow[]>(() => {
    const byName = new Map<string, MergedTypeRow>();

    for (const t of ontologyTypes) {
      const name = t.name;
      const count = facets[name] ?? 0;
      byName.set(name.toLowerCase(), {
        name,
        label: t.label || t.name,
        count,
        color: t.color || getEntityColor(name, isDark),
      });
    }

    for (const [facetName, count] of Object.entries(facets)) {
      const key = facetName.toLowerCase();
      if (!byName.has(key)) {
        byName.set(key, {
          name: facetName,
          label: facetName,
          count,
          color: getEntityColor(facetName, isDark),
        });
      }
    }

    return Array.from(byName.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    });
  }, [ontologyTypes, facets, isDark]);

  // Filter by sidebar search query
  const searchedRows = useMemo(() => {
    const q = typeSearch.trim().toLowerCase();
    if (!q) return allTypeRows;
    return allTypeRows.filter(
      (row) =>
        row.label.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q),
    );
  }, [allTypeRows, typeSearch]);

  const nonEmptyRows = useMemo(
    () =>
      searchedRows.filter((r) => r.count > 0 || selectedTypes.includes(r.name)),
    [searchedRows, selectedTypes],
  );

  const emptyRows = useMemo(
    () =>
      searchedRows.filter(
        (r) => r.count === 0 && !selectedTypes.includes(r.name),
      ),
    [searchedRows, selectedTypes],
  );

  // Additional facet groups if the API returns any beyond entityTypes
  const extraFacetGroups = useMemo(() => {
    return Object.entries(facetGroups).filter(
      ([groupKey, entries]) =>
        groupKey !== "entityTypes" &&
        groupKey !== "entityType" &&
        Object.keys(entries).length > 0,
    );
  }, [facetGroups]);

  const handleToggle = (typeName: string) => {
    const isSelected = selectedTypes.includes(typeName);
    if (isSelected) {
      onChange(selectedTypes.filter((t) => t !== typeName));
    } else {
      onChange([...selectedTypes, typeName]);
    }
  };

  const handleClearAll = () => {
    onChange([]);
    setTypeSearch("");
  };

  const activeCount = selectedTypes.length;

  const renderTypeRow = (row: MergedTypeRow) => {
    const isChecked = selectedTypes.includes(row.name);
    const TypeIcon = getEntityTypeIcon(row.name);

    return (
      <label
        key={row.name}
        title={row.label}
        className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border transition-colors duration-150 motion-reduce:transition-none cursor-pointer ${
          isChecked
            ? "bg-primary-tint border-primary-border text-text"
            : "bg-transparent border-transparent hover:bg-surface-hover text-text-secondary hover:text-text"
        } ${row.count === 0 && !isChecked ? "opacity-60" : ""}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={() => handleToggle(row.name)}
            className="h-4 w-4 rounded border-border accent-primary cursor-pointer shrink-0"
          />

          <span
            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
            style={{
              backgroundColor: `${row.color}18`,
              color: row.color,
            }}
            aria-hidden="true"
          >
            <TypeIcon size={13} />
          </span>

          <span className="text-xs font-medium truncate">{row.label}</span>
        </div>

        <span
          className={`text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${
            isChecked
              ? "bg-primary/15 text-primary"
              : "bg-surface-subtle text-text-muted"
          }`}
        >
          {row.count}
        </span>
      </label>
    );
  };

  return (
    <aside
      aria-label="Entity filters"
      className={
        inDrawer
          ? "w-full flex flex-col gap-4 h-full"
          : "w-full lg:w-64 xl:w-72 shrink-0 bg-surface border border-border rounded-xl p-4 flex flex-col gap-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-7rem)] overflow-y-auto"
      }
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold text-text uppercase tracking-wider">
            Filters
          </h2>
          {activeCount > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary-tint text-primary border border-primary-border">
              {activeCount} active
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {activeCount > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[11px] font-semibold text-text-secondary hover:text-primary flex items-center gap-1 px-1.5 py-1 rounded-md hover:bg-surface-hover transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
            >
              <FilterX size={12} aria-hidden="true" />
              <span>Clear all</span>
            </button>
          )}
          {inDrawer && onCloseDrawer && (
            <button
              type="button"
              onClick={onCloseDrawer}
              aria-label="Close filters"
              className="p-1.5 rounded-lg text-text-secondary hover:text-text hover:bg-surface-hover transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Entity Types Group */}
      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={() => setTypesExpanded((v) => !v)}
          aria-expanded={typesExpanded}
          className="flex items-center justify-between w-full text-left py-1 text-xs font-semibold text-text hover:text-primary transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
        >
          <span>Entity Types</span>
          {typesExpanded ? (
            <ChevronDown
              size={14}
              className="text-text-muted"
              aria-hidden="true"
            />
          ) : (
            <ChevronRight
              size={14}
              className="text-text-muted"
              aria-hidden="true"
            />
          )}
        </button>

        {typesExpanded && (
          <div className="flex flex-col gap-2">
            {/* Small search input inside panel */}
            <div className="relative flex items-center">
              <Search
                size={13}
                className="absolute left-2.5 text-text-muted pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={typeSearch}
                onChange={(e) => setTypeSearch(e.target.value)}
                placeholder="Filter types..."
                aria-label="Filter entity types"
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-surface-subtle border border-border rounded-lg text-text placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors duration-150 motion-reduce:transition-none"
              />
              {typeSearch && (
                <button
                  type="button"
                  onClick={() => setTypeSearch("")}
                  aria-label="Clear type filter"
                  className="absolute right-2 text-text-muted hover:text-text cursor-pointer"
                >
                  <X size={12} aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Non-empty entity types */}
            {nonEmptyRows.length === 0 && emptyRows.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-4">
                No matching entity types
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {nonEmptyRows.map(renderTypeRow)}
              </div>
            )}

            {/* Empty entity types toggle */}
            {emptyRows.length > 0 && (
              <div className="pt-2 border-t border-border-subtle flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setShowEmptyTypes((v) => !v)}
                  aria-expanded={showEmptyTypes}
                  className="flex items-center justify-between w-full px-2 py-1.5 text-[11px] font-medium text-text-muted hover:text-text rounded-lg hover:bg-surface-hover transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
                >
                  <span>
                    {showEmptyTypes ? "Hide" : "Show"} empty types (
                    {emptyRows.length})
                  </span>
                  {showEmptyTypes ? (
                    <ChevronDown size={12} aria-hidden="true" />
                  ) : (
                    <ChevronRight size={12} aria-hidden="true" />
                  )}
                </button>

                {showEmptyTypes && (
                  <div className="flex flex-col gap-1 mt-1">
                    {emptyRows.map(renderTypeRow)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Additional dynamic facet groups (rendered only if API supplies them) */}
      {extraFacetGroups.map(([groupKey, entries]) => {
        const isOpen = expandedExtraGroups[groupKey] ?? true;
        const sortedEntries = Object.entries(entries).sort(
          (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
        );

        return (
          <div
            key={groupKey}
            className="pt-3 border-t border-border-subtle flex flex-col gap-2"
          >
            <button
              type="button"
              onClick={() =>
                setExpandedExtraGroups((prev) => ({
                  ...prev,
                  [groupKey]: !isOpen,
                }))
              }
              aria-expanded={isOpen}
              className="flex items-center justify-between w-full text-left py-1 text-xs font-semibold text-text hover:text-primary transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
            >
              <span>{formatPropertyLabel(groupKey)}</span>
              {isOpen ? (
                <ChevronDown
                  size={14}
                  className="text-text-muted"
                  aria-hidden="true"
                />
              ) : (
                <ChevronRight
                  size={14}
                  className="text-text-muted"
                  aria-hidden="true"
                />
              )}
            </button>

            {isOpen && (
              <div className="flex flex-col gap-1">
                {sortedEntries.map(([val, count]) => (
                  <div
                    key={val}
                    title={val}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs text-text-secondary"
                  >
                    <span className="truncate">{val}</span>
                    <span className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-surface-subtle text-text-muted shrink-0">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
};
