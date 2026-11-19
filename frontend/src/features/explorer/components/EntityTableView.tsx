import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sliders,
  Sparkles,
  GitMerge,
} from "../../../lib/icons";
import type { EntityType } from "../../ontology/types";
import { getEntityColor } from "../../../lib/entityColors";
import { useThemeStore } from "../../../stores/themeStore";
import type { SearchResultItem } from "../../../pages/explorer/types";
import {
  formatPropertyLabel,
  formatShortDate,
  getEntityTypeIcon,
  isSensitiveField,
  maskSensitiveValue,
} from "../../../pages/explorer/utils";

interface EntityTableViewProps {
  entities: SearchResultItem[];
  ontologyTypes?: EntityType[];
  maskSensitiveData: boolean;
  onSelect: (entity: SearchResultItem, triggerEl: HTMLElement | null) => void;
}

type TableSortDir = "asc" | "desc";

interface ColumnDef {
  id: string;
  label: string;
  sortable: boolean;
  isProperty?: boolean;
}

export const EntityTableView: React.FC<EntityTableViewProps> = ({
  entities,
  ontologyTypes = [],
  maskSensitiveData,
  onSelect,
}) => {
  const isDark = useThemeStore((s) => s.isDark);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<TableSortDir>("asc");
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!colMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setColMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [colMenuOpen]);

  const hasConfidence = useMemo(
    () => entities.some((e) => typeof e.confidenceScore === "number"),
    [entities],
  );
  const hasSources = useMemo(
    () => entities.some((e) => typeof e.sourceCount === "number"),
    [entities],
  );

  // Discover up to 3 most common property keys across the visible page
  const topPropertyKeys = useMemo(() => {
    const counts = new Map<string, number>();
    const skip = new Set([
      "canonical_name",
      "canonicalname",
      "entity_type",
      "entitytype",
      "id",
      "uuid",
    ]);
    for (const entity of entities) {
      for (const [k, v] of Object.entries(entity.properties || {})) {
        if (
          !skip.has(k.toLowerCase()) &&
          v !== null &&
          v !== undefined &&
          String(v).trim() !== ""
        ) {
          counts.set(k, (counts.get(k) ?? 0) + 1);
        }
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([k]) => k);
  }, [entities]);

  const allColumns = useMemo<ColumnDef[]>(() => {
    const cols: ColumnDef[] = [
      { id: "canonicalName", label: "Name", sortable: true },
      { id: "entityType", label: "Type", sortable: true },
    ];
    if (hasConfidence) {
      cols.push({ id: "confidenceScore", label: "Confidence", sortable: true });
    }
    if (hasSources) {
      cols.push({ id: "sourceCount", label: "Sources", sortable: true });
    }
    for (const propKey of topPropertyKeys) {
      cols.push({
        id: `prop:${propKey}`,
        label: formatPropertyLabel(propKey),
        sortable: true,
        isProperty: true,
      });
    }
    cols.push({ id: "updatedAt", label: "Updated", sortable: true });
    return cols;
  }, [hasConfidence, hasSources, topPropertyKeys]);

  const visibleColumns = useMemo(
    () => allColumns.filter((c) => !hiddenCols.has(c.id)),
    [allColumns, hiddenCols],
  );

  const handleSortClick = (colId: string) => {
    if (sortCol === colId) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(colId);
      setSortDir("asc");
    }
  };

  const toggleColumn = (colId: string) => {
    if (colId === "canonicalName") return; // Always keep primary name column
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(colId)) next.delete(colId);
      else next.add(colId);
      return next;
    });
  };

  const sortedEntities = useMemo(() => {
    if (!sortCol) return entities;
    const copy = [...entities];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortCol === "canonicalName") {
        cmp = a.canonicalName.localeCompare(b.canonicalName);
      } else if (sortCol === "entityType") {
        cmp = a.entityType.localeCompare(b.entityType);
      } else if (sortCol === "confidenceScore") {
        cmp = (a.confidenceScore ?? -1) - (b.confidenceScore ?? -1);
      } else if (sortCol === "sourceCount") {
        cmp = (a.sourceCount ?? 0) - (b.sourceCount ?? 0);
      } else if (sortCol === "updatedAt") {
        const aTime = Date.parse(a.updatedAt || a.createdAt || "") || 0;
        const bTime = Date.parse(b.updatedAt || b.createdAt || "") || 0;
        cmp = aTime - bTime;
      } else if (sortCol.startsWith("prop:")) {
        const key = sortCol.slice(5);
        const av = String(a.properties?.[key] ?? "");
        const bv = String(b.properties?.[key] ?? "");
        cmp = av.localeCompare(bv, undefined, { numeric: true });
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [entities, sortCol, sortDir]);

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-xs">
      {/* Table sub-bar for column visibility */}
      <div className="flex items-center justify-end px-4 py-2 border-b border-border-subtle bg-surface-subtle/50">
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setColMenuOpen((v) => !v)}
            aria-expanded={colMenuOpen}
            aria-haspopup="menu"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-text-secondary hover:text-text bg-surface border border-border hover:bg-surface-hover transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
          >
            <Sliders size={13} aria-hidden="true" />
            <span>Columns</span>
          </button>

          {colMenuOpen && (
            <div
              role="menu"
              aria-label="Toggle table columns"
              className="absolute right-0 mt-1.5 w-52 p-2 rounded-xl bg-surface border border-border shadow-lg z-30 flex flex-col gap-1"
            >
              {allColumns.map((col) => {
                const isVisible = !hiddenCols.has(col.id);
                const isLocked = col.id === "canonicalName";
                return (
                  <label
                    key={col.id}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs ${
                      isLocked
                        ? "opacity-60 cursor-not-allowed"
                        : "hover:bg-surface-hover cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isVisible}
                      disabled={isLocked}
                      onChange={() => toggleColumn(col.id)}
                      className="h-3.5 w-3.5 rounded border-border accent-primary"
                    />
                    <span className="text-text truncate">{col.label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Horizontal scroll container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface-subtle/40">
              {visibleColumns.map((col) => {
                const isSorted = sortCol === col.id;
                return (
                  <th
                    key={col.id}
                    scope="col"
                    aria-sort={
                      isSorted
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted whitespace-nowrap"
                  >
                    <button
                      type="button"
                      onClick={() => handleSortClick(col.id)}
                      className="inline-flex items-center gap-1 hover:text-text transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
                    >
                      <span>{col.label}</span>
                      {isSorted ? (
                        sortDir === "asc" ? (
                          <ArrowUp
                            size={12}
                            className="text-primary"
                            aria-hidden="true"
                          />
                        ) : (
                          <ArrowDown
                            size={12}
                            className="text-primary"
                            aria-hidden="true"
                          />
                        )
                      ) : (
                        <ArrowUpDown
                          size={11}
                          className="opacity-50"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-border-subtle">
            {sortedEntities.map((entity) => {
              const safeType = (entity.entityType || "Entity").toLowerCase();
              const matchedType = ontologyTypes.find(
                (t) => (t.name || "").toLowerCase() === safeType,
              );
              const typeColor =
                matchedType?.color || getEntityColor(entity.entityType, isDark);
              const TypeIcon = getEntityTypeIcon(entity.entityType);
              const typeLabel = matchedType?.label || entity.entityType;

              return (
                <tr
                  key={entity.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Inspect ${entity.canonicalName} (${typeLabel})`}
                  onClick={(e) => onSelect(entity, e.currentTarget)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(entity, e.currentTarget);
                    }
                  }}
                  className="hover:bg-surface-hover focus-visible:outline-none focus-visible:bg-primary-tint/50 transition-colors duration-150 motion-reduce:transition-none cursor-pointer"
                >
                  {visibleColumns.map((col) => {
                    if (col.id === "canonicalName") {
                      return (
                        <td
                          key={col.id}
                          className="px-4 py-3 text-sm font-semibold text-text whitespace-nowrap max-w-[240px] truncate"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="w-7 h-7 rounded-lg flex items-center justify-center border shrink-0"
                              style={{
                                backgroundColor: `${typeColor}14`,
                                borderColor: `${typeColor}30`,
                                color: typeColor,
                              }}
                              aria-hidden="true"
                            >
                              <TypeIcon size={14} />
                            </span>
                            <span className="truncate">
                              {entity.canonicalName}
                            </span>
                          </div>
                        </td>
                      );
                    }

                    if (col.id === "entityType") {
                      return (
                        <td
                          key={col.id}
                          className="px-4 py-3 whitespace-nowrap"
                        >
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border"
                            style={{
                              backgroundColor: `${typeColor}12`,
                              borderColor: `${typeColor}30`,
                              color: typeColor,
                            }}
                          >
                            <TypeIcon size={11} aria-hidden="true" />
                            <span>{typeLabel}</span>
                          </span>
                        </td>
                      );
                    }

                    if (col.id === "confidenceScore") {
                      const pct =
                        typeof entity.confidenceScore === "number"
                          ? Math.round(
                              entity.confidenceScore <= 1
                                ? entity.confidenceScore * 100
                                : entity.confidenceScore,
                            )
                          : null;
                      return (
                        <td
                          key={col.id}
                          className="px-4 py-3 whitespace-nowrap"
                        >
                          {pct !== null ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-primary-tint text-primary border border-primary-border">
                              <Sparkles size={10} aria-hidden="true" />
                              <span>{pct}%</span>
                            </span>
                          ) : (
                            <span className="text-xs text-text-muted">—</span>
                          )}
                        </td>
                      );
                    }

                    if (col.id === "sourceCount") {
                      return (
                        <td
                          key={col.id}
                          className="px-4 py-3 text-xs text-text-secondary whitespace-nowrap"
                        >
                          {typeof entity.sourceCount === "number" ? (
                            <span className="inline-flex items-center gap-1">
                              <GitMerge
                                size={12}
                                className="text-text-muted"
                                aria-hidden="true"
                              />
                              <span>{entity.sourceCount}</span>
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      );
                    }

                    if (col.id === "updatedAt") {
                      const dateStr = formatShortDate(
                        entity.updatedAt || entity.createdAt,
                      );
                      return (
                        <td
                          key={col.id}
                          className="px-4 py-3 text-xs text-text-secondary whitespace-nowrap"
                        >
                          {dateStr || "—"}
                        </td>
                      );
                    }

                    if (col.id.startsWith("prop:")) {
                      const propKey = col.id.slice(5);
                      const val = entity.properties?.[propKey];
                      const sensitive = isSensitiveField(propKey);
                      const display = maskSensitiveValue(
                        propKey,
                        val,
                        maskSensitiveData,
                      );
                      return (
                        <td
                          key={col.id}
                          className={`px-4 py-3 text-xs whitespace-nowrap max-w-[200px] truncate ${
                            sensitive && maskSensitiveData
                              ? "font-mono text-text-secondary tracking-wider"
                              : "text-text"
                          }`}
                        >
                          {display}
                        </td>
                      );
                    }

                    return null;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
