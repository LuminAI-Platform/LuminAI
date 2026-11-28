import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, X, FilterX } from "../../../lib/icons";
import type { EntityType } from "../../ontology/types";
import { getEntityColor } from "../../../lib/entityColors";
import { useThemeStore } from "../../../stores/themeStore";
import type { MergedTypeRow } from "./FacetTypeItem";
import { FacetExtraGroup } from "./FacetExtraGroup";
import { FacetTypesList } from "./FacetTypesList";

interface FacetFilterSidebarProps {
  selectedTypes: string[];
  onChange: (selectedTypes: string[]) => void;
  facets: Record<string, number>;
  facetGroups?: Record<string, Record<string, number>>;
  ontologyTypes: EntityType[];
  inDrawer?: boolean;
  onCloseDrawer?: () => void;
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
        sourceDataset: t.sourceDataset || t.sourceName || t.datasetName,
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

  return (
    <aside
      aria-label="Entity filters"
      className={
        inDrawer
          ? "w-full flex flex-col gap-4 h-full"
          : "w-full lg:w-64 xl:w-72 shrink-0 bg-surface border border-border rounded-xl p-4 flex flex-col gap-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-7rem)] overflow-y-auto"
      }
    >
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
          <FacetTypesList
            typeSearch={typeSearch}
            onTypeSearchChange={setTypeSearch}
            nonEmptyRows={nonEmptyRows}
            emptyRows={emptyRows}
            selectedTypes={selectedTypes}
            showEmptyTypes={showEmptyTypes}
            onToggleShowEmptyTypes={() => setShowEmptyTypes((v) => !v)}
            onToggleType={handleToggle}
          />
        )}
      </div>

      {extraFacetGroups.map(([groupKey, entries]) => (
        <FacetExtraGroup
          key={groupKey}
          groupKey={groupKey}
          entries={entries}
          isOpen={expandedExtraGroups[groupKey] ?? true}
          onToggleOpen={() =>
            setExpandedExtraGroups((prev) => ({
              ...prev,
              [groupKey]: !(prev[groupKey] ?? true),
            }))
          }
        />
      ))}
    </aside>
  );
};
